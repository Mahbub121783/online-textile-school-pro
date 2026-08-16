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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Building2, Loader2, Globe, Image as ImageIcon } from 'lucide-react';
import ImageCropUpload from '@/components/shared/ImageCropUpload';
import GallerySlider from '@/components/campus/GallerySlider';
import NoticeBoard from '@/components/campus/NoticeBoard';
import FabricLibrarySection from '@/components/campus/FabricLibrarySection';
import OwnershipTransferCard from '@/components/campus/OwnershipTransferCard';
import { useCampusRealtime } from '@/hooks/useCampusRealtime';

const CAMPUS_TYPES = ['University', 'College', 'Institute', 'Training Center', 'School'];

const MyCampusPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<any>(null);
  const { upload: uploadGalleryFile, uploading: galleryUploading, progress: galleryProgress } = useFileUpload();

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
          cover_image_url: data.cover_image_url || null,
          established_year: data.established_year ?? '', website_url: data.website_url || '',
          full_address: data.full_address || '', campus_type: data.campus_type || '',
          highlights: (data.highlights || []).join(', '),
          principal_name: data.principal_name || '', principal_designation: data.principal_designation || '',
          principal_photo_url: data.principal_photo_url || null,
          principal_phone: data.principal_phone || '', principal_email: data.principal_email || '',
        });
      }
      return data;
    },
  });

  const { data: gallery = [] } = useQuery({
    queryKey: ['campus-gallery', campus?.id],
    enabled: !!campus?.id,
    refetchInterval: 45000,
    refetchIntervalInBackground: false,
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

  useCampusRealtime(campus?.id);

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
      established_year: form.established_year === '' ? null : parseInt(form.established_year, 10),
      highlights: String(form.highlights || '').split(',').map((h: string) => h.trim()).filter(Boolean),
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold">Campus Onboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your campus's public portfolio.</p>
        </div>
        <a
          href={`https://${campus.subdomain_slug}.onlinetextileschool.com`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-primary text-sm hover:underline shrink-0"
        >
          <Globe className="h-4 w-4" /> View live portfolio
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Hero & Details</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-start">
                <div className="space-y-1.5">
                  <Label>Cover Photo</Label>
                  <ImageCropUpload value={form.cover_image_url} onChange={(url) => setForm((p: any) => ({ ...p, cover_image_url: url }))} aspect={3} shape="banner" folder="campus-covers" label="Cover Photo" />
                  <p className="text-xs text-muted-foreground">Wide banner shown at the top of your public portfolio.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Logo</Label>
                  <ImageCropUpload value={form.logo_url} onChange={(url) => setForm((p: any) => ({ ...p, logo_url: url }))} aspect={1} shape="square" folder="campus-logos" label="Logo" previewClassName="w-24 h-24" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Campus Name</Label><Input value={form.campus_name} onChange={(e) => setForm((p: any) => ({ ...p, campus_name: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Area</Label><Input value={form.area} onChange={(e) => setForm((p: any) => ({ ...p, area: e.target.value }))} /></div>
                <div className="space-y-1.5">
                  <Label>Campus Type</Label>
                  <Select value={form.campus_type || ''} onValueChange={(v) => setForm((p: any) => ({ ...p, campus_type: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>{CAMPUS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Established Year</Label><Input type="number" value={form.established_year} onChange={(e) => setForm((p: any) => ({ ...p, established_year: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Website</Label><Input type="url" value={form.website_url} onChange={(e) => setForm((p: any) => ({ ...p, website_url: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Student Count</Label><Input type="number" value={form.student_count} onChange={(e) => setForm((p: any) => ({ ...p, student_count: e.target.value }))} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Departments (comma-separated)</Label><Input value={form.departments} onChange={(e) => setForm((p: any) => ({ ...p, departments: e.target.value }))} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Highlights (comma-separated)</Label><Input value={form.highlights} onChange={(e) => setForm((p: any) => ({ ...p, highlights: e.target.value }))} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Full Address</Label><Textarea rows={2} value={form.full_address} onChange={(e) => setForm((p: any) => ({ ...p, full_address: e.target.value }))} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Facilities</Label><Textarea rows={3} value={form.facilities} onChange={(e) => setForm((p: any) => ({ ...p, facilities: e.target.value }))} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm((p: any) => ({ ...p, description: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Contact Name</Label><Input value={form.contact_name} onChange={(e) => setForm((p: any) => ({ ...p, contact_name: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Contact Email</Label><Input value={form.contact_email} onChange={(e) => setForm((p: any) => ({ ...p, contact_email: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Contact Phone</Label><Input value={form.contact_phone} onChange={(e) => setForm((p: any) => ({ ...p, contact_phone: e.target.value }))} /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Principal / Vice Chancellor</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <ImageCropUpload value={form.principal_photo_url} onChange={(url) => setForm((p: any) => ({ ...p, principal_photo_url: url }))} aspect={1} shape="circle" folder="campus-principal" label="Photo" previewClassName="w-20 h-20" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Name</Label><Input value={form.principal_name} onChange={(e) => setForm((p: any) => ({ ...p, principal_name: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Designation</Label><Input value={form.principal_designation} onChange={(e) => setForm((p: any) => ({ ...p, principal_designation: e.target.value }))} placeholder="Principal / Vice Chancellor" /></div>
                <div className="space-y-1.5"><Label>Phone</Label><Input value={form.principal_phone} onChange={(e) => setForm((p: any) => ({ ...p, principal_phone: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.principal_email} onChange={(e) => setForm((p: any) => ({ ...p, principal_email: e.target.value }))} /></div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={save} disabled={saveMutation.isPending} className="w-full sm:w-auto">
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Save Changes
          </Button>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Gallery</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Photos added here (by you or students linked to this campus) show on your public portfolio.</p>
              <Input type="file" accept="image/*" onChange={handleGalleryUpload} disabled={galleryUploading} className="text-xs" />
              {galleryUploading && (
                <div className="space-y-1">
                  <Progress value={galleryProgress} className="h-1.5 max-w-[200px]" />
                  <p className="text-xs text-muted-foreground">Uploading... {galleryProgress}%</p>
                </div>
              )}
              {gallery.length > 0 && (
                <div className="pt-2">
                  <GallerySlider
                    images={gallery}
                    onDelete={(id) => { if (confirm('Remove this photo?')) deleteGalleryImage.mutate(id); }}
                    deletingId={deleteGalleryImage.isPending ? deleteGalleryImage.variables : null}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <NoticeBoard campusId={campus.id} mode="manage" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <FabricLibrarySection campusId={campus.id} mode="manage" />
            </CardContent>
          </Card>

          <OwnershipTransferCard campus={campus} />
        </div>
      </div>
    </div>
  );
};

export default MyCampusPage;
