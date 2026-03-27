import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

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
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const def of DEFAULT_KEYS) {
        const existing = settings?.find((s) => s.key === def.key);
        const value = formData[def.key] ?? '';
        if (existing) {
          await supabase.from('site_settings').update({ value, updated_at: new Date().toISOString() }).eq('id', existing.id);
        } else {
          await supabase.from('site_settings').insert({ key: def.key, value });
        }
      }
      await supabase.from('admin_activity_log' as any).insert({ admin_id: user!.id, action: 'Updated site settings', target_type: 'settings', target_id: 'global' });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-site-settings'] }); toast.success('Settings saved'); },
    onError: () => toast.error('Failed to save settings'),
  });

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold">Site Settings</h2>

      <Card>
        <CardHeader><CardTitle>General Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
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
    </div>
  );
};

export default AdminSettings;
