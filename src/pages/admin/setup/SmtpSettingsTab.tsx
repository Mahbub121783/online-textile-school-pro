import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Mail, Server, Shield, Send, Palette, Image, Globe } from 'lucide-react';

const SMTP_KEYS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_encryption', 'smtp_from_email', 'smtp_from_name'] as const;
const BRAND_KEYS = ['email_logo_url', 'email_brand_color', 'email_footer_text', 'email_website_url', 'email_facebook_url', 'email_youtube_url'] as const;
const ALL_KEYS = [...SMTP_KEYS, ...BRAND_KEYS];

const SmtpSettingsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['smtp-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('site_settings').select('*').in('key', [...ALL_KEYS]);
      const map: Record<string, string> = {};
      data?.forEach((s: any) => { map[s.key] = s.value ?? ''; });
      return map;
    },
  });

  const [form, setForm] = useState<Record<string, string>>({});

  const getValue = (key: string) => form[key] ?? settings?.[key] ?? '';

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const key of ALL_KEYS) {
        const value = getValue(key);
        const { data: existing } = await supabase.from('site_settings').select('id').eq('key', key).maybeSingle();
        if (existing) {
          await supabase.from('site_settings').update({ value }).eq('key', key);
        } else {
          await supabase.from('site_settings').insert({ key, value });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smtp-settings'] });
      toast({ title: 'Settings saved successfully' });
    },
    onError: () => toast({ title: 'Failed to save', variant: 'destructive' }),
  });

  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      const testEmail = getValue('smtp_from_email') || getValue('smtp_user');
      if (!testEmail) {
        toast({ title: 'Set a From Email first', variant: 'destructive' });
        return;
      }
      const { data, error } = await supabase.functions.invoke('send-smtp-email', {
        body: {
          recipientEmail: testEmail,
          subject: 'SMTP Test - Online Textile School',
          body: '<h2>SMTP Connection Test</h2><p>If you received this email, your SMTP configuration is working correctly!</p><p>Sent at: ' + new Date().toLocaleString() + '</p>',
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Test email sent!', description: `Check inbox at ${testEmail}` });
    } catch (err: any) {
      toast({ title: 'Test failed', description: err.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) return <div className="text-muted-foreground">Loading SMTP settings...</div>;

  return (
    <div className="space-y-6">
      {/* SMTP Server */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-primary" /> SMTP Server</CardTitle>
          <CardDescription>Configure your outgoing mail server for transactional emails</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>SMTP Host</Label>
            <Input placeholder="mail.onlinetextileschool.com" value={getValue('smtp_host')} onChange={e => setForm(p => ({ ...p, smtp_host: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Port</Label>
            <Input placeholder="465" value={getValue('smtp_port') || '465'} onChange={e => setForm(p => ({ ...p, smtp_port: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input placeholder="info@onlinetextileschool.com" value={getValue('smtp_user')} onChange={e => setForm(p => ({ ...p, smtp_user: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" placeholder="••••••••" value={getValue('smtp_pass')} onChange={e => setForm(p => ({ ...p, smtp_pass: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Encryption</Label>
            <Select value={getValue('smtp_encryption') || 'ssl'} onValueChange={v => setForm(p => ({ ...p, smtp_encryption: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ssl">SSL (Port 465)</SelectItem>
                <SelectItem value="tls">TLS / STARTTLS (Port 587)</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Sender Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /> Sender Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>From Email</Label>
            <Input placeholder="info@onlinetextileschool.com" value={getValue('smtp_from_email')} onChange={e => setForm(p => ({ ...p, smtp_from_email: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>From Name</Label>
            <Input placeholder="Online Textile School" value={getValue('smtp_from_name')} onChange={e => setForm(p => ({ ...p, smtp_from_name: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      {/* Email Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /> Email Branding</CardTitle>
          <CardDescription>Customize the look of all outgoing emails with your logo, colors, and footer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Image className="h-4 w-4" /> Logo URL</Label>
              <Input placeholder="https://example.com/logo.png" value={getValue('email_logo_url')} onChange={e => setForm(p => ({ ...p, email_logo_url: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Appears at the top of every email. Recommended: 200×60px</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Palette className="h-4 w-4" /> Brand Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  className="w-12 h-10 p-1 cursor-pointer"
                  value={getValue('email_brand_color') || '#1a365d'}
                  onChange={e => setForm(p => ({ ...p, email_brand_color: e.target.value }))}
                />
                <Input
                  placeholder="#1a365d"
                  value={getValue('email_brand_color') || '#1a365d'}
                  onChange={e => setForm(p => ({ ...p, email_brand_color: e.target.value }))}
                />
              </div>
              <p className="text-xs text-muted-foreground">Used for email header background and buttons</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Footer Text</Label>
            <Textarea
              placeholder="© 2026 Online Textile School. All rights reserved.&#10;Dhaka, Bangladesh"
              rows={3}
              value={getValue('email_footer_text')}
              onChange={e => setForm(p => ({ ...p, email_footer_text: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Globe className="h-4 w-4" /> Website URL</Label>
              <Input placeholder="https://onlinetextileschool.com" value={getValue('email_website_url')} onChange={e => setForm(p => ({ ...p, email_website_url: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Facebook URL</Label>
              <Input placeholder="https://facebook.com/..." value={getValue('email_facebook_url')} onChange={e => setForm(p => ({ ...p, email_facebook_url: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>YouTube URL</Label>
              <Input placeholder="https://youtube.com/..." value={getValue('email_youtube_url')} onChange={e => setForm(p => ({ ...p, email_youtube_url: e.target.value }))} />
            </div>
          </div>

          {/* Logo Preview */}
          {getValue('email_logo_url') && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <p className="text-sm font-medium mb-2">Logo Preview:</p>
              <img src={getValue('email_logo_url')} alt="Email logo preview" className="max-h-16 object-contain" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Shield className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save All Settings'}
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={testing}>
          <Send className="h-4 w-4 mr-2" />
          {testing ? 'Sending...' : 'Send Test Email'}
        </Button>
      </div>
    </div>
  );
};

export default SmtpSettingsTab;
