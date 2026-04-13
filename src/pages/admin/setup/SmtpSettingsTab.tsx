import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Mail, Server, Shield, Send } from 'lucide-react';

const SMTP_KEYS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_encryption', 'smtp_from_email', 'smtp_from_name'] as const;

const SmtpSettingsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['smtp-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('site_settings').select('*').in('key', [...SMTP_KEYS]);
      const map: Record<string, string> = {};
      data?.forEach((s: any) => { map[s.key] = s.value ?? ''; });
      return map;
    },
  });

  const [form, setForm] = useState<Record<string, string>>({});

  const getValue = (key: string) => form[key] ?? settings?.[key] ?? '';

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const key of SMTP_KEYS) {
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
      toast({ title: 'SMTP settings saved successfully' });
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-primary" /> SMTP Server</CardTitle>
          <CardDescription>Configure your outgoing mail server for transactional emails</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>SMTP Host</Label>
            <Input placeholder="smtp.gmail.com" value={getValue('smtp_host')} onChange={e => setForm(p => ({ ...p, smtp_host: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Port</Label>
            <Input placeholder="587" value={getValue('smtp_port')} onChange={e => setForm(p => ({ ...p, smtp_port: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input placeholder="your@email.com" value={getValue('smtp_user')} onChange={e => setForm(p => ({ ...p, smtp_user: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" placeholder="••••••••" value={getValue('smtp_pass')} onChange={e => setForm(p => ({ ...p, smtp_pass: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Encryption</Label>
            <Select value={getValue('smtp_encryption') || 'tls'} onValueChange={v => setForm(p => ({ ...p, smtp_encryption: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tls">TLS</SelectItem>
                <SelectItem value="ssl">SSL</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /> Sender Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>From Email</Label>
            <Input placeholder="noreply@yourdomain.com" value={getValue('smtp_from_email')} onChange={e => setForm(p => ({ ...p, smtp_from_email: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>From Name</Label>
            <Input placeholder="Online Textile School" value={getValue('smtp_from_name')} onChange={e => setForm(p => ({ ...p, smtp_from_name: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Shield className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save SMTP Settings'}
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={testing}>
          <Send className="h-4 w-4 mr-2" />
          {testing ? 'Sending...' : 'Test Connection'}
        </Button>
      </div>
    </div>
  );
};

export default SmtpSettingsTab;
