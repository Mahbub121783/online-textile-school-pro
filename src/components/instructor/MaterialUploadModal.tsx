import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import MediaUploader from './MediaUploader';
import { Plus, Link as LinkIcon } from 'lucide-react';

interface Material {
  name: string;
  url: string;
  type: string;
}

interface MaterialUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (material: Material) => void;
}

const MaterialUploadModal = ({ open, onClose, onSave }: MaterialUploadModalProps) => {
  const [mode, setMode] = useState<'upload' | 'link'>('upload');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState('pdf');

  const reset = () => { setName(''); setUrl(''); setType('pdf'); setMode('upload'); };

  const handleSave = () => {
    if (!name.trim() || !url.trim()) return;
    onSave({ name: name.trim(), url: url.trim(), type });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Material</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Button variant={mode === 'upload' ? 'default' : 'outline'} size="sm" onClick={() => setMode('upload')} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Upload File
          </Button>
          <Button variant={mode === 'link' ? 'default' : 'outline'} size="sm" onClick={() => setMode('link')} className="gap-1.5">
            <LinkIcon className="h-3.5 w-3.5" /> External Link
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lecture Slides Week 1" />
          </div>

          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="doc">Document</SelectItem>
                <SelectItem value="slides">Slides</SelectItem>
                <SelectItem value="spreadsheet">Spreadsheet</SelectItem>
                <SelectItem value="link">External Link</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === 'upload' ? (
            <MediaUploader
              value={url}
              onChange={(u) => setUrl(u)}
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"
              label="Upload Material"
            />
          ) : (
            <div>
              <Label>URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={!name.trim() || !url.trim()} className="w-full">
          Add Material
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialUploadModal;
