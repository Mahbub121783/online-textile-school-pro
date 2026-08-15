import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Building2, ImagePlus, Loader2, Globe, Trash2, Image as ImageIcon } from 'lucide-react';

const MyCampusPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<any>(null);
  const { upload: uploadFile, uploading: logoUploading } = useFileUpload();
  const { upload: uploadGalleryFile, uploading: galleryUploading } = useFileUpload();

  const { data: campus, isLoading } = useQuery({
    queryKey: ['my-owned-campus-full', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campus_onboard_requests')
        .select('*')
        .eq('submitted_by', user!.id)
        .eq('status', 'approved')
        .maybeSingle();
      if (error) throw error;
      if (data && !form) {
        setForm({
          campus_name: data.campus_name, area: data.area, facilities: data.facilities || '',
          description: data.description || '', student_count: data.student_count ?? '',
          departments: (data.departments || []).join(', '),
          contact_name: data.contact_name, contact_email: data.contact_email, contact_phone: data.contact_phone || '',
          logo_url: data.logo_url || null,
        });
      }
      return data;
    },
  });

  const { data: gallery = [] } = useQuery({
    queryKey: ['campus-gallery', campus?.id],
    enabled: !!campus?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campus_gallery_images')
        .select('*')
        .eq('campus_id', campus!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (fields: any) => {
      const { error } = await supabase.functions.invoke('campus-update', { body: { id: campus.id, ...fields } });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-owned-campus-full'] });
      queryClient.invalidateQueries({ queryKey: ['campus-portfolio'] });
      toast.success('Campus details updated');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addGalleryImage = useMutation({
    mutationFn: async (url: string) => {
      const { error } = await supabase.from('campus_gallery_images').insert({
        campus_id: campus.id, image_url: url, uploaded_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campus-gallery', campus.id] });
      toast.success('Photo added to gallery');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteGalleryImage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campus_gallery_images').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campus-gallery', campus.id] });
      toast.success('Photo removed');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadFile(file, { folder: 'campus-logos' });
      setForm((p: any) => ({ ...p, logo_url: result.url }));
    } catch (err: any) {
      toast.error(err.message || 'Logo upload failed');
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadGalleryFile(file, { folder: 'campus-gallery' });
      addGalleryImage.mutate(result.url);
    } catch (err: any) {
      toast.error(err.message || 'Photo upload failed');
    }
  };

  const save = () => {
    saveMutation.mutate({
      ...form,
      student_count: form.student_count === '' ? null : parseInt(form.student_count, 10),
      departments: String(form.departments || '').split(',').map((d: string) => d.trim()).filter(Boolean),
    });
  };

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!campus || !form) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
        You don't have an approved campus request yet.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Campus Onboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your campus's public portfolio.</p>
        </div>
        <a
          href={`https://${campus.subdomain_slug}.onlinetextileschool.com`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-primary text-sm hover:underline"
        >
          <Globe className="h-4 w-4" /> View live portfolio
        </a>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Hero & Details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg border overflow-hidden bg-muted/30 flex items-center justify-center shrink-0">
                {form.logo_url ? <img src={form.logo_url} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
              </div>
              <Input type="file" accept="image/*" onChange={handleLogoUpload} disabled={logoUploading} className="text-xs" />
            </div>
          </div>
          <div className="space-y-1.5"><Label>Campus Name</Label><Input value={form.campus_name} onChange={(e) => setForm((p: any) => ({ ...p, campus_name: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Area</Label><Input value={form.area} onChange={(e) => setForm((p: any) => ({ ...p, area: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Student Count</Label><Input type="number" value={form.student_count} onChange={(e) => setForm((p: any) => ({ ...p, student_count: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Departments (comma-separated)</Label><Input value={form.departments} onChange={(e) => setForm((p: any) => ({ ...p, departments: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Facilities</Label><Textarea rows={3} value={form.facilities} onChange={(e) => setForm((p: any) => ({ ...p, facilities: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm((p: any) => ({ ...p, description: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Contact Name</Label><Input value={form.contact_name} onChange={(e) => setForm((p: any) => ({ ...p, contact_name: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Contact Email</Label><Input value={form.contact_email} onChange={(e) => setForm((p: any) => ({ ...p, contact_email: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Contact Phone</Label><Input value={form.contact_phone} onChange={(e) => setForm((p: any) => ({ ...p, contact_phone: e.target.value }))} /></div>
          <Button onClick={save} disabled={saveMutation.isPending} className="w-full">
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Gallery</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Photos added here (by you or students linked to this campus) show on your public portfolio.</p>
          <Input type="file" accept="image/*" onChange={handleGalleryUpload} disabled={galleryUploading} className="text-xs" />
          {gallery.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
              {gallery.map((g: any) => (
                <div key={g.id} className="relative aspect-square rounded-lg overflow-hidden border group">
                  <img src={g.image_url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => { if (confirm('Remove this photo?')) deleteGalleryImage.mutate(g.id); }}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyCampusPage;
