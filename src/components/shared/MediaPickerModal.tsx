import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Upload, Search, Image, FileText, Film, Loader2, File, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { handleImgError } from '@/lib/cloudinaryUrl';
import { useRef } from 'react';

type MediaItem = {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string | null;
};

type FilterType = 'all' | 'image' | 'document' | 'video';

interface MediaPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  accept?: string;
}

const MediaPickerModal = ({ open, onClose, onSelect, accept }: MediaPickerModalProps) => {
  const [tab, setTab] = useState<string>('upload');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const { upload, uploading, progress } = useFileUpload();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('media_library')
      .select('id, file_url, file_name, file_type, file_size, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    setMedia((data as MediaItem[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      fetchMedia();
      setSelected(null);
      setSearch('');
      setFilter('all');
      setTab('upload');
    }
  }, [open, fetchMedia]);

  const handleUpload = async (file: File) => {
    try {
      const result = await upload(file);
      // Save to media_library
      await supabase.from('media_library').upsert({
        file_url: result.url,
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
        uploaded_by: user?.id || null,
      }, { onConflict: 'file_url' });
      toast.success('Uploaded!');
      onSelect(result.url);
      onClose();
    } catch {
      // error already toasted
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const filteredMedia = media.filter((item) => {
    const type = item.file_type || '';
    if (filter === 'image' && !type.startsWith('image/')) return false;
    if (filter === 'document' && !type.includes('pdf') && !type.includes('document') && !type.includes('spreadsheet') && !type.includes('presentation') && !type.includes('text/')) return false;
    if (filter === 'video' && !type.startsWith('video/')) return false;
    if (search && !item.file_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const isImage = (type: string | null) => type?.startsWith('image/');

  const handleSelect = () => {
    if (selected) {
      onSelect(selected.file_url);
      onClose();
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle>Select Media</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-2 w-fit">
            <TabsTrigger value="upload" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Upload Files
            </TabsTrigger>
            <TabsTrigger value="library" className="gap-1.5">
              <Image className="h-3.5 w-3.5" /> Media Library
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="flex-1 p-4">
            <div
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFileChange} />
              {uploading ? (
                <div className="space-y-3">
                  <Loader2 className="h-10 w-10 mx-auto animate-spin text-muted-foreground" />
                  <Progress value={progress} className="h-2 max-w-[240px] mx-auto" />
                  <p className="text-sm text-muted-foreground">Uploading... {progress}%</p>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Drag & drop or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Supports images, PDFs, videos, documents</p>
                </>
              )}
            </div>
          </TabsContent>

          {/* Media Library Tab */}
          <TabsContent value="library" className="flex-1 flex flex-col min-h-0 px-4 pb-0 gap-3">
            {/* Filters + Search */}
            <div className="flex flex-wrap items-center gap-2">
              {([
                ['all', 'All', null],
                ['image', 'Image', Image],
                ['document', 'Document', FileText],
                ['video', 'Video', Film],
              ] as [FilterType, string, any][]).map(([key, label, Icon]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={filter === key ? 'default' : 'outline'}
                  className="h-7 text-xs gap-1"
                  onClick={() => setFilter(key)}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {label}
                </Button>
              ))}
              <div className="relative ml-auto flex-1 min-w-[140px] max-w-[220px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="h-7 text-xs pl-7"
                />
              </div>
            </div>

            {/* Grid */}
            <ScrollArea className="flex-1 min-h-0 max-h-[340px]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMedia.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  No media found
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pb-2">
                  {filteredMedia.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelected(selected?.id === item.id ? null : item)}
                      className={`relative aspect-square rounded-md border overflow-hidden group transition-all ${
                        selected?.id === item.id
                          ? 'ring-2 ring-primary border-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {isImage(item.file_type) ? (
                        <img
                          src={item.file_url}
                          alt={item.file_name}
                          className="w-full h-full object-cover"
                          onError={(e) => handleImgError(e)}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30 p-1">
                          <File className="h-6 w-6 text-muted-foreground mb-1" />
                          <span className="text-[10px] text-muted-foreground truncate w-full text-center px-1">
                            {item.file_name}
                          </span>
                        </div>
                      )}
                      {/* Size badge */}
                      {item.file_size && (
                        <span className="absolute bottom-0.5 right-0.5 bg-background/80 text-[9px] px-1 rounded">
                          {formatSize(item.file_size)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="p-3 border-t gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          {tab === 'library' && (
            <Button size="sm" disabled={!selected} onClick={handleSelect}>
              Select
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MediaPickerModal;
