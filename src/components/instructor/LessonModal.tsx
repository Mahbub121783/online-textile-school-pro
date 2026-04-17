import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import RichTextEditor from './RichTextEditor';
import MediaUploader from './MediaUploader';

interface LessonModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  lesson?: any;
}

const LessonModal = ({ open, onClose, onSave, lesson }: LessonModalProps) => {
  const [form, setForm] = useState({
    title: lesson?.title || '',
    description: lesson?.description || '',
    video_url: lesson?.video_url || '',
    video_platform: lesson?.video_platform || 'youtube',
    duration_minutes: lesson?.duration_minutes || 0,
    is_preview: lesson?.is_preview || false,
    lesson_type: lesson?.lesson_type || 'video',
    resource_url: lesson?.resource_url || '',
  });

  const update = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{lesson ? 'Edit Lesson' : 'Add New Lesson'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Lesson Title *</Label>
            <Input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Enter lesson title" />
          </div>

          <div className="space-y-2">
            <Label>Content</Label>
            <RichTextEditor value={form.description} onChange={(v) => update('description', v)} minHeight="150px" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Video Source</Label>
              <Select value={form.video_platform} onValueChange={(v) => update('video_platform', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="vimeo">Vimeo</SelectItem>
                  <SelectItem value="drive">Google Drive</SelectItem>
                  <SelectItem value="upload">Upload</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input type="number" value={form.duration_minutes} onChange={(e) => update('duration_minutes', Number(e.target.value))} />
            </div>
          </div>

          {form.video_platform === 'upload' ? (
            <div className="space-y-2">
              <Label>Upload Video</Label>
              <MediaUploader value={form.video_url} onChange={(v) => update('video_url', v)} accept="video/*" label="Upload Video File" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Video URL</Label>
              <Input
                value={form.video_url}
                onChange={(e) => update('video_url', e.target.value)}
                placeholder={
                  form.video_platform === 'drive'
                    ? 'Paste Google Drive share link (any format)'
                    : `Paste ${form.video_platform} URL`
                }
              />
            </div>
          )}

          {form.video_platform === 'drive' && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-2">
              <p className="font-semibold text-amber-700 dark:text-amber-400">
                🔒 Secure your Drive video (required for full DRM)
              </p>
              <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
                <li>In Google Drive, right-click the file → <strong>Share</strong>.</li>
                <li>Set access to <strong>"Anyone with the link → Viewer"</strong>.</li>
                <li>Click <strong>⚙ Settings</strong> and <strong>uncheck</strong> "Viewers and commenters can see the option to download, print, and copy".</li>
              </ol>
              <p className="text-[11px] text-muted-foreground">
                Without this, Drive's native download button stays enabled regardless of player protections. Resume position is not tracked for Drive videos — use Upload or Vimeo for full progress tracking.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Attachments / Resources</Label>
            <MediaUploader value={form.resource_url} onChange={(v) => update('resource_url', v)} accept="*/*" label="Upload Attachment" />
          </div>

          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_preview} onCheckedChange={(v) => update('is_preview', v)} />
              <Label className="text-sm">Free Preview</Label>
            </div>
            <Select value={form.lesson_type} onValueChange={(v) => update('lesson_type', v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="text">Text</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent-hover text-accent-foreground" onClick={() => { if (!form.title.trim()) return; onSave(form); onClose(); }}>
              {lesson ? 'Update Lesson' : 'Add Lesson'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LessonModal;
