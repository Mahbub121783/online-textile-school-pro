import { FormSkeleton } from '@/components/ui/loading-skeletons';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Save, Search, RefreshCw, Globe, ExternalLink, Activity } from 'lucide-react';
import { trackMetaEvent, configureMetaPixel, runMetaPixelDiagnostic, type DiagnosticResult } from '@/lib/metaPixel';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const DEFAULT_KEYS = [
  { key: 'site_name', label: 'Site Name', type: 'text' },
  { key: 'site_description', label: 'Site Description', type: 'text' },
  { key: 'contact_email', label: 'Contact Email', type: 'text' },
  { key: 'contact_phone', label: 'Contact Phone', type: 'text' },
  { key: 'facebook_url', label: 'Facebook URL', type: 'text' },
  { key: 'youtube_url', label: 'YouTube URL', type: 'text' },
  { key: 'maintenance_mode', label: 'Maintenance Mode', type: 'toggle' },
];

const AdminSettings = () => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [indexNowKey, setIndexNowKey] = useState('');
  const [reindexing, setReindexing] = useState(false);
  const [pixelId, setPixelId] = useState('1005930275539761');
  const [pixelTestCode, setPixelTestCode] = useState('TEST4851');
  const [pixelEnabled, setPixelEnabled] = useState(true);
  const [pixelRequireConsent, setPixelRequireConsent] = useState(false);
  const [diagResults, setDiagResults] = useState<DiagnosticResult[] | null>(null);
  const [diagRunning, setDiagRunning] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-site-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('site_settings').select('*');
      return data ?? [];
    },
  });

  useEffect(() => {
    if (settings) {
      const map: Record<string, string> = {};
      settings.forEach((s) => { map[s.key] = s.value ?? ''; });
      setFormData(map);
      setIndexNowKey(map['indexnow_key'] || '');
      if (map['meta_pixel_id']) setPixelId(map['meta_pixel_id']);
      if (map['meta_pixel_test_code'] !== undefined) setPixelTestCode(map['meta_pixel_test_code']);
      if (map['meta_pixel_enabled'] !== undefined) setPixelEnabled(map['meta_pixel_enabled'] !== 'false');
      if (map['meta_pixel_require_consent'] !== undefined) setPixelRequireConsent(map['meta_pixel_require_consent'] === 'true');
    }
  }, [settings]);

  // Apply Meta Pixel config to runtime whenever it changes
  useEffect(() => {
    configureMetaPixel({ pixelId, testCode: pixelTestCode, enabled: pixelEnabled, requireConsent: pixelRequireConsent });
  }, [pixelId, pixelTestCode, pixelEnabled, pixelRequireConsent]);

  const upsertSetting = async (key: string, value: string) => {
    const existing = settings?.find((s) => s.key === key);
    if (existing) {
      await supabase.from('site_settings').update({ value, updated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('site_settings').insert({ key, value });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const def of DEFAULT_KEYS) {
        await upsertSetting(def.key, formData[def.key] ?? '');
      }
      await supabase.from('admin_activity_log').insert({ admin_id: user!.id, action: 'Updated site settings', target_type: 'settings', target_id: 'global' });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-site-settings'] }); toast.success('Settings saved'); },
    onError: () => toast.error('Failed to save settings'),
  });

  const saveSeoMutation = useMutation({
    mutationFn: async () => {
      await upsertSetting('indexnow_key', indexNowKey.trim());
      await supabase.from('admin_activity_log').insert({ admin_id: user!.id, action: 'Updated IndexNow key', target_type: 'seo', target_id: 'indexnow' });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-site-settings'] }); toast.success('IndexNow key saved'); },
    onError: () => toast.error('Failed to save IndexNow key'),
  });

  const savePixelMutation = useMutation({
    mutationFn: async () => {
      await upsertSetting('meta_pixel_id', pixelId.trim());
      await upsertSetting('meta_pixel_test_code', pixelTestCode.trim());
      await upsertSetting('meta_pixel_enabled', pixelEnabled ? 'true' : 'false');
      await upsertSetting('meta_pixel_require_consent', pixelRequireConsent ? 'true' : 'false');
      await supabase.from('admin_activity_log').insert({ admin_id: user!.id, action: 'Updated Meta Pixel config', target_type: 'tracking', target_id: 'meta_pixel' });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-site-settings'] }); toast.success('Meta Pixel settings saved'); },
    onError: () => toast.error('Failed to save Meta Pixel settings'),
  });

  const handlePixelDiagnostic = async () => {
    setDiagRunning(true);
    setDiagResults(null);
    try {
      const results = await runMetaPixelDiagnostic();
      setDiagResults(results);
      const allOk = results.every((r) => r.ok);
      if (allOk) toast.success('All checks passed — events flowing to Meta');
      else toast.warning('Some checks failed — review the table below');
    } catch (e: any) {
      toast.error('Diagnostic failed: ' + (e?.message || 'unknown'));
    } finally {
      setDiagRunning(false);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    try {
      // 1. Rebuild AI search index
      await supabase.functions.invoke('ai-index-builder').catch(() => {});
      // 2. Ping search engines
      const { error } = await supabase.functions.invoke('indexnow-ping', {
        body: { paths: ['/', '/courses', '/ebooks', '/blog', '/workshops', '/learning-paths'] },
      });
      if (error) throw error;
      toast.success('Search engines pinged & index rebuilt');
    } catch (e: any) {
      toast.error('Re-index failed: ' + (e?.message || 'unknown error'));
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold">Site Settings</h2>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="seo"><Search className="h-4 w-4 mr-1.5" /> SEO</TabsTrigger>
          <TabsTrigger value="pixel"><Activity className="h-4 w-4 mr-1.5" /> Meta Pixel</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader><CardTitle>General Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {isLoading ? (
                <FormSkeleton fields={6} />
              ) : (
                <>
                  {DEFAULT_KEYS.map((def) => (
                    <div key={def.key}>
                      {def.type === 'toggle' ? (
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={formData[def.key] === 'true'}
                            onCheckedChange={(v) => setFormData({ ...formData, [def.key]: v ? 'true' : 'false' })}
                          />
                          <Label>{def.label}</Label>
                        </div>
                      ) : (
                        <div>
                          <Label className="mb-1 block">{def.label}</Label>
                          <Input
                            value={formData[def.key] ?? ''}
                            onChange={(e) => setFormData({ ...formData, [def.key]: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" /> Save Settings
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Auto-SEO Status</CardTitle>
              <CardDescription>
                Every course, ebook, blog post, workshop, learning path, research paper and internship is automatically SEO-optimized on save —
                meta titles, descriptions, keywords, and OG images are filled from content if left blank. Search engines are pinged on publish.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                Auto-fill triggers active on 7 content tables
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                Publish-ping triggers active (Courses, Ebooks, Posts, Workshops, Learning Paths)
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${indexNowKey ? 'bg-primary' : 'bg-destructive'}`} />
                IndexNow: {indexNowKey ? 'Configured' : 'Not configured (Bing/Yandex/Seznam instant indexing disabled)'}
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <a href="https://onlinetextileschool.com/sitemap.xml" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  View Sitemap <ExternalLink className="h-3 w-3" />
                </a>
                <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  Google Search Console <ExternalLink className="h-3 w-3" />
                </a>
                <a href="https://www.bing.com/webmasters" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  Bing Webmaster <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>IndexNow API Key</CardTitle>
              <CardDescription>
                Get a free key at{' '}
                <a href="https://www.bing.com/indexnow" target="_blank" rel="noreferrer" className="text-primary hover:underline">bing.com/indexnow</a>.
                Then upload <code className="bg-muted px-1 rounded">{`<your-key>.txt`}</code> to your site root containing the key.
                This enables instant indexing on Bing, Yandex, Seznam, and Naver.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-1 block">IndexNow Key</Label>
                <Input
                  value={indexNowKey}
                  onChange={(e) => setIndexNowKey(e.target.value)}
                  placeholder="e.g. a1b2c3d4e5f6789..."
                />
              </div>
              <Button onClick={() => saveSeoMutation.mutate()} disabled={saveSeoMutation.isPending}>
                <Save className="h-4 w-4 mr-2" /> Save IndexNow Key
              </Button>
              <p className="text-xs text-muted-foreground">
                Note: also store this same key as a Supabase Edge Function secret named <code className="bg-muted px-1 rounded">INDEXNOW_KEY</code> for the publish-ping trigger to work.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manual Re-Index</CardTitle>
              <CardDescription>Force-rebuild internal search index and notify Google, Bing, Yandex about all top-level pages.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleReindex} disabled={reindexing} variant="secondary">
                <RefreshCw className={`h-4 w-4 mr-2 ${reindexing ? 'animate-spin' : ''}`} />
                {reindexing ? 'Re-indexing…' : 'Re-Index All & Ping Search Engines'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pixel" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Meta Pixel & Conversions API</CardTitle>
              <CardDescription>
                Tracks PageView, AddToCart, InitiateCheckout, Purchase, TimeOnPage, PageScroll, WatchVideo and InternalClick events.
                Every event fires both browser-side (fbq) and server-side (Conversions API) with a shared event ID for deduplication.
                Events only fire after a visitor accepts <strong>marketing cookies</strong> in the consent banner.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mode selector — Test vs Production */}
              <div className={`rounded-lg border-2 p-4 ${pixelTestCode.trim() ? 'border-warning bg-warning/5' : 'border-success bg-success/5'}`}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <Label className="text-base font-semibold block mb-1">Pixel Mode</Label>
                    <p className="text-xs text-muted-foreground">
                      {pixelTestCode.trim()
                        ? 'Events go to Test Events tab only — they do NOT count toward live campaigns.'
                        : 'Events flow to Overview tab and count toward live ad campaigns.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={pixelTestCode.trim() ? 'default' : 'outline'}
                      onClick={() => setPixelTestCode('TEST4851')}
                    >
                      Test Mode
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={!pixelTestCode.trim() ? 'default' : 'outline'}
                      onClick={() => setPixelTestCode('')}
                    >
                      Production Mode
                    </Button>
                  </div>
                </div>
                <div className="mt-3">
                  {pixelTestCode.trim() ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/20 text-warning-foreground px-3 py-1 text-xs font-bold uppercase tracking-wide">
                      <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                      Test Mode Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/20 text-success-foreground px-3 py-1 text-xs font-bold uppercase tracking-wide">
                      <CheckCircle2 className="h-3 w-3" />
                      Live / Production — Counting toward campaigns
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Don't forget to click <strong>Save Pixel Settings</strong> below to apply the change.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={pixelEnabled} onCheckedChange={setPixelEnabled} />
                <Label>Pixel tracking enabled</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={pixelRequireConsent} onCheckedChange={setPixelRequireConsent} />
                <div>
                  <Label>Require marketing cookie consent</Label>
                  <p className="text-xs text-muted-foreground">
                    When OFF, events fire for all visitors immediately (more data, but check your local privacy law).
                    When ON, events only fire after a visitor accepts marketing cookies. Admins always bypass this gate.
                  </p>
                </div>
              </div>
              <div>
                <Label className="mb-1 block">Pixel ID</Label>
                <Input value={pixelId} onChange={(e) => setPixelId(e.target.value)} placeholder="e.g. 1005930275539761" />
              </div>
              <div>
                <Label className="mb-1 block">Test Event Code (advanced)</Label>
                <Input value={pixelTestCode} onChange={(e) => setPixelTestCode(e.target.value)} placeholder="Empty = Production. Custom code = Test Mode." />
                <p className="text-xs text-muted-foreground mt-1">
                  Controlled by the Mode selector above. Leave empty for Production. Custom code (e.g. <code className="bg-muted px-1 rounded">TEST4851</code>) routes events to Events Manager → Test Events tab.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => savePixelMutation.mutate()} disabled={savePixelMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" /> Save Pixel Settings
                </Button>
                <Button variant="secondary" onClick={handlePixelDiagnostic} disabled={diagRunning}>
                  {diagRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
                  Run Diagnostic
                </Button>
                <a
                  href="https://business.facebook.com/events_manager2"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1 self-center"
                >
                  Open Events Manager <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {diagResults && (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 w-10">OK</th>
                        <th className="text-left p-2">Check</th>
                        <th className="text-left p-2">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagResults.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">
                            {r.ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                          </td>
                          <td className="p-2 font-medium">{r.check}</td>
                          <td className="p-2 text-xs text-muted-foreground break-all">{r.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                <div><strong>Access Token</strong>: stored as Supabase secret <code className="bg-muted px-1 rounded">META_CAPI_ACCESS_TOKEN</code> ✅</div>
                <div><strong>Pixel ID secret</strong>: stored as <code className="bg-muted px-1 rounded">META_PIXEL_ID</code> ✅ (used by server CAPI)</div>
                <div><strong>Debug</strong>: open browser DevTools console and run <code className="bg-muted px-1 rounded">__metaPixelDebug()</code> to inspect runtime state. Every fired event is logged to the console with <code className="bg-muted px-1 rounded">[MetaPixel]</code>.</div>
                <div><strong>Note</strong>: Test events do not count in your campaign reports — they only appear in the Test Events tab.</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
