import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Video, FileQuestion, ClipboardList, Check } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

type ItemType = 'lesson' | 'quiz' | 'assignment';

interface ItemPickerModalProps {
  open: boolean;
  onClose: () => void;
  type: ItemType;
  excludeIds: string[];
  onSelect: (id: string) => void;
  onCreateNew: () => void;
}

const typeConfig: Record<ItemType, { label: string; icon: typeof Video; table: string; color: string }> = {
  lesson: { label: 'Lesson', icon: Video, table: 'lessons', color: 'text-primary' },
  quiz: { label: 'Quiz', icon: FileQuestion, table: 'quizzes', color: 'text-blue-600' },
  assignment: { label: 'Assignment', icon: ClipboardList, table: 'assignments', color: 'text-amber-600' },
};

const ItemPickerModal = ({ open, onClose, type, excludeIds, onSelect, onCreateNew }: ItemPickerModalProps) => {
  const [search, setSearch] = useState('');
  const config = typeConfig[type];
  const Icon = config.icon;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['picker-items', type],
    queryFn: async () => {
      if (type === 'lesson') {
        const { data } = await supabase.from('lessons').select('id, title, duration_minutes, lesson_type, section_id').order('created_at', { ascending: false });
        return data ?? [];
      } else if (type === 'quiz') {
        const { data } = await supabase.from('quizzes').select('id, title, pass_percentage, section_id, course_id').order('created_at', { ascending: false });
        return data ?? [];
      } else {
        const { data } = await supabase.from('assignments').select('id, title, max_score, section_id, course_id').order('created_at', { ascending: false });
        return data ?? [];
      }
    },
    enabled: open,
  });

  const filtered = items.filter(
    (item: any) =>
      !excludeIds.includes(item.id) &&
      item.title.toLowerCase().includes(search.toLowerCase())
  );

  const unlinked = filtered.filter((item: any) => !item.section_id);
  const linked = filtered.filter((item: any) => !!item.section_id);

  const renderMeta = (item: any) => {
    if (type === 'lesson') return `${item.lesson_type || 'video'} · ${item.duration_minutes || 0} min`;
    if (type === 'quiz') return `${item.pass_percentage || 60}% pass`;
    return `${item.max_score || 100} marks`;
  };

  const renderSection = (title: string, list: any[]) => {
    if (list.length === 0) return null;
    return (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{title}</p>
        {list.map((item: any) => (
          <button
            key={item.id}
            className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-muted/50 transition-colors text-left border"
            onClick={() => { onSelect(item.id); onClose(); }}
          >
            <Icon className={`h-4 w-4 ${config.color} shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground">{renderMeta(item)}</p>
            </div>
            <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.color}`} />
            Add {config.label}
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${config.label.toLowerCase()}s...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px] -mx-2 px-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-sm text-muted-foreground">No {config.label.toLowerCase()}s found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {renderSection('Available (Unlinked)', unlinked)}
              {renderSection('Already Linked (will re-link)', linked)}
            </div>
          )}
        </ScrollArea>

        <Button variant="outline" className="w-full gap-2" onClick={() => { onCreateNew(); onClose(); }}>
          <Plus className="h-4 w-4" /> Create New {config.label}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default ItemPickerModal;
