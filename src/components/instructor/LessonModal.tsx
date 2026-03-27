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
              <Input value={form.video_url} onChange={(e) => update('video_url', e.target.value)} placeholder={`Paste ${form.video_platform} URL`} />
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
