import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Save, Palette, Code, Image, Globe, Bell, Info } from 'lucide-react';
import MediaUploader from '@/components/instructor/MediaUploader';

const APPEARANCE_KEYS = [
  // Branding — uploads
  { key: 'logo_url', label: 'Site Logo', type: 'upload', section: 'branding', hint: 'Recommended: PNG with transparent background, 200×60px' },
  { key: 'favicon_url', label: 'Favicon', type: 'upload', section: 'branding', hint: '32×32 or 64×64 PNG/ICO' },
  { key: 'og_image_url', label: 'Default Social Share Image (OG Image)', type: 'upload', section: 'branding', hint: '1200×630px recommended for Facebook/LinkedIn/Twitter previews', aspectRatio: '1200/630' },
  // Branding — text
  { key: 'site_name', label: 'Site Name', type: 'text', section: 'branding', hint: 'Shown in browser tab & social share titles' },
  { key: 'site_tagline', label: 'Tagline', type: 'text', section: 'branding', hint: 'Short motto shown alongside site name' },
  { key: 'site_description', label: 'Site Description (Meta Description)', type: 'textarea', section: 'branding', hint: 'Max 160 chars. Appears in Google search results.' },
  { key: 'meta_keywords', label: 'Meta Keywords', type: 'text', section: 'branding', hint: 'Comma-separated keywords for SEO (e.g. textile engineering, online courses, spinning)' },
  { key: 'footer_text', label: 'Custom Footer Text', type: 'text', section: 'branding' },
  // Colors
  { key: 'primary_color', label: 'Primary Color', type: 'color', section: 'colors' },
  { key: 'accent_color', label: 'Accent Color', type: 'color', section: 'colors' },
  // Contact
  { key: 'contact_email', label: 'Contact Email', type: 'text', section: 'contact' },
  { key: 'contact_phone', label: 'Contact Phone', type: 'text', section: 'contact' },
  { key: 'whatsapp_number', label: 'WhatsApp Number', type: 'text', section: 'contact' },
  { key: 'facebook_url', label: 'Facebook URL', type: 'text', section: 'contact' },
  { key: 'youtube_url', label: 'YouTube URL', type: 'text', section: 'contact' },
  { key: 'linkedin_url', label: 'LinkedIn URL', type: 'text', section: 'contact' },
  { key: 'twitter_handle', label: 'Twitter/X Handle', type: 'text', section: 'contact', hint: 'e.g. @onlinetextileschool' },
  // Announcement
  { key: 'header_announcement', label: 'Header Announcement', type: 'text', section: 'announcement' },
  { key: 'announcement_enabled', label: 'Show Announcement', type: 'toggle', section: 'announcement' },
  // Advanced
  { key: 'custom_css', label: 'Custom CSS', type: 'textarea', section: 'advanced' },
  { key: 'custom_header_scripts', label: 'Header Scripts (analytics, etc.)', type: 'textarea', section: 'advanced' },
  { key: 'google_analytics_id', label: 'Google Analytics ID', type: 'text', section: 'advanced' },
  { key: 'google_site_verification', label: 'Google Site Verification', type: 'text', section: 'advanced', hint: 'Content value from <meta name="google-site-verification">' },
  { key: 'maintenance_mode', label: 'Maintenance Mode', type: 'toggle', section: 'advanced' },
];

const AdminAppearance = () => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-appearance-settings'],
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
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const def of APPEARANCE_KEYS) {
        const existing = settings?.find((s) => s.key === def.key);
        const value = formData[def.key] ?? '';
        if (existing) {
          await supabase.from('site_settings').update({ value, updated_at: new Date().toISOString() }).eq('id', existing.id);
        } else {
          await supabase.from('site_settings').insert({ key: def.key, value });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-appearance-settings'] });
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      toast.success('Appearance settings saved');
    },
    onError: () => toast.error('Failed to save'),
  });

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const renderField = (def: typeof APPEARANCE_KEYS[number]) => {
    const hint = (def as any).hint;

    if (def.type === 'upload') {
      return (
        <div key={def.key} className="space-y-1.5">
          <Label className="block font-semibold">{def.label}</Label>
          {hint && <p className="text-xs text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />{hint}</p>}
          <MediaUploader
            value={formData[def.key] || ''}
            onChange={(url) => updateField(def.key, url)}
            label={`Upload ${def.label}`}
            aspectRatio={(def as any).aspectRatio}
          />
        </div>
      );
    }

    if (def.type === 'toggle') {
      return (
        <div className="flex items-center gap-3" key={def.key}>
          <Switch
            checked={formData[def.key] === 'true'}
            onCheckedChange={(v) => updateField(def.key, v ? 'true' : 'false')}
          />
          <Label>{def.label}</Label>
        </div>
      );
    }

    if (def.type === 'textarea') {
      return (
        <div key={def.key} className="space-y-1.5">
          <Label className="block font-semibold">{def.label}</Label>
          {hint && <p className="text-xs text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />{hint}</p>}
          <Textarea
            value={formData[def.key] ?? ''}
            onChange={(e) => updateField(def.key, e.target.value)}
            rows={4}
            className="font-mono text-sm"
            maxLength={def.key === 'site_description' ? 160 : undefined}
          />
          {def.key === 'site_description' && (
            <p className="text-xs text-muted-foreground text-right">{(formData[def.key] ?? '').length}/160</p>
          )}
        </div>
      );
    }

    if (def.type === 'color') {
      return (
        <div key={def.key} className="space-y-1.5">
          <Label className="block font-semibold">{def.label}</Label>
          <div className="flex gap-2">
            <input
              type="color"
              value={formData[def.key] || '#0c4a6e'}
              onChange={(e) => updateField(def.key, e.target.value)}
              className="h-10 w-12 rounded border cursor-pointer"
            />
            <Input
              value={formData[def.key] ?? ''}
              onChange={(e) => updateField(def.key, e.target.value)}
              placeholder="#0c4a6e"
            />
          </div>
        </div>
      );
    }

    return (
      <div key={def.key} className="space-y-1.5">
        <Label className="block font-semibold">{def.label}</Label>
        {hint && <p className="text-xs text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />{hint}</p>}
        <Input value={formData[def.key] ?? ''} onChange={(e) => updateField(def.key, e.target.value)} />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold">Appearance & SEO</h2>
          <p className="text-sm text-muted-foreground">Manage branding, social share previews, meta tags, and site-wide settings</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" /> Save All
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <Tabs defaultValue="branding">
          <TabsList className="mb-4">
            <TabsTrigger value="branding"><Image className="h-4 w-4 mr-1" /> Branding & SEO</TabsTrigger>
            <TabsTrigger value="colors"><Palette className="h-4 w-4 mr-1" /> Colors</TabsTrigger>
            <TabsTrigger value="contact"><Globe className="h-4 w-4 mr-1" /> Contact & Social</TabsTrigger>
            <TabsTrigger value="announcement"><Bell className="h-4 w-4 mr-1" /> Announcement</TabsTrigger>
            <TabsTrigger value="advanced"><Code className="h-4 w-4 mr-1" /> Advanced</TabsTrigger>
          </TabsList>

          {['branding', 'colors', 'contact', 'announcement', 'advanced'].map((section) => (
            <TabsContent key={section} value={section}>
              <Card>
                <CardHeader>
                  <CardTitle className="capitalize">{section === 'branding' ? 'Branding & SEO' : section}</CardTitle>
                  {section === 'branding' && (
                    <CardDescription>Upload logo, favicon, social share image and configure meta tags for search engines & social media previews.</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  {APPEARANCE_KEYS.filter(d => d.section === section).map(renderField)}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};

export default AdminAppearance;
