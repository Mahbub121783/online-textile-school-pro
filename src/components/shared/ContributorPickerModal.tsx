import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X, Check, UserPlus } from 'lucide-react';
import type { ContributorRole } from '@/hooks/useContributors';

export interface PickedContributor {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: ContributorRole;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (picks: PickedContributor[]) => void;
  initialPicks?: PickedContributor[];
  allowedRoles?: ContributorRole[];
  title?: string;
  excludeUserIds?: string[];
}

const ALL_ROLES: ContributorRole[] = ['lead_instructor', 'co_instructor', 'author', 'co_author', 'reviewer'];

export const ContributorPickerModal = ({
  open,
  onOpenChange,
  onConfirm,
  initialPicks = [],
  allowedRoles = ALL_ROLES,
  title = 'Add Contributors',
  excludeUserIds = [],
}: Props) => {
  const [search, setSearch] = useState('');
  const [picks, setPicks] = useState<PickedContributor[]>(initialPicks);

  useEffect(() => {
    if (open) setPicks(initialPicks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['contributor-search', search],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url, headline')
        .order('full_name', { ascending: true })
        .limit(20);
      if (search.trim()) q = q.ilike('full_name', `%${search.trim()}%`);
      const { data } = await q;
      return data || [];
    },
  });

  const isPicked = (uid: string) => picks.some(p => p.user_id === uid);
  const togglePick = (u: any) => {
    if (isPicked(u.id)) {
      setPicks(picks.filter(p => p.user_id !== u.id));
    } else {
      setPicks([...picks, {
        user_id: u.id,
        full_name: u.full_name || 'Unnamed',
        avatar_url: u.avatar_url,
        role: allowedRoles[0],
      }]);
    }
  };
  const updateRole = (uid: string, role: ContributorRole) => {
    setPicks(picks.map(p => p.user_id === uid ? { ...p, role } : p));
  };

  const filteredResults = results.filter((u: any) => !excludeUserIds.includes(u.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />{title}</DialogTitle>
          <DialogDescription>Search registered users by name and assign their role.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by full name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        {picks.length > 0 && (
          <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">Selected ({picks.length})</p>
            <div className="flex flex-wrap gap-2">
              {picks.map(p => (
                <div key={p.user_id} className="flex items-center gap-2 bg-background rounded-full pl-1 pr-2 py-1 border">
                  <Avatar className="h-6 w-6"><AvatarImage src={p.avatar_url || ''} /><AvatarFallback className="text-xs">{p.full_name[0]}</AvatarFallback></Avatar>
                  <span className="text-xs font-medium">{p.full_name}</span>
                  <Select value={p.role} onValueChange={(v) => updateRole(p.user_id, v as ContributorRole)}>
                    <SelectTrigger className="h-6 text-xs border-0 bg-transparent gap-1 px-1 w-auto"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {allowedRoles.map(r => <SelectItem key={r} value={r} className="text-xs capitalize">{r.replace('_', ' ')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <button onClick={() => setPicks(picks.filter(x => x.user_id !== p.user_id))} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto border rounded-lg">
          {isLoading && <p className="text-center py-8 text-muted-foreground text-sm">Searching...</p>}
          {!isLoading && filteredResults.length === 0 && (
            <p className="text-center py-8 text-muted-foreground text-sm">No users found</p>
          )}
          {filteredResults.map((u: any) => {
            const picked = isPicked(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => togglePick(u)}
                className={`w-full flex items-center gap-3 p-3 hover:bg-accent text-left border-b last:border-b-0 ${picked ? 'bg-primary/5' : ''}`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={u.avatar_url || ''} />
                  <AvatarFallback>{(u.full_name || '?')[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.full_name || 'Unnamed user'}</p>
                  {u.headline && <p className="text-xs text-muted-foreground truncate">{u.headline}</p>}
                </div>
                {picked && <Badge variant="default" className="gap-1"><Check className="h-3 w-3" /> Selected</Badge>}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onConfirm(picks); onOpenChange(false); }}>
            Confirm ({picks.length})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContributorPickerModal;
