import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFileUpload } from '@/hooks/useFileUpload';
import { handleImgError } from '@/lib/cloudinaryUrl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Upload as UploadIcon, Search, Trash2, Copy, Grid, List, Image as ImageIcon, File, ExternalLink, Download, Info } from 'lucide-react';

const AdminMedia = () => {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { upload: fileUpload } = useFileUpload();

  const { data: media = [], isLoading } = useQuery({
    queryKey: ['admin-media'],
    queryFn: async () => {
      const { data } = await supabase
        .from('media_library')
        .select('*')
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: any) => {
      await supabase.from('media_library').delete().eq('id', item.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-media'] });
      toast.success('File deleted');
      setSelectedMedia(null);
    },
    onError: () => toast.error('Failed to delete'),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      try {
        const result = await fileUpload(file);

        await supabase.from('media_library').insert({
          file_url: result.url,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user?.id,
        });
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['admin-media'] });
    toast.success('Upload complete');
    setUploading(false);
    e.target.value = '';
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied!');
  };

  const openUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const filtered = media.filter((m: any) =>
    !search || m.file_name?.toLowerCase().includes(search.toLowerCase())
  );

  const isImage = (type: string) => type?.startsWith('image/');
  const getFileExtension = (fileName?: string) => fileName?.split('.').pop()?.toUpperCase() || 'FILE';
  const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-heading text-2xl font-bold">Media Library</h2>
        <label>
          <input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" className="hidden" onChange={handleUpload} />
          <Button asChild disabled={uploading}>
            <span><UploadIcon className="h-4 w-4 mr-2" />{uploading ? 'Uploading...' : 'Upload Files'}</span>
          </Button>
        </label>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search files..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex border rounded-md">
          <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" onClick={() => setViewMode('grid')}><Grid className="h-4 w-4" /></Button>
          <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" onClick={() => setViewMode('list')}><List className="h-4 w-4" /></Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-center py-12 text-muted-foreground">Loading media...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ImageIcon className="h-16 w-16 mx-auto mb-4 text-muted" />
          <p className="text-muted-foreground">No media files yet. Upload some!</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((item: any) => (
            <Card key={item.id} className="overflow-hidden cursor-pointer hover:ring-2 ring-primary transition-all" onClick={() => setSelectedMedia(item)}>
              <div className="aspect-square bg-muted flex items-center justify-center">
                {isImage(item.file_type) ? (
                  <img src={item.file_url} alt={item.alt_text || item.file_name} className="w-full h-full object-cover" onError={(e) => handleImgError(e)} />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <File className="h-10 w-10" />
                    <span className="rounded-md bg-background/80 px-2 py-1 text-[10px] font-medium tracking-wide">
                      {getFileExtension(item.file_name)}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs truncate">{item.file_name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(item.file_size)}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item: any) => (
            <div key={item.id} className="flex items-center gap-3 bg-card border rounded-lg p-3 cursor-pointer hover:bg-muted/50" onClick={() => setSelectedMedia(item)}>
              <div className="w-12 h-12 bg-muted rounded flex items-center justify-center shrink-0">
                {isImage(item.file_type) ? (
                  <img src={item.file_url} alt="" className="w-full h-full object-cover rounded" onError={(e) => handleImgError(e)} />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <File className="h-5 w-5" />
                    <span className="text-[9px] font-medium leading-none">{getFileExtension(item.file_name)}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.file_name}</p>
                <p className="text-xs text-muted-foreground">{item.file_type} • {formatSize(item.file_size)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); copyUrl(item.file_url); }}><Copy className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedMedia} onOpenChange={(o) => !o && setSelectedMedia(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Media Details</DialogTitle></DialogHeader>
          {selectedMedia && (
            <div className="space-y-4">
              {isImage(selectedMedia.file_type) && (
                <img src={selectedMedia.file_url} alt="" className="w-full rounded-lg max-h-64 object-contain bg-muted" onError={(e) => handleImgError(e)} />
              )}
              {!isImage(selectedMedia.file_type) && (
                <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 p-6 text-center">
                  <File className="mb-3 h-12 w-12 text-muted-foreground" />
                  <p className="font-medium">{selectedMedia.file_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Preview is not generated for this file type.</p>
                </div>
              )}
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Name:</span> {selectedMedia.file_name}</p>
                <p><span className="text-muted-foreground">Type:</span> {selectedMedia.file_type || getFileExtension(selectedMedia.file_name)}</p>
                <p><span className="text-muted-foreground">Size:</span> {formatSize(selectedMedia.file_size)}</p>
              </div>
              {!isImage(selectedMedia.file_type) && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Use <span className="font-medium">Open</span> or <span className="font-medium">Download</span> below to verify the stored R2/public file directly.
                  </AlertDescription>
                </Alert>
              )}
              <Input value={selectedMedia.file_url} readOnly className="text-xs" />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button className="flex-1" onClick={() => copyUrl(selectedMedia.file_url)}>
                  <Copy className="h-4 w-4 mr-2" /> Copy URL
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => openUrl(selectedMedia.file_url)}>
                  <ExternalLink className="h-4 w-4 mr-2" /> Open
                </Button>
                <Button variant="outline" className="flex-1 sm:col-span-2" asChild>
                  <a href={selectedMedia.file_url} download={selectedMedia.file_name || true} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-2" /> Download
                  </a>
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={() => deleteMutation.mutate(selectedMedia)} disabled={deleteMutation.isPending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMedia;
