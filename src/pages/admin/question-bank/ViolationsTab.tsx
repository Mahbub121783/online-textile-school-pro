import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle } from 'lucide-react';

const TYPE_LABEL: Record<string, string> = {
  tab_blur: 'Tab switched',
  window_blur: 'Window unfocused',
  fullscreen_exit: 'Exited fullscreen',
  copy: 'Copy attempted',
  paste: 'Paste attempted',
  right_click: 'Right-click',
  devtools_suspected: 'DevTools suspected',
  resume: 'Session resumed',
};

const ViolationsTab = () => {
  const [type, setType] = useState('all');
  const [days, setDays] = useState('7');
  const [search, setSearch] = useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-qb-violations', type, days],
    queryFn: async () => {
      const since = new Date(Date.now() - parseInt(days) * 86400_000).toISOString();
      let q = supabase.from('qb_exam_violations').select('*').gte('occurred_at', since).order('occurred_at', { ascending: false }).limit(500);
      if (type !== 'all') q = q.eq('type', type);
      const { data } = await q;
      const userIds = Array.from(new Set((data ?? []).map((v: any) => v.user_id)));
      const { data: profiles } = userIds.length
        ? await supabase.from('user_profiles').select('id, full_name').in('id', userIds)
        : { data: [] as any[] };
      const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
      return (data ?? []).map((v: any) => ({ ...v, full_name: pmap.get(v.user_id) || v.user_id.slice(0, 8) }));
    },
  });

  const filtered = useMemo(() =>
    search.trim()
      ? rows.filter((r: any) => r.full_name.toLowerCase().includes(search.toLowerCase()))
      : rows, [rows, search]);

  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r: any) => { m[r.type] = (m[r.type] || 0) + 1; });
    return Object.entries(m).sort(([, a], [, b]) => b - a);
  }, [rows]);

  const max = Math.max(1, ...byType.map(([, n]) => n));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All violation types</SelectItem>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24h</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Search student name…" className="w-64" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex-1" />
        <Badge variant="outline" className="text-sm">{filtered.length} events</Badge>
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-bold mb-3">Breakdown by type</p>
          {byType.length === 0 ? (
            <p className="text-xs text-muted-foreground">No violations recorded in this window.</p>
          ) : (
            <div className="space-y-2">
              {byType.map(([t, n]) => (
                <div key={t} className="flex items-center gap-2 text-xs">
                  <span className="w-40 truncate">{TYPE_LABEL[t] || t}</span>
                  <div className="flex-1 h-3 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(n / max) * 100}%` }} />
                  </div>
                  <span className="w-10 text-right tabular-nums">{n}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? <p className="text-muted-foreground py-8 text-center animate-pulse">Loading…</p> : (
        <div className="space-y-1">
          {filtered.map((v: any) => (
            <Card key={v.id}>
              <CardContent className="p-3 flex items-center gap-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <Badge variant="outline" className="font-mono text-[10px]">{v.type}</Badge>
                <span className="flex-1 truncate">{v.full_name}</span>
                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(v.occurred_at), { addSuffix: true })}</span>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && !isLoading && (
            <p className="text-muted-foreground py-8 text-center">No matching violations.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ViolationsTab;
