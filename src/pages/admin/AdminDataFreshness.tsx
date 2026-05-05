import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { RefreshCw, Bell, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/**
 * Admin-only diagnostic page that inspects React Query cache state in real time.
 * Reads cached query metadata directly (no DB load); only hits Supabase when
 * the admin explicitly clicks "Refetch" or "Send Test Notification".
 */
const AdminDataFreshness = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  const [testing, setTesting] = useState(false);

  const cache = queryClient.getQueryCache().getAll();
  const summary = cache.map(q => {
    const state = q.state;
    const updatedAt = state.dataUpdatedAt ? new Date(state.dataUpdatedAt) : null;
    const ageMs = updatedAt ? Date.now() - updatedAt.getTime() : null;
    const isStale = q.isStale();
    const rowCount = Array.isArray(state.data) ? state.data.length : (state.data ? 1 : 0);
    return {
      key: JSON.stringify(q.queryKey),
      keyShort: Array.isArray(q.queryKey) ? String(q.queryKey[0]) : String(q.queryKey),
      updatedAt,
      ageMs,
      isStale,
      status: state.status,
      rowCount,
      fetchStatus: state.fetchStatus,
    };
  }).sort((a, b) => a.keyShort.localeCompare(b.keyShort));

  const refetchAll = async () => {
    await queryClient.invalidateQueries();
    setTick(t => t + 1);
    toast({ title: 'Refetching all queries', description: `${cache.length} queries invalidated` });
  };

  const refetchOne = async (key: string) => {
    await queryClient.invalidateQueries({ queryKey: JSON.parse(key) });
    setTick(t => t + 1);
  };

  const sendTestNotification = async () => {
    if (!user?.id) return;
    setTesting(true);
    try {
      const { error } = await supabase.from('notifications' as any).insert({
        user_id: user.id,
        type: 'system',
        title: '🔔 Realtime smoke test',
        message: `Sent at ${new Date().toLocaleTimeString()}`,
      });
      if (error) throw error;
      toast({ title: 'Test sent', description: 'Bell should update within 2s via realtime.' });
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const stale = summary.filter(s => s.isStale).length;
  const fetching = summary.filter(s => s.fetchStatus === 'fetching').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Data Freshness</h1>
          <p className="text-sm text-muted-foreground">
            Live React Query cache inspector — verifies pages pull fresh Supabase data.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setTick(t => t + 1)}>
            <RefreshCw className="h-4 w-4 mr-2" /> Re-read cache
          </Button>
          <Button size="sm" onClick={refetchAll}>
            <Activity className="h-4 w-4 mr-2" /> Invalidate all
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total queries</p><p className="text-2xl font-bold">{summary.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Stale</p><p className="text-2xl font-bold text-orange-500">{stale}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Fetching now</p><p className="text-2xl font-bold text-blue-500">{fetching}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Fresh</p><p className="text-2xl font-bold text-green-500">{summary.length - stale}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> Notification Realtime Smoke Test
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Inserts a notification for your account. The bell badge should update within ~2s without a page refresh.
          </p>
          <Button onClick={sendTestNotification} disabled={testing || !user}>
            {testing ? 'Sending…' : 'Send test notification'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Active queries ({summary.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Query key</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Rows</th>
                  <th className="text-left p-3">Last fetch</th>
                  <th className="text-left p-3">State</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {summary.map(s => (
                  <tr key={s.key} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs max-w-xs truncate" title={s.key}>{s.key}</td>
                    <td className="p-3">
                      {s.status === 'success' && <Badge variant="outline" className="text-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />ok</Badge>}
                      {s.status === 'pending' && <Badge variant="outline">loading</Badge>}
                      {s.status === 'error' && <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />error</Badge>}
                    </td>
                    <td className="p-3 tabular-nums">{s.rowCount}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {s.updatedAt ? formatDistanceToNow(s.updatedAt, { addSuffix: true }) : '—'}
                    </td>
                    <td className="p-3">
                      {s.fetchStatus === 'fetching' ? (
                        <Badge className="bg-blue-500">fetching</Badge>
                      ) : s.isStale ? (
                        <Badge variant="outline" className="text-orange-500">stale</Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600">fresh</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <Button size="sm" variant="ghost" onClick={() => refetchOne(s.key)}>
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Cache snapshot key: {tick}. This page reads in-memory cache only — clicks above are the only DB calls.
      </p>
    </div>
  );
};

export default AdminDataFreshness;
