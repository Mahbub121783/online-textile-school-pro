import { Link } from 'react-router-dom';
import { useCampusPeople } from '@/hooks/useCampusPeople';
import { GraduationCap, Loader2 } from 'lucide-react';

/**
 * Instructors linked to this campus (any OTS instructor who has also
 * marked this as their campus) -- auto-appears here the moment they link,
 * no separate campus-side action needed. Cards link to their public
 * contributor profile.
 */
const CampusInstructorsSection = ({ campusId }: { campusId: string }) => {
  const { data, isLoading } = useCampusPeople(campusId);
  const instructors = data?.instructors ?? [];

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />;
  if (instructors.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">No instructors linked to this campus yet.</p>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {instructors.map((p) => (
        <Link key={p.id} to={`/contributor/${p.id}`} className="text-center group">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-muted mx-auto mb-2 border-2 border-transparent group-hover:border-primary transition-colors flex items-center justify-center">
            {p.avatar_url ? <img src={p.avatar_url} alt={p.full_name} className="w-full h-full object-cover" /> : <GraduationCap className="h-6 w-6 text-muted-foreground" />}
          </div>
          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{p.full_name}</p>
          {p.headline && <p className="text-xs text-muted-foreground truncate">{p.headline}</p>}
        </Link>
      ))}
    </div>
  );
};

export default CampusInstructorsSection;
