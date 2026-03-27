import { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useFileUpload } from '@/hooks/useFileUpload';
import { handleImgError } from '@/lib/cloudinaryUrl';
import { Progress } from '@/components/ui/progress';

interface MediaUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  accept?: string;
  label?: string;
  aspectRatio?: string;
}

const MediaUploader = ({ value, onChange, accept = 'image/*', label = 'Upload Image', aspectRatio }: MediaUploaderProps) => {
  const [dragOver, setDragOver] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress } = useFileUpload();

  const handleUpload = async (file: File) => {
    try {
      const result = await upload(file);
      onChange(result.url);
      if (result.fallbackUrl) setFallbackUrl(result.fallbackUrl);
      toast.success('Uploaded!');
    } catch {
      // error already toasted by hook
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  if (value) {
    return (
      <div className="relative rounded-lg overflow-hidden border bg-muted/20">
        {accept.startsWith('image') ? (
          <img
            src={value}
            alt="Preview"
            className="w-full object-cover"
            style={{ aspectRatio: aspectRatio || '16/9' }}
            onError={(e) => handleImgError(e, fallbackUrl)}
          />
        ) : (
          <div className="p-4 text-sm text-muted-foreground truncate">{value}</div>
        )}
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2 h-7 w-7"
          onClick={() => { onChange(''); setFallbackUrl(undefined); }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
        dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
      {uploading ? (
        <div className="space-y-2">
          <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
          <Progress value={progress} className="h-2 max-w-[200px] mx-auto" />
        </div>
      ) : (
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
      )}
      <p className="text-sm font-medium text-muted-foreground">{uploading ? `Uploading... ${progress}%` : label}</p>
      <p className="text-xs text-muted-foreground mt-1">Drag & drop or click to browse</p>
    </div>
  );
};

export default MediaUploader;
