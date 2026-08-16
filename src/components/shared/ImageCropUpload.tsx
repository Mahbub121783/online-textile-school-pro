import { useRef, useState, useCallback } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Loader2, ImagePlus, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import { useFileUpload } from '@/hooks/useFileUpload';
import { cropImageToFile } from '@/lib/cropImage';
import { cn } from '@/lib/utils';

interface ImageCropUploadProps {
  value?: string | null;
  onChange: (url: string) => void;
  /** Crop aspect ratio, width/height -- 1 for a square logo/avatar, wider (e.g. 3) for a banner. */
  aspect: number;
  folder: string;
  label: string;
  /** Cloudinary options -- used for e.g. avatars that overwrite a fixed public_id. */
  publicId?: string;
  overwrite?: boolean;
  shape?: 'circle' | 'square' | 'banner';
  className?: string;
  previewClassName?: string;
}

/**
 * Select -> crop -> confirm -> upload, with a real progress bar during the
 * actual upload. Replaces the old pattern (every campus/profile-picture
 * upload site had) of uploading the raw file the instant it was selected,
 * with no chance to frame/crop it and no visible progress.
 */
const ImageCropUpload = ({
  value, onChange, aspect, folder, label, publicId, overwrite, shape = 'square', className, previewClassName,
}: ImageCropUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress } = useFileUpload();

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPendingFile(file);
    setPendingSrc(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const closeCropDialog = () => {
    if (pendingSrc) URL.revokeObjectURL(pendingSrc);
    setPendingFile(null);
    setPendingSrc(null);
  };

  const confirmUpload = async () => {
    if (!pendingFile || !pendingSrc || !croppedAreaPixels) return;
    try {
      const croppedFile = await cropImageToFile(pendingSrc, croppedAreaPixels, pendingFile.name);
      const result = await upload(croppedFile, { folder, publicId, overwrite });
      onChange(result.url);
      closeCropDialog();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    }
  };

  const isBanner = shape === 'banner';
  const previewShapeClass = shape === 'circle' ? 'rounded-full' : isBanner ? 'rounded-xl w-full aspect-[3/1]' : 'rounded-xl w-20 h-20';

  const preview = (
    <div className={cn('relative border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/30', isBanner ? 'w-full' : 'shrink-0', previewShapeClass, previewClassName)}>
      {value ? <img src={value} alt={label} className="w-full h-full object-cover" /> : <ImagePlus className="h-6 w-6 text-muted-foreground" />}
    </div>
  );

  const trigger = (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <ImagePlus className="h-3.5 w-3.5 mr-1.5" /> {value ? `Change ${label}` : `Upload ${label}`}
      </Button>
    </>
  );

  return (
    <div className={className}>
      {isBanner ? (
        <div className="space-y-2">
          {preview}
          {trigger}
        </div>
      ) : (
        <div className="flex items-center gap-4">
          {preview}
          <div>{trigger}</div>
        </div>
      )}

      <Dialog open={!!pendingSrc} onOpenChange={(o) => !o && !uploading && closeCropDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Adjust {label}</DialogTitle></DialogHeader>
          {pendingSrc && (
            <>
              <div className={cn('relative w-full bg-muted rounded-lg overflow-hidden', aspect === 1 ? 'h-72' : 'h-56')}>
                <Cropper
                  image={pendingSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspect}
                  cropShape={shape === 'circle' ? 'round' : 'rect'}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
              <div className="flex items-center gap-3 px-1">
                <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
                <Slider min={1} max={3} step={0.05} value={[zoom]} onValueChange={([z]) => setZoom(z)} />
              </div>
              {uploading && (
                <div className="space-y-1.5">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">Uploading... {progress}%</p>
                </div>
              )}
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeCropDialog} disabled={uploading}>Cancel</Button>
            <Button type="button" onClick={confirmUpload} disabled={uploading || !croppedAreaPixels}>
              {uploading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImageCropUpload;
