import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CreditCard, Save, Upload } from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';

export default function AdminIdCardSettings() {
  const qc = useQueryClient();
  const { upload, uploading } = useFileUpload();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['id-card-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('id_card_settings').select('*').limit(1).single();
      return data;
    },
  });

  const [form, setForm] = useState({
    university_name: '',
    location: '',
    authority_name: '',
    authority_position: '',
    signature_url: '',
    logo_url: '',
    card_bg_color: '#1a365d',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        university_name: settings.university_name || '',
        location: settings.location || '',
        authority_name: settings.authority_name || '',
        authority_position: settings.authority_position || '',
        signature_url: settings.signature_url || '',
        logo_url: settings.logo_url || '',
        card_bg_color: settings.card_bg_color || '#1a365d',
      });
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      if (!settings?.id) throw new Error('No settings row found');
      const { error } = await supabase.from('id_card_settings').update({
        ...form,
        updated_at: new Date().toISOString(),
      }).eq('id', settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('ID Card settings saved');
      qc.invalidateQueries({ queryKey: ['id-card-settings'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleImageUpload = async (field: 'logo_url' | 'signature_url', file: File) => {
    const result = await upload(file);
    if (result?.url) {
      setForm(f => ({ ...f, [field]: result.url }));
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading settings...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6" /> ID Card Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Configure the student ID card appearance and authority details</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">University Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>University Name</Label>
              <Input value={form.university_name} onChange={e => setForm(f => ({ ...f, university_name: e.target.value }))} />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div>
              <Label>Card Background Color</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={form.card_bg_color} onChange={e => setForm(f => ({ ...f, card_bg_color: e.target.value }))} className="w-10 h-10 rounded cursor-pointer" />
                <Input value={form.card_bg_color} onChange={e => setForm(f => ({ ...f, card_bg_color: e.target.value }))} className="flex-1" />
              </div>
            </div>
            <div>
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                {form.logo_url && <img src={form.logo_url} className="h-12 w-12 object-contain border rounded" alt="Logo" />}
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" className="gap-1" asChild><span><Upload className="h-3.5 w-3.5" /> Upload Logo</span></Button>
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload('logo_url', e.target.files[0])} />
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Authority / Signature</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Authority Name</Label>
              <Input value={form.authority_name} onChange={e => setForm(f => ({ ...f, authority_name: e.target.value }))} placeholder="e.g. Dr. Mohammad Rahman" />
            </div>
            <div>
              <Label>Authority Position</Label>
              <Input value={form.authority_position} onChange={e => setForm(f => ({ ...f, authority_position: e.target.value }))} placeholder="e.g. Director, OTS" />
            </div>
            <div>
              <Label>Signature Image</Label>
              <div className="flex items-center gap-3">
                {form.signature_url && <img src={form.signature_url} className="h-10 object-contain border rounded px-2" alt="Signature" />}
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" className="gap-1" asChild><span><Upload className="h-3.5 w-3.5" /> Upload Signature</span></Button>
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload('signature_url', e.target.files[0])} />
                </label>
              </div>
            </div>
            {/* Live Signature Preview */}
            {(form.signature_url || form.authority_name) && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-3 font-medium">Preview on ID Card</p>
                <div className="flex flex-col items-center gap-1">
                  {form.signature_url && (
                    <img src={form.signature_url} className="h-8 object-contain" alt="Signature preview" />
                  )}
                  <div className="w-24 h-px bg-border" />
                  <p className="text-xs font-semibold">{form.authority_name || 'Authority Name'}</p>
                  <p className="text-[10px] text-muted-foreground">{form.authority_position || 'Position'}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Button onClick={() => save.mutate()} disabled={save.isPending || uploading} className="gap-2">
        <Save className="h-4 w-4" />
        {save.isPending ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  );
}
