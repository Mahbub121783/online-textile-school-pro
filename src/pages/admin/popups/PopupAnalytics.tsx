import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download, Eye, MousePointer, X as XIcon, Send } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';

export default function PopupAnalytics() {
  const { id } = useParams();
  const [popup, setPopup] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: p }, { data: a }, { data: s }] = await Promise.all([
        supabase.from('popups').select('*').eq('id', id).single(),
        supabase.from('popup_analytics').select('*').eq('popup_id', id).order('created_at', { ascending: false }).limit(5000),
        supabase.from('popup_submissions').select('*').eq('popup_id', id).order('submitted_at', { ascending: false }),
      ]);
      setPopup(p);
      setAnalytics(a || []);
      setSubmissions(s || []);
      setLoading(false);
    })();
  }, [id]);

  const counts = analytics.reduce((acc: Record<string, number>, r) => { acc[r.event_type] = (acc[r.event_type] || 0) + 1; return acc; }, {});
  const views = counts.view || 0;
  const clicks = (counts.click_primary || 0) + (counts.click_secondary || 0);
  const dismisses = counts.dismiss || 0;
  const subs = counts.submit || 0;
  const ctr = views ? ((clicks / views) * 100).toFixed(1) : '0';
  const conv = views ? ((subs / views) * 100).toFixed(1) : '0';

  // Time-series: group by day
  const byDay: Record<string, number> = {};
  analytics.filter(a => a.event_type === 'view').forEach(a => {
    const day = format(new Date(a.created_at), 'MMM d');
    byDay[day] = (byDay[day] || 0) + 1;
  });
  const chartData = Object.entries(byDay).map(([day, count]) => ({ day, views: count })).reverse();

  const exportCsv = () => {
    if (!submissions.length) return;
    const keys = Array.from(new Set(submissions.flatMap(s => Object.keys(s.form_data || {}))));
    const headers = ['submitted_at', 'email', 'user_id', ...keys];
    const rows = submissions.map(s => [s.submitted_at, s.email || '', s.user_id || '', ...keys.map(k => JSON.stringify(s.form_data?.[k] ?? ''))]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `popup-${id}-submissions.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;
  if (!popup) return <div className="py-12 text-center text-muted-foreground">Popup not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/admin/popups"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-2xl font-heading font-bold">{popup.name}</h1>
            <div className="flex gap-2 mt-1">
              <Badge variant="secondary">{popup.type}</Badge>
              <Badge variant={popup.is_active ? 'default' : 'outline'}>{popup.is_active ? 'Active' : 'Paused'}</Badge>
            </div>
          </div>
        </div>
        {submissions.length > 0 && <Button onClick={exportCsv}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={<Eye className="h-4 w-4" />} label="Views" value={views} />
        <StatCard icon={<MousePointer className="h-4 w-4" />} label="Clicks" value={clicks} sub={`${ctr}% CTR`} />
        <StatCard icon={<Send className="h-4 w-4" />} label="Submissions" value={subs} sub={`${conv}% conv.`} />
        <StatCard icon={<XIcon className="h-4 w-4" />} label="Dismisses" value={dismisses} />
        <StatCard label="Priority" value={popup.priority} />
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Views over time</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Submissions ({submissions.length})</CardTitle></CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No submissions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Date</TableHead><TableHead>Email</TableHead><TableHead>Data</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {submissions.slice(0, 100).map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{format(new Date(s.submitted_at), 'MMM d, HH:mm')}</TableCell>
                    <TableCell>{s.email || '—'}</TableCell>
                    <TableCell className="text-xs font-mono max-w-md truncate">{JSON.stringify(s.form_data)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon?: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
