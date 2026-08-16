import { useState } from 'react';
import { useCampusPeople, type CampusPerson } from '@/hooks/useCampusPeople';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

/**
 * Students linked to this campus. Clicking a tile opens their public
 * details -- name, avatar, headline/bio (if they've set any) and how long
 * they've been a member. Deliberately does not show phone/email/DOB/
 * address -- see useCampusPeople's column allowlist.
 */
const CampusStudentsSection = ({ campusId }: { campusId: string }) => {
  const { data, isLoading } = useCampusPeople(campusId);
  const students = data?.students ?? [];
  const [selected, setSelected] = useState<CampusPerson | null>(null);

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />;
  if (students.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">No students linked to this campus yet.</p>;

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {students.map((p) => (
          <button key={p.id} type="button" onClick={() => setSelected(p)} className="text-center group">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-muted mx-auto mb-1.5 border-2 border-transparent group-hover:border-primary transition-colors flex items-center justify-center">
              {p.avatar_url ? <img src={p.avatar_url} alt={p.full_name} className="w-full h-full object-cover" /> : <User className="h-5 w-5 text-muted-foreground" />}
            </div>
            <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">{p.full_name}</p>
          </button>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{selected?.full_name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="text-center space-y-3 pt-2">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-muted mx-auto border flex items-center justify-center">
                {selected.avatar_url ? <img src={selected.avatar_url} alt={selected.full_name} className="w-full h-full object-cover" /> : <User className="h-8 w-8 text-muted-foreground" />}
              </div>
              {selected.headline && <p className="text-sm font-medium">{selected.headline}</p>}
              {selected.bio && <p className="text-sm text-foreground/80 whitespace-pre-wrap">{selected.bio}</p>}
              <p className="text-xs text-muted-foreground">Member since {format(new Date(selected.created_at), 'MMM yyyy')}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CampusStudentsSection;
