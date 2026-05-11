import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Flame, Zap, Target } from 'lucide-react';

const AnalyticsTab = () => {
  const { data: sessions = [] } = useQuery({
    queryKey: ['admin-qb-analytics-sessions'],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const { data } = await supabase
        .from('qb_exam_sessions')
        .select('id, percentage, passed, time_taken_seconds, submitted_at, subject_id, qb_subjects(name)')
        .eq('status', 'submitted')
        .gte('submitted_at', since)
        .limit(2000);
      return data ?? [];
    },
  });

  const { data: hardest = [] } = useQuery({
    queryKey: ['admin-qb-hardest'],
    queryFn: async () => {
      const { data } = await supabase
        .from('qb_questions')
        .select('id, question_text, times_used, correct_rate, qb_subjects(name)')
        .gte('times_used', 5)
        .order('correct_rate', { ascending: true })
        .limit(10);
      return data ?? [];
    },
  });

  const { data: topUsers = [] } = useQuery({
    queryKey: ['admin-qb-top-users'],
    queryFn: async () => {
      const { data: stats } = await supabase
        .from('qb_user_stats')
        .select('*')
        .order('total_xp', { ascending: false })
        .limit(10);
      const ids = (stats ?? []).map((s: any) => s.user_id);
      const { data: profiles } = ids.length
        ? await supabase.from('user_profiles').select('id, full_name').in('id', ids)
        : { data: [] as any[] };
      const m = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
      return (stats ?? []).map((s: any) => ({ ...s, full_name: m.get(s.user_id) || s.user_id.slice(0, 8) }));
    },
  });

  const summary = useMemo(() => {
    const total = sessions.length;
    const passed = sessions.filter((s: any) => s.passed).length;
    const avgPct = total ? Math.round(sessions.reduce((a: number, s: any) => a + Number(s.percentage), 0) / total) : 0;
    const avgTime = total ? Math.round(sessions.reduce((a: number, s: any) => a + (s.time_taken_seconds || 0), 0) / total) : 0;
    return { total, passed, passRate: total ? Math.round((passed / total) * 100) : 0, avgPct, avgTime };
  }, [sessions]);

  // Daily sparkline of last 14 days
  const daily = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      buckets[d] = 0;
    }
    sessions.forEach((s: any) => {
      const d = (s.submitted_at || '').slice(0, 10);
      if (d in buckets) buckets[d]++;
    });
    return Object.entries(buckets);
  }, [sessions]);
  const maxDay = Math.max(1, ...daily.map(([, n]) => n));

  // Subjects ranked by attempts
  const bySubject = useMemo(() => {
    const m: Record<string, { name: string; n: number }> = {};
    sessions.forEach((s: any) => {
      const k = s.subject_id;
      if (!m[k]) m[k] = { name: s.qb_subjects?.name || '—', n: 0 };
      m[k].n++;
    });
    return Object.values(m).sort((a, b) => b.n - a.n).slice(0, 8);
  }, [sessions]);
  const maxSubj = Math.max(1, ...bySubject.map(s => s.n));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Exams (30d)</p><p className="text-2xl font-heading font-bold">{summary.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pass rate</p><p className="text-2xl font-heading font-bold text-emerald-600">{summary.passRate}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Avg score</p><p className="text-2xl font-heading font-bold">{summary.avgPct}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Avg time</p><p className="text-2xl font-heading font-bold">{Math.floor(summary.avgTime / 60)}m {summary.avgTime % 60}s</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-bold">Exams per day · last 14 days</p>
          <div className="flex items-end gap-1 h-24">
            {daily.map(([d, n]) => (
              <div key={d} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-primary/80 rounded-t" style={{ height: `${(n / maxDay) * 100}%`, minHeight: n > 0 ? 4 : 0 }} title={`${d}: ${n}`} />
                <span className="text-[9px] text-muted-foreground">{d.slice(5)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-bold flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Top XP earners</p>
            <div className="space-y-2">
              {topUsers.map((u: any, i: number) => (
                <div key={u.user_id} className="flex items-center gap-2 text-sm">
                  <span className="w-6 text-center font-bold text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate">{u.full_name}</span>
                  <span className="flex items-center gap-1 text-xs"><Flame className="h-3 w-3 text-orange-500" /> {u.current_streak}</span>
                  <span className="flex items-center gap-1 text-xs font-bold text-primary"><Zap className="h-3 w-3" /> {u.total_xp}</span>
                </div>
              ))}
              {topUsers.length === 0 && <p className="text-xs text-muted-foreground">No XP data yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-bold flex items-center gap-2"><Target className="h-4 w-4 text-destructive" /> Hardest questions</p>
            <div className="space-y-2 text-xs">
              {hardest.map((q: any) => (
                <div key={q.id} className="border rounded p-2">
                  <p className="line-clamp-2 font-medium">{q.question_text}</p>
                  <p className="text-muted-foreground mt-1">
                    {q.qb_subjects?.name} · {q.times_used} attempts · <span className="text-destructive font-bold">{Math.round(Number(q.correct_rate))}% correct</span>
                  </p>
                </div>
              ))}
              {hardest.length === 0 && <p className="text-muted-foreground">Need more attempts to compute.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-bold">Most-attempted subjects (30d)</p>
          {bySubject.length === 0 ? (
            <p className="text-xs text-muted-foreground">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {bySubject.map(s => (
                <div key={s.name} className="flex items-center gap-2 text-xs">
                  <span className="w-32 truncate">{s.name}</span>
                  <div className="flex-1 h-3 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-accent" style={{ width: `${(s.n / maxSubj) * 100}%` }} />
                  </div>
                  <span className="w-10 text-right tabular-nums">{s.n}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsTab;
