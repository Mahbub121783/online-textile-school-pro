import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, XCircle, AlertTriangle, Eye, Search, ListChecks, Trophy } from 'lucide-react';
import { format } from 'date-fns';

type Row = {
  id: string;
  user_id: string;
  difficulty: string;
  score: number;
  total_points: number;
  percentage: number;
  passed: boolean;
  time_taken_seconds: number;
  time_limit_seconds: number;
  violation_count: number;
  resume_count: number;
  focus_mode_used: boolean;
  submitted_at: string;
  total_questions: number;
  subject?: { name: string; icon: string; color: string };
  full_name?: string;
  roll_id?: string;
};

const SubmissionsTab = () => {
  const [days, setDays] = useState('30');
  const [diff, setDiff] = useState('all');
  const [passFilter, setPassFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE = 50;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-qb-submissions', days, diff, passFilter, page],
    queryFn: async () => {
      const since = new Date(Date.now() - parseInt(days) * 86400_000).toISOString();
      let q = supabase
        .from('qb_exam_sessions')
        .select(
          'id, user_id, difficulty, score, total_points, percentage, passed, time_taken_seconds, time_limit_seconds, violation_count, resume_count, focus_mode_used, submitted_at, total_questions, qb_subjects(name, icon, color)',
        )
        .not('submitted_at', 'is', null)
        .gte('submitted_at', since)
        .order('submitted_at', { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (diff !== 'all') q = q.eq('difficulty', diff as any);
      if (passFilter === 'pass') q = q.eq('passed', true);
      if (passFilter === 'fail') q = q.eq('passed', false);
      const { data } = await q;
      const ids = Array.from(new Set((data ?? []).map((s: any) => s.user_id)));
      const { data: profiles } = ids.length
        ? await supabase.from('user_profiles').select('id, full_name, roll_id').in('id', ids)
        : { data: [] as any[] };
      const m = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return (data ?? []).map((s: any) => ({
        ...s,
        subject: s.qb_subjects,
        full_name: m.get(s.user_id)?.full_name || s.user_id.slice(0, 8),
        roll_id: m.get(s.user_id)?.roll_id || '',
      })) as Row[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.full_name?.toLowerCase().includes(s) ||
        r.roll_id?.toLowerCase().includes(s) ||
        r.subject?.name?.toLowerCase().includes(s),
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const passed = filtered.filter((r) => r.passed).length;
    const flagged = filtered.filter((r) => (r.violation_count || 0) > 0).length;
    return { total, passed, flagged, passRate: total ? Math.round((passed / total) * 100) : 0 };
  }, [filtered]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={days} onValueChange={(v) => { setPage(0); setDays(v); }}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24h</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
        <Select value={diff} onValueChange={(v) => { setPage(0); setDiff(v); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All difficulties</SelectItem>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
        <Select value={passFilter} onValueChange={(v) => { setPage(0); setPassFilter(v); }}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All results</SelectItem>
            <SelectItem value="pass">Passed only</SelectItem>
            <SelectItem value="fail">Failed only</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Name, roll id, subject…" className="h-9 pl-7" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/practice/leaderboard" target="_blank"><Trophy className="h-4 w-4 mr-1" /> Leaderboard</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Submissions</p><p className="text-xl font-heading font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Passed</p><p className="text-xl font-heading font-bold text-emerald-600">{stats.passed}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Pass rate</p><p className="text-xl font-heading font-bold">{stats.passRate}%</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">With fraud flags</p><p className="text-xl font-heading font-bold text-amber-600">{stats.flagged}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left border-b text-muted-foreground bg-muted/30">
                  <th className="py-2 px-3 font-semibold">Student</th>
                  <th className="py-2 px-3 font-semibold">Subject</th>
                  <th className="py-2 px-3 font-semibold">Difficulty</th>
                  <th className="py-2 px-3 font-semibold text-right">Score</th>
                  <th className="py-2 px-3 font-semibold text-right">%</th>
                  <th className="py-2 px-3 font-semibold text-right">Time</th>
                  <th className="py-2 px-3 font-semibold text-center">Fraud</th>
                  <th className="py-2 px-3 font-semibold">When</th>
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={9} className="py-8 text-center text-muted-foreground animate-pulse">Loading…</td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">
                    <ListChecks className="h-5 w-5 inline mr-1 opacity-50" /> No submissions in this window.
                  </td></tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-3">
                      <p className="font-semibold">{r.full_name}</p>
                      {r.roll_id && <p className="text-[10px] text-muted-foreground">{r.roll_id}</p>}
                    </td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center gap-1">
                        <span>{r.subject?.icon || '🧠'}</span>
                        <span className="truncate max-w-[160px]">{r.subject?.name || '—'}</span>
                      </span>
                    </td>
                    <td className="py-2 px-3"><Badge variant="outline" className="capitalize text-[10px]">{r.difficulty}</Badge></td>
                    <td className="py-2 px-3 text-right tabular-nums font-bold">{r.score}<span className="text-muted-foreground font-normal">/{r.total_points}</span></td>
                    <td className="py-2 px-3 text-right">
                      <span className={`inline-flex items-center gap-1 font-bold ${r.passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {r.passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        {Math.round(Number(r.percentage))}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{fmtTime(r.time_taken_seconds || 0)}</td>
                    <td className="py-2 px-3 text-center">
                      {(r.violation_count || 0) > 0 ? (
                        <Badge className="bg-amber-500/20 text-amber-700 hover:bg-amber-500/20 gap-1">
                          <AlertTriangle className="h-3 w-3" /> {r.violation_count}
                        </Badge>
                      ) : (
                        <span className="text-emerald-600">✓</span>
                      )}
                      {r.resume_count > 0 && (
                        <span className="ml-1 text-[10px] text-muted-foreground">↻{r.resume_count}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                      {r.submitted_at ? format(new Date(r.submitted_at), 'MMM d, h:mm a') : '—'}
                    </td>
                    <td className="py-2 px-3">
                      <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                        <Link to={`/practice/result/${r.id}`} target="_blank">
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Page {page + 1} · {filtered.length} shown</span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
          <Button variant="outline" size="sm" disabled={rows.length < PAGE} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
};

export default SubmissionsTab;
