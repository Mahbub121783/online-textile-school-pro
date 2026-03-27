import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import RichTextEditor from './RichTextEditor';

interface AssignmentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  assignment?: any;
}

const AssignmentModal = ({ open, onClose, onSave, assignment }: AssignmentModalProps) => {
  const [form, setForm] = useState({
    title: assignment?.title || '',
    description: assignment?.description || '',
    instructions: assignment?.instructions || '',
    max_score: assignment?.max_score || 100,
    due_days: assignment?.due_days || 7,
  });

  const update = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{assignment ? 'Edit Assignment' : 'Add New Assignment'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Assignment Title *</Label>
            <Input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Enter assignment title" />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <RichTextEditor value={form.description} onChange={(v) => update('description', v)} minHeight="100px" />
          </div>

          <div className="space-y-2">
            <Label>Instructions</Label>
            <RichTextEditor value={form.instructions} onChange={(v) => update('instructions', v)} minHeight="100px" placeholder="Instructions for students..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Total Marks</Label>
              <Input type="number" value={form.max_score} onChange={(e) => update('max_score', Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Due Days (after enrollment)</Label>
              <Input type="number" value={form.due_days} onChange={(e) => update('due_days', Number(e.target.value))} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button className="bg-accent hover:bg-accent-hover text-accent-foreground" onClick={() => { if (!form.title.trim()) return; onSave(form); onClose(); }}>
              {assignment ? 'Update Assignment' : 'Add Assignment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssignmentModal;
