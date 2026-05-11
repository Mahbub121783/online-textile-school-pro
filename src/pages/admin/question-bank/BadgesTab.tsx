import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trophy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'legendary'];

const empty = { key: '', name: '', description: '', icon: '🏅', tier: 'bronze', criteria: '{}', is_active: true, sort_order: 0 };

const BadgesTab = () => {
  const qc = useQueryClient();
  const [modal, setModal] = useState<any>(null);
  const [criteriaText, setCriteriaText] = useState('{}');

  const { data: badges = [] } = useQuery({
    queryKey: ['admin-qb-badges'],
    queryFn: async () => (await supabase.from('qb_badges').select('*').order('sort_order')).data ?? [],
  });

  const { data: counts = {} } = useQuery({
    queryKey: ['admin-qb-badge-counts'],
    queryFn: async () => {
      const { data } = await supabase.from('qb_user_badges').select('badge_key');
      const m: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { m[r.badge_key] = (m[r.badge_key] || 0) + 1; });
      return m;
    },
  });

  const save = useMutation({
    mutationFn: async (b: any) => {
      let parsed: any;
      try { parsed = JSON.parse(criteriaText || '{}'); } catch { throw new Error('Criteria must be valid JSON'); }
      const payload = {
        key: b.key, name: b.name, description: b.description, icon: b.icon,
        tier: b.tier, criteria: parsed, is_active: b.is_active, sort_order: b.sort_order || 0,
      };
      const { error } = await supabase.from('qb_badges').upsert(payload, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-qb-badges'] }); setModal(null); toast({ title: 'Saved' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const openModal = (b: any) => {
    setModal(b);
    setCriteriaText(typeof b.criteria === 'object' ? JSON.stringify(b.criteria, null, 2) : (b.criteria || '{}'));
  };

  const tierColor = (t: string) => ({
    bronze: 'bg-amber-700/20 text-amber-700',
    silver: 'bg-slate-400/20 text-slate-600',
    gold: 'bg-yellow-500/20 text-yellow-700',
    platinum: 'bg-cyan-400/20 text-cyan-700',
    legendary: 'bg-purple-500/20 text-purple-700',
  }[t] || 'bg-muted');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Trophy className="h-4 w-4" /> {badges.length} badges in catalog
        </p>
        <Button onClick={() => openModal(empty)}><Plus className="h-4 w-4 mr-1" /> New Badge</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {badges.map((b: any) => (
          <Card key={b.key}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="text-3xl">{b.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => openModal(b)}><Pencil className="h-4 w-4" /></Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={tierColor(b.tier)}>{b.tier}</Badge>
                {!b.is_active && <Badge variant="secondary">Hidden</Badge>}
                <span className="text-xs text-muted-foreground ml-auto">
                  Earned by {counts[b.key] || 0} student{counts[b.key] === 1 ? '' : 's'}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{modal?.key && badges.some((b: any) => b.key === modal.key) ? 'Edit badge' : 'New badge'}</DialogTitle></DialogHeader>
          {modal && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Key (unique)</Label><Input value={modal.key} onChange={(e) => setModal({ ...modal, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} /></div>
                <div><Label>Icon (emoji)</Label><Input value={modal.icon} onChange={(e) => setModal({ ...modal, icon: e.target.value })} /></div>
              </div>
              <div><Label>Name</Label><Input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea rows={2} value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tier</Label>
                  <Select value={modal.tier} onValueChange={(v) => setModal({ ...modal, tier: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIERS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Sort order</Label><Input type="number" value={modal.sort_order || 0} onChange={(e) => setModal({ ...modal, sort_order: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div>
                <Label>Criteria (JSON)</Label>
                <Textarea rows={5} className="font-mono text-xs" value={criteriaText} onChange={(e) => setCriteriaText(e.target.value)} placeholder='{"type":"perfect_score"}' />
                <p className="text-[10px] text-muted-foreground mt-1">Award logic is evaluated by qb_submit_exam. Examples: {'{"type":"perfect_score"}'}, {'{"type":"speed","max_seconds_ratio":0.5}'}.</p>
              </div>
              <div className="flex items-center gap-2"><Switch checked={modal.is_active} onCheckedChange={(v) => setModal({ ...modal, is_active: v })} /><Label>Active</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={() => save.mutate(modal)} disabled={save.isPending || !modal?.key || !modal?.name}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BadgesTab;
