import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFileUpload } from '@/hooks/useFileUpload';
import { handleImgError, cldImg } from '@/lib/cloudinaryUrl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Upload as UploadIcon, Search, Trash2, Copy, Grid, List, Image as ImageIcon, File, ExternalLink, Download, Info, CloudUpload, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

function getSourceBadge(url: string): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (!url) return { label: 'unknown', variant: 'outline' };
  if (url.includes('cloudinary.com') || url.includes('res.cloudinary')) return { label: 'Cloudinary', variant: 'default' };
  if (url.includes('/storage/v1/object/public/media/') || url.includes('supabase.co/storage')) return { label: 'Supabase (legacy)', variant: 'destructive' };
  return { label: 'R2', variant: 'secondary' };
}

const AdminMedia = () => {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [queueStatus, setQueueStatus] = useState<{ pending: number; processing: number; success: number; failed: number; total: number } | null>(null);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [liveCounts, setLiveCounts] = useState({ cloudinary: 0, r2: 0, failed: 0 });
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { upload: fileUpload } = useFileUpload();

  const refreshStatus = async () => {
    const { data } = await supabase.functions.invoke('migrate-storage-to-cloud', { body: { action: 'status' } });
    if (data) setQueueStatus(data);
    return data;
  };

  const runScan = async () => {
    setScanning(true);
    try {
      const folderQueue: string[] = [''];
      let totalInserted = 0;
      while (folderQueue.length > 0) {
        const prefix = folderQueue.shift()!;
        let offset = 0;
        while (true) {
          const { data, error } = await supabase.functions.invoke('migrate-storage-to-cloud', {
            body: { action: 'scan', prefix, offset },
          });
          if (error) throw error;
          totalInserted += data.inserted || 0;
          if (Array.isArray(data.folders)) folderQueue.push(...data.folders);
          if (!data.hasMore) break;
          offset = data.nextOffset;
        }
      }
      toast.success(`Scan complete: ${totalInserted} files queued`);
      await refreshStatus();
    } catch (err: any) {
      toast.error('Scan failed: ' + (err.message || 'Unknown'));
    } finally {
      setScanning(false);
    }
  };

  const runMigration = async () => {
    if (!confirm('Migrate queued legacy files? Images go to Cloudinary, others to Cloudflare R2. Originals will be DELETED from Supabase.')) return;
    setMigrating(true);
    setStopRequested(false);
    setLiveCounts({ cloudinary: 0, r2: 0, failed: 0 });
    try {
      while (true) {
        if (stopRequested) break;
        const { data, error } = await supabase.functions.invoke('migrate-storage-to-cloud', {
          body: { action: 'migrate-next', deleteOriginals: true },
        });
        if (error) throw error;
        if (data?.done) break;
        const p = data?.processed;
        if (p) {
          setCurrentFile(p.file || '');
          setLiveCounts((c) => ({
            cloudinary: c.cloudinary + (p.source === 'cloudinary' ? 1 : 0),
            r2: c.r2 + (p.source === 'r2' ? 1 : 0),
            failed: c.failed + (p.error ? 1 : 0),
          }));
        }
        if (Math.random() < 0.2) await refreshStatus();
      }
      await refreshStatus();
      toast.success('Migration finished');
      queryClient.invalidateQueries({ queryKey: ['admin-media'] });
    } catch (err: any) {
      toast.error('Migration error: ' + (err.message || 'Unknown'));
    } finally {
      setMigrating(false);
      setCurrentFile('');
    }
  };

  const retryFailed = async () => {
    await supabase.functions.invoke('migrate-storage-to-cloud', { body: { action: 'retry-failed' } });
    toast.success('Failed items moved back to pending');
    await refreshStatus();
  };

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

    const folder = user?.id ? `uploads/${user.id}` : 'uploads';

    for (const file of Array.from(files)) {
      try {
        const result = await fileUpload(file, { folder });

        await supabase.from('media_library').upsert({
          file_url: result.url,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user?.id,
        }, { onConflict: 'file_url' });
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['admin-media'] });
    toast.success('Upload complete');
    setUploading(false);
    e.target.value = '';
  };

  // ---------- Repair legacy & low-quality (re-import via cloudinary-proxy fetch-url) ----------
  const [repairing, setRepairing] = useState(false);
  const [repairProgress, setRepairProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [repairStop, setRepairStop] = useState(false);

  const needsRepair = (url: string) => {
    if (!url) return false;
    // Legacy Supabase Storage rows
    if (url.includes('/storage/v1/object/public/')) return true;
    // Cloudinary URL with no transform segment in /upload/
    if (/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\/v\d+\//.test(url)) return true;
    return false;
  };

  const runRepair = async () => {
    if (!confirm('Re-import legacy and low-quality images into Cloudinary with proper folders & transforms? This may take a while.')) return;
    setRepairing(true);
    setRepairStop(false);
    setRepairProgress({ done: 0, total: 0, failed: 0 });

    const { data: rows } = await supabase
      .from('media_library')
      .select('id, file_url, file_name, file_type, uploaded_by')
      .order('created_at', { ascending: false });

    const targets = (rows || []).filter((r: any) => (r.file_type || '').startsWith('image/') && needsRepair(r.file_url));
    setRepairProgress({ done: 0, total: targets.length, failed: 0 });

    for (const row of targets) {
      if (repairStop) break;
      try {
        const folder = row.uploaded_by ? `uploads/${row.uploaded_by}` : 'uploads';
        const { data, error } = await supabase.functions.invoke('cloudinary-proxy', {
          body: {
            action: 'fetch-url',
            remote_url: row.file_url,
            file_name: row.file_name,
            file_type: row.file_type,
            folder,
          },
        });
        if (error || data?.error || !data?.url) throw new Error(data?.error || error?.message || 'fetch-url failed');

        await supabase.from('media_library').update({ file_url: data.url }).eq('id', row.id);
        setRepairProgress((p) => ({ ...p, done: p.done + 1 }));
      } catch {
        setRepairProgress((p) => ({ ...p, done: p.done + 1, failed: p.failed + 1 }));
      }
    }

    setRepairing(false);
    queryClient.invalidateQueries({ queryKey: ['admin-media'] });
    toast.success('Repair finished');
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
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={runRepair} disabled={repairing || uploading}>
            {repairing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CloudUpload className="h-4 w-4 mr-2" />}
            {repairing ? `Repairing ${repairProgress.done}/${repairProgress.total}…` : 'Repair legacy & low-quality'}
          </Button>
          {repairing && (
            <Button variant="destructive" size="sm" onClick={() => setRepairStop(true)}>Stop</Button>
          )}
          <label>
            <input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" className="hidden" onChange={handleUpload} />
            <Button asChild disabled={uploading}>
              <span><UploadIcon className="h-4 w-4 mr-2" />{uploading ? 'Uploading...' : 'Upload Files'}</span>
            </Button>
          </label>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Routing rule:</strong> Images always go to <strong>Cloudinary</strong>. All other files always go to <strong>Cloudflare R2</strong>. Supabase Storage is never used for new uploads.
        </AlertDescription>
      </Alert>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold">Legacy Supabase Migration</h3>
            <p className="text-xs text-muted-foreground">Step 1: scan to queue files. Step 2: process the queue one by one.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={runScan} disabled={scanning || migrating}>
              {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              {scanning ? 'Scanning...' : '1. Scan legacy'}
            </Button>
            <Button variant="outline" size="sm" onClick={refreshStatus} disabled={scanning || migrating}>
              Refresh status
            </Button>
            {!migrating ? (
              <Button size="sm" onClick={runMigration} disabled={scanning || !queueStatus?.pending}>
                <CloudUpload className="h-4 w-4 mr-2" />
                2. Migrate ({queueStatus?.pending ?? 0} pending)
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => setStopRequested(true)}>
                Stop
              </Button>
            )}
            {!!queueStatus?.failed && (
              <Button size="sm" variant="ghost" onClick={retryFailed} disabled={migrating}>
                Retry {queueStatus.failed} failed
              </Button>
            )}
          </div>
        </div>
        {queueStatus && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div className="bg-muted rounded p-2"><div className="text-muted-foreground">Total</div><div className="font-bold">{queueStatus.total}</div></div>
            <div className="bg-muted rounded p-2"><div className="text-muted-foreground">Pending</div><div className="font-bold">{queueStatus.pending}</div></div>
            <div className="bg-muted rounded p-2"><div className="text-muted-foreground">Processing</div><div className="font-bold">{queueStatus.processing}</div></div>
            <div className="bg-muted rounded p-2"><div className="text-muted-foreground">Success</div><div className="font-bold text-primary">{queueStatus.success}</div></div>
            <div className="bg-muted rounded p-2"><div className="text-muted-foreground">Failed</div><div className="font-bold text-destructive">{queueStatus.failed}</div></div>
          </div>
        )}
        {migrating && (
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> <span className="truncate">{currentFile || 'starting...'}</span></div>
            <div>This session: <strong>{liveCounts.cloudinary}</strong> → Cloudinary, <strong>{liveCounts.r2}</strong> → R2, <strong className="text-destructive">{liveCounts.failed}</strong> failed</div>
          </div>
        )}
      </Card>

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
              <div className="aspect-square bg-muted/30 flex items-center justify-center">
                {isImage(item.file_type) ? (
                  <img src={cldImg(item.file_url, { w: 320, c: 'fill', g: 'auto' })} alt={item.alt_text || item.file_name} className="w-full h-full object-contain" loading="lazy" onError={(e) => handleImgError(e)} />
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
                <div className="flex items-center justify-between gap-1 mt-1">
                  <p className="text-xs text-muted-foreground">{formatSize(item.file_size)}</p>
                  <Badge variant={getSourceBadge(item.file_url).variant} className="text-[9px] px-1 py-0 h-4">
                    {getSourceBadge(item.file_url).label}
                  </Badge>
                </div>
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
                  <img src={cldImg(item.file_url, { w: 96, c: 'fill', g: 'auto' })} alt="" className="w-full h-full object-cover rounded" loading="lazy" onError={(e) => handleImgError(e)} />
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
                <img src={cldImg(selectedMedia.file_url, { w: 1200, c: 'limit' })} alt="" className="w-full rounded-lg max-h-64 object-contain bg-muted" onError={(e) => handleImgError(e)} />
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
