import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, Eye, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const LiveSessionsTab = () => {
  const qc = useQueryClient();
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['admin-qb-live-sessions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('qb_exam_sessions')
        .select('*, qb_subjects(name, icon)')
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(100);
      const userIds = Array.from(new Set((data ?? []).map((s: any) => s.user_id)));
      const { data: profiles } = userIds.length
        ? await supabase.from('user_profiles').select('id, full_name, phone').in('id', userIds)
        : { data: [] as any[] };
      const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return (data ?? []).map((s: any) => ({ ...s, profile: pmap.get(s.user_id) }));
    },
    refetchInterval: 60_000, // was 10s — too aggressive on a small DB
    staleTime: 30_000,
    retry: 0,
    refetchOnWindowFocus: false,
  });

  const { data: detail } = useQuery({
    queryKey: ['admin-qb-session-detail', detailId],
    queryFn: async () => {
      if (!detailId) return null;
      const [{ data: answers }, { data: violations }] = await Promise.all([
        supabase.from('qb_exam_answers').select('*, qb_questions(question_text, correct_answer)').eq('session_id', detailId),
        supabase.from('qb_exam_violations').select('*').eq('session_id', detailId).order('occurred_at', { ascending: false }),
      ]);
      return { answers: answers ?? [], violations: violations ?? [] };
    },
    enabled: !!detailId,
  });

  const forceSubmit = async (sessionId: string) => {
    if (!confirm('Force-submit this session now?')) return;
    // Pass empty answers — server-side will use whatever is already in qb_exam_answers
    const { error } = await supabase.rpc('qb_submit_exam', { _session_id: sessionId, _answers: [] as never });
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Submitted' });
    qc.invalidateQueries({ queryKey: ['admin-qb-live-sessions'] });
  };

  const heartbeatStatus = (lastHb: string | null) => {
    if (!lastHb) return { color: 'text-muted-foreground', label: 'no signal' };
    const ageMs = Date.now() - new Date(lastHb).getTime();
    if (ageMs > 120_000) return { color: 'text-destructive', label: `${Math.round(ageMs / 1000)}s ago — STALE` };
    if (ageMs > 60_000) return { color: 'text-amber-500', label: `${Math.round(ageMs / 1000)}s ago` };
    return { color: 'text-emerald-500', label: `${Math.round(ageMs / 1000)}s ago` };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Activity className="h-4 w-4 animate-pulse text-emerald-500" />
        Auto-refreshing every 10s • {sessions.length} active session{sessions.length === 1 ? '' : 's'}
      </div>

      {isLoading && <p className="text-muted-foreground py-8 text-center animate-pulse">Loading…</p>}

      {!isLoading && sessions.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No live sessions right now.</CardContent></Card>
      )}

      <div className="space-y-2">
        {sessions.map((s: any) => {
          const hb = heartbeatStatus(s.last_heartbeat_at);
          const elapsed = Math.round((Date.now() - new Date(s.started_at).getTime()) / 1000);
          const mm = Math.floor(elapsed / 60), ss = elapsed % 60;
          return (
            <Card key={s.id} className={hb.label.includes('STALE') ? 'border-destructive/50' : ''}>
              <CardContent className="p-3 flex flex-wrap items-center gap-3">
                <div className="text-2xl">{s.qb_subjects?.icon || '🧠'}</div>
                <div className="flex-1 min-w-[180px]">
                  <p className="font-bold text-sm truncate">{s.profile?.full_name || s.user_id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.qb_subjects?.name} · {s.difficulty} · {s.total_questions}q
                  </p>
                </div>
                <div className="text-xs space-y-0.5 min-w-[120px]">
                  <p className="flex items-center gap-1"><Clock className="h-3 w-3" /> {mm}:{ss.toString().padStart(2, '0')} elapsed</p>
                  <p className={hb.color}>♥ {hb.label}</p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {s.violation_count > 0 && (
                    <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> {s.violation_count}</Badge>
                  )}
                  {s.focus_mode_used && <Badge variant="outline" className="text-[10px]">Focus</Badge>}
                  {s.resume_count > 0 && <Badge variant="secondary" className="text-[10px]">Resumed ×{s.resume_count}</Badge>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setDetailId(s.id)}><Eye className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => forceSubmit(s.id)}>Force submit</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Session details</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold mb-2">Answers so far ({detail.answers.length})</p>
                <div className="space-y-1 text-xs">
                  {detail.answers.map((a: any) => (
                    <div key={a.id} className="p-2 rounded border">
                      <p className="font-medium line-clamp-1">{a.qb_questions?.question_text}</p>
                      <p className="text-muted-foreground">
                        Picked: <span className={a.is_correct ? 'text-emerald-600' : 'text-destructive'}>{a.selected_answer || '—'}</span>
                      </p>
                    </div>
                  ))}
                  {detail.answers.length === 0 && <p className="text-muted-foreground">No answers yet.</p>}
                </div>
              </div>
              <div>
                <p className="text-sm font-bold mb-2">Violations ({detail.violations.length})</p>
                <div className="space-y-1 text-xs">
                  {detail.violations.map((v: any) => (
                    <div key={v.id} className="p-2 rounded border border-destructive/30 bg-destructive/5">
                      <p className="font-mono">{v.type}</p>
                      <p className="text-muted-foreground">{formatDistanceToNow(new Date(v.occurred_at), { addSuffix: true })}</p>
                    </div>
                  ))}
                  {detail.violations.length === 0 && <p className="text-muted-foreground">Clean — no violations.</p>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LiveSessionsTab;
