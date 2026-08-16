import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import ImageCropUpload from '@/components/shared/ImageCropUpload';
import GallerySlider from '@/components/campus/GallerySlider';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Shirt, Loader2, PackageCheck, Package, CheckCircle2, Image as ImageIcon } from 'lucide-react';

interface FabricLibrarySectionProps {
  campusId: string;
  /** 'manage' = campus owner or admin (edit summary/cover/status, confirm receipt, upload photos). 'public' = read-only. */
  mode: 'manage' | 'public';
}

const statusColors: Record<string, string> = {
  ongoing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

/**
 * A campus's Fabric Library: status/summary/cover (admin starts it, owner or
 * admin maintain it after that -- db/56), the hangers distributed to this
 * campus with a receipt-confirmation action, and a progress photo gallery.
 * Same manage/public dual-mode shape as NoticeBoard.tsx.
 */
const FabricLibrarySection = ({ campusId, mode }: FabricLibrarySectionProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { upload: uploadPhoto, uploading, progress } = useFileUpload();
  const [summaryDraft, setSummaryDraft] = useState('');

  const { data: library, isLoading } = useQuery({
    queryKey: ['fabric-library', campusId],
    enabled: !!campusId,
    refetchInterval: 45000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase.from('campus_fabric_libraries').select('*').eq('campus_id', campusId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (library) setSummaryDraft(library.summary || '');
  }, [library?.id, library?.summary]);

  const { data: distributions = [] } = useQuery({
    queryKey: ['fabric-distributions', campusId],
    enabled: !!campusId && !!library,
    refetchInterval: 45000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campus_fabric_hanger_distributions')
        .select('*, hanger:fabric_hangers(name, fabric_type)')
        .eq('campus_id', campusId)
        .order('distributed_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: photos = [] } = useQuery({
    queryKey: ['fabric-library-photos', campusId],
    enabled: !!campusId && !!library,
    refetchInterval: 45000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campus_fabric_library_photos')
        .select('*')
        .eq('campus_id', campusId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['fabric-library', campusId] });
    queryClient.invalidateQueries({ queryKey: ['fabric-distributions', campusId] });
    queryClient.invalidateQueries({ queryKey: ['fabric-library-photos', campusId] });
  };

  const updateMutation = useMutation({
    mutationFn: async (fields: Record<string, any>) => {
      const { error } = await supabase.functions.invoke('fabric-library-update', { body: { id: library.id, ...fields } });
      if (error) throw error;
    },
    onSuccess: invalidateAll,
    onError: (e: any) => toast.error(e.message),
  });

  const confirmReceivedMutation = useMutation({
    mutationFn: async (distId: string) => {
      const { error } = await supabase
        .from('campus_fabric_hanger_distributions')
        .update({ received_at: new Date().toISOString(), received_confirmed_by: user!.id })
        .eq('id', distId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fabric-distributions', campusId] });
      toast.success('Receipt confirmed');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addPhotoMutation = useMutation({
    mutationFn: async (url: string) => {
      const { error } = await supabase.from('campus_fabric_library_photos').insert({
        campus_id: campusId, image_url: url, uploaded_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fabric-library-photos', campusId] });
      toast.success('Photo added');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campus_fabric_library_photos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fabric-library-photos', campusId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const result = await uploadPhoto(file, { folder: 'fabric-library' });
      addPhotoMutation.mutate(result.url);
    } catch (err: any) {
      toast.error(err.message || 'Photo upload failed');
    }
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />;

  if (!library) {
    if (mode === 'public') return null;
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2 py-2">
        <Shirt className="h-4 w-4" /> OTS hasn't started a Fabric Library at your campus yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-heading font-bold flex items-center gap-2"><Shirt className="h-4 w-4" /> Fabric Library</h3>
        <div className="flex items-center gap-2">
          <Badge className={`${statusColors[library.status]} capitalize`}>{library.status}</Badge>
          {mode === 'manage' && (
            <Button
              type="button" size="sm" variant="outline"
              onClick={() => updateMutation.mutate({ status: library.status === 'completed' ? 'ongoing' : 'completed' })}
              disabled={updateMutation.isPending}
            >
              {library.status === 'completed' ? <><Package className="h-3.5 w-3.5 mr-1.5" /> Reopen as Ongoing</> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark Completed</>}
            </Button>
          )}
        </div>
      </div>

      {mode === 'manage' && (
        <div className="space-y-1.5">
          <ImageCropUpload
            value={library.cover_image_url} onChange={(url) => updateMutation.mutate({ cover_image_url: url })}
            aspect={3} shape="banner" folder="fabric-library" label="Cover Photo"
          />
        </div>
      )}
      {mode === 'public' && library.cover_image_url && (
        <img src={library.cover_image_url} alt="" className="w-full aspect-[3/1] object-cover rounded-xl border" />
      )}

      {mode === 'manage' ? (
        <div className="space-y-1.5">
          <Textarea rows={3} placeholder="Progress notes / summary..." value={summaryDraft} onChange={(e) => setSummaryDraft(e.target.value)} />
          <Button
            type="button" size="sm"
            onClick={() => updateMutation.mutate({ summary: summaryDraft })}
            disabled={updateMutation.isPending || summaryDraft === (library.summary || '')}
          >
            {updateMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save Summary
          </Button>
        </div>
      ) : (
        library.summary && <p className="text-sm text-foreground/80 whitespace-pre-wrap">{library.summary}</p>
      )}

      {distributions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hangers Received</p>
          {distributions.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{d.quantity}x {d.hanger?.name || 'Fabric hanger'}</p>
                <p className="text-xs text-muted-foreground">Sent {format(new Date(d.distributed_at), 'dd MMM yyyy')}{d.received_at ? ` · Received ${format(new Date(d.received_at), 'dd MMM yyyy')}` : ''}</p>
              </div>
              {mode === 'manage' && !d.received_at && (
                <Button
                  type="button" size="sm" variant="outline" className="shrink-0"
                  onClick={() => confirmReceivedMutation.mutate(d.id)}
                  disabled={confirmReceivedMutation.isPending}
                >
                  <PackageCheck className="h-3.5 w-3.5 mr-1.5" /> Confirm Received
                </Button>
              )}
              {d.received_at && <Badge variant="outline" className="text-[10px] shrink-0">Received</Badge>}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Setup Photos</p>
        {mode === 'manage' && (
          <>
            <Input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} className="text-xs" />
            {uploading && (
              <div className="space-y-1">
                <Progress value={progress} className="h-1.5 max-w-[200px]" />
                <p className="text-xs text-muted-foreground">Uploading... {progress}%</p>
              </div>
            )}
          </>
        )}
        {photos.length > 0 ? (
          <GallerySlider
            images={photos}
            onDelete={mode === 'manage' ? (id) => { if (confirm('Remove this photo?')) deletePhotoMutation.mutate(id); } : undefined}
            deletingId={deletePhotoMutation.isPending ? deletePhotoMutation.variables : null}
          />
        ) : (
          mode === 'manage' && <p className="text-xs text-muted-foreground">No setup photos yet.</p>
        )}
      </div>
    </div>
  );
};

export default FabricLibrarySection;
