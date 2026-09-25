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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Building2, Loader2, Globe, Image as ImageIcon, BadgeCheck, FileText, AlertTriangle, Clock, Trash2, Megaphone, CalendarDays, Shirt, Settings } from 'lucide-react';
import ImageCropUpload from '@/components/shared/ImageCropUpload';
import NoticeBoard from '@/components/campus/NoticeBoard';
import CampusEvents from '@/components/campus/CampusEvents';
import FabricLibrarySection from '@/components/campus/FabricLibrarySection';
import OwnershipTransferCard from '@/components/campus/OwnershipTransferCard';
import { useCampusRealtime } from '@/hooks/useCampusRealtime';

const CAMPUS_TYPES = ['University', 'College', 'Institute', 'Training Center', 'School'];

const MyCampusPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<any>(null);
  const [galleryCaption, setGalleryCaption] = useState('');
  const { upload: uploadGalleryFile, uploading: galleryUploading, progress: galleryProgress } = useFileUpload();
  const { upload: uploadDocFile, uploading: docUploading, progress: docProgress } = useFileUpload();

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

  const saveDocMutation = useMutation({
    mutationFn: async (url: string) => {
      const { error } = await supabase.functions.invoke('campus-update', { body: { id: campus.id, verification_doc_url: url } });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-owned-campus-full'] });
      toast.success('Verification document uploaded');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const result = await uploadDocFile(file, { folder: 'campus-verification' });
      saveDocMutation.mutate(result.url);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    }
  };

  const addGalleryImage = useMutation({
    mutationFn: async ({ url, caption }: { url: string; caption: string }) => {
      const { error } = await supabase.from('campus_gallery_images').insert({
        campus_id: campus.id, image_url: url, uploaded_by: user!.id, caption: caption.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campus-gallery', campus.id] });
      toast.success('Photo added to gallery');
      setGalleryCaption('');
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
    e.target.value = '';
    if (!file) return;
    try {
      const result = await uploadGalleryFile(file, { folder: 'campus-gallery' });
      addGalleryImage.mutate({ url: result.url, caption: galleryCaption });
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
        {campus.subdomain_provisioned ? (
          <a
            href={`https://${campus.subdomain_slug}.onlinetextileschool.com`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-primary text-sm hover:underline shrink-0"
          >
            <Globe className="h-4 w-4" /> View live portfolio
          </a>
        ) : campus.subdomain_error ? (
          <p className="flex items-center gap-1.5 text-destructive text-sm shrink-0" title={campus.subdomain_error}>
            <AlertTriangle className="h-4 w-4 shrink-0" /> Subdomain setup failed — an admin needs to retry it
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-muted-foreground text-sm shrink-0">
            <Clock className="h-4 w-4 shrink-0" /> Subdomain is still being set up
          </p>
        )}
      </div>

      <Tabs defaultValue="profile">
        <div className="w-full overflow-x-auto">
          <TabsList className="inline-flex h-auto w-max gap-1">
            <TabsTrigger value="profile" className="shrink-0"><Building2 className="h-3.5 w-3.5 mr-1.5" /> Profile</TabsTrigger>
            <TabsTrigger value="gallery" className="shrink-0"><ImageIcon className="h-3.5 w-3.5 mr-1.5" /> Gallery</TabsTrigger>
            <TabsTrigger value="notices" className="shrink-0"><Megaphone className="h-3.5 w-3.5 mr-1.5" /> Notices</TabsTrigger>
            <TabsTrigger value="events" className="shrink-0"><CalendarDays className="h-3.5 w-3.5 mr-1.5" /> Events</TabsTrigger>
            <TabsTrigger value="fabric-library" className="shrink-0"><Shirt className="h-3.5 w-3.5 mr-1.5" /> Fabric Library</TabsTrigger>
            <TabsTrigger value="settings" className="shrink-0"><Settings className="h-3.5 w-3.5 mr-1.5" /> Settings</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile" className="pt-4 space-y-6 max-w-3xl">
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
        </TabsContent>

        <TabsContent value="gallery" className="pt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Gallery</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Photos added here (by you or students linked to this campus) show as a slideshow on your public portfolio.</p>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end max-w-xl">
                <div className="space-y-1.5 flex-1">
                  <Label>Caption (optional, applies to the next upload)</Label>
                  <Input value={galleryCaption} onChange={(e) => setGalleryCaption(e.target.value)} placeholder="e.g. Annual Textile Fair 2026" />
                </div>
                <Input type="file" accept="image/*" onChange={handleGalleryUpload} disabled={galleryUploading} className="sm:w-56" />
              </div>
              {galleryUploading && (
                <div className="space-y-1 max-w-xs">
                  <Progress value={galleryProgress} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">Uploading... {galleryProgress}%</p>
                </div>
              )}
              {gallery.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No photos yet — add your first one above.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {gallery.map((g: any) => (
                    <div key={g.id} className="group relative aspect-[4/3] rounded-xl overflow-hidden border bg-muted/30">
                      <img src={g.image_url} alt={g.caption || ''} className="w-full h-full object-cover" loading="lazy" />
                      {g.caption && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                          <p className="text-white text-xs truncate">{g.caption}</p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => { if (confirm('Remove this photo?')) deleteGalleryImage.mutate(g.id); }}
                        disabled={deleteGalleryImage.isPending && deleteGalleryImage.variables === g.id}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-destructive text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100"
                        aria-label="Remove photo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notices" className="pt-4">
          <Card><CardContent className="pt-6"><NoticeBoard campusId={campus.id} mode="manage" /></CardContent></Card>
        </TabsContent>

        <TabsContent value="events" className="pt-4">
          <Card><CardContent className="pt-6"><CampusEvents campusId={campus.id} mode="manage" /></CardContent></Card>
        </TabsContent>

        <TabsContent value="fabric-library" className="pt-4">
          <Card><CardContent className="pt-6"><FabricLibrarySection campusId={campus.id} mode="manage" /></CardContent></Card>
        </TabsContent>

        <TabsContent value="settings" className="pt-4 space-y-6 max-w-2xl">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><BadgeCheck className="h-4 w-4" /> Verification</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {campus.is_verified ? (
                <p className="flex items-center gap-2 text-sm text-primary font-medium"><BadgeCheck className="h-4 w-4" /> Verified by Online Textile School</p>
              ) : (
                <p className="text-xs text-muted-foreground">Upload a verification document (accreditation, registration certificate, etc.) for OTS to review and verify your campus.</p>
              )}
              {campus.verification_doc_url && (
                <a href={campus.verification_doc_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary text-xs hover:underline">
                  <FileText className="h-3.5 w-3.5" /> View uploaded document
                </a>
              )}
              <Input type="file" onChange={handleDocUpload} disabled={docUploading} className="text-xs" />
              {docUploading && (
                <div className="space-y-1">
                  <Progress value={docProgress} className="h-1.5 max-w-[200px]" />
                  <p className="text-xs text-muted-foreground">Uploading... {docProgress}%</p>
                </div>
              )}
            </CardContent>
          </Card>

          <OwnershipTransferCard campus={campus} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MyCampusPage;
