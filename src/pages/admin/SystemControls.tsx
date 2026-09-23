import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdminSystemStats } from '@/hooks/useAdminSystemStats';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ShieldAlert, Download, Database, RefreshCw, Server, HardDrive, Zap,
  FileSpreadsheet, Users, Cpu, Mail, Bell, Cloud, KeyRound, Wifi, WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';

const formatUptime = (seconds: number) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const DURATION_OPTIONS = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' },
  { value: '360', label: '6 hours' },
  { value: '1440', label: '24 hours' },
];

const SystemControls = () => {
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState<string | null>(null);
  const { stats, connected } = useAdminSystemStats(isSuperAdmin);

  const [autoOffMinutes, setAutoOffMinutes] = useState('60');
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleDurationMinutes, setScheduleDurationMinutes] = useState('0');

  const updateMaintenance = useMutation({
    mutationFn: async (patch: {
      maintenance_mode: boolean;
      maintenance_scheduled_start: string | null;
      maintenance_scheduled_end: string | null;
    }) => {
      const rows = [
        { key: 'maintenance_mode', value: String(patch.maintenance_mode) },
        { key: 'maintenance_scheduled_start', value: patch.maintenance_scheduled_start ?? '' },
        { key: 'maintenance_scheduled_end', value: patch.maintenance_scheduled_end ?? '' },
      ];
      const { error } = await supabase.from('site_settings' as any).upsert(rows, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => {
      // site_settings is cached platform-wide by useSettings.ts (which
      // MaintenanceGate reads) -- invalidate so the new value actually
      // takes effect immediately instead of waiting for its 3-minute staleTime.
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      toast.success('Maintenance settings updated');
    },
    onError: () => toast.error('Failed to update maintenance settings'),
  });

  // Quick manual switch -- always indefinite (no timer), and always clears
  // any pending/active schedule so flipping it off actually means "off",
  // not "off until a forgotten schedule reactivates it".
  const toggleNow = (checked: boolean) => {
    updateMaintenance.mutate({ maintenance_mode: checked, maintenance_scheduled_start: null, maintenance_scheduled_end: null });
  };

  const startTimedMaintenance = () => {
    const end = new Date(Date.now() + Number(autoOffMinutes) * 60000).toISOString();
    updateMaintenance.mutate({ maintenance_mode: true, maintenance_scheduled_start: null, maintenance_scheduled_end: end });
  };

  const scheduleFuture = () => {
    if (!scheduleStart) return;
    const startIso = new Date(scheduleStart).toISOString();
    const endIso = scheduleDurationMinutes !== '0'
      ? new Date(new Date(scheduleStart).getTime() + Number(scheduleDurationMinutes) * 60000).toISOString()
      : null;
    updateMaintenance.mutate({ maintenance_mode: false, maintenance_scheduled_start: startIso, maintenance_scheduled_end: endIso });
  };

  const clearSchedule = () => {
    updateMaintenance.mutate({ maintenance_mode: false, maintenance_scheduled_start: null, maintenance_scheduled_end: null });
  };

  const exportCSV = async (type: 'users' | 'orders' | 'revenue') => {
    setExporting(type);
    try {
      let csvContent = '';

      if (type === 'users') {
        const { data } = await supabase.from('user_profiles').select('id, full_name, phone, created_at').limit(5000);
        csvContent = 'ID,Name,Phone,Created At\n';
        csvContent += ((data || []) as any[]).map((u: any) => `"${u.id}","${u.full_name || ''}","${u.phone || ''}","${u.created_at || ''}"`).join('\n');
      } else if (type === 'orders') {
        const { data } = await supabase.from('orders').select('id, user_id, total, status, payment_method, coupon_code, created_at').limit(5000);
        csvContent = 'ID,User ID,Total,Status,Payment Method,Coupon,Created At\n';
        csvContent += ((data || []) as any[]).map((o: any) => `"${o.id}","${o.user_id}",${o.total},"${o.status || ''}","${o.payment_method || ''}","${o.coupon_code || ''}","${o.created_at || ''}"`).join('\n');
      } else {
        const { data } = await supabase.from('orders').select('total, status, payment_method, created_at').eq('status', 'completed').limit(5000);
        csvContent = 'Total,Status,Payment Method,Date\n';
        csvContent += ((data || []) as any[]).map((o: any) => `${o.total},"${o.status}","${o.payment_method || ''}","${o.created_at || ''}"`).join('\n');
      }

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${type} exported successfully`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(null);
    }
  };

  const clearCaches = () => {
    queryClient.clear();
    toast.success('Cleared this browser\'s cached data');
  };

  if (!isSuperAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="font-heading text-xl font-bold mb-2">Super Admin Only</h2>
            <p className="text-muted-foreground">This page is restricted to super administrators.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tableCounts = stats?.tableCounts
    ? Object.entries(stats.tableCounts).sort((a, b) => b[1] - a[1])
    : [];

  const services = stats?.services;
  const serviceRows = services
    ? [
        { name: 'SMTP (email)', icon: Mail, ok: services.smtpConfigured },
        { name: 'Web push (VAPID)', icon: Bell, ok: services.pushConfigured },
        { name: 'Cloudflare R2 storage', icon: Cloud, ok: services.r2Configured },
        { name: 'Cloudinary', icon: Cloud, ok: services.cloudinaryConfigured },
        { name: 'Google sign-in', icon: KeyRound, ok: services.googleOAuthConfigured },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Server className="h-6 w-6 text-primary" /> System Controls
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Live system health, exports, and maintenance</p>
        </div>
        <Badge variant="outline" className={`gap-1.5 ${connected ? 'border-green-300 text-green-700 bg-green-50' : 'border-amber-300 text-amber-700 bg-amber-50'}`}>
          {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {connected ? 'Live' : 'Connecting…'}
        </Badge>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold font-heading">{(stats?.totalRecords ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total DB Records</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-accent" />
              <div>
                <p className="text-2xl font-bold font-heading">{stats?.connectedUsers ?? 0}</p>
                <p className="text-xs text-muted-foreground">Live Connected Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <Cpu className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold font-heading">{stats ? formatUptime(stats.process.uptimeSeconds) : '—'}</p>
                <p className="text-xs text-muted-foreground">Backend Uptime</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <HardDrive className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold font-heading">{stats ? `${stats.process.memoryMb} MB` : '—'}</p>
                <p className="text-xs text-muted-foreground">Backend Memory</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Maintenance Mode */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Maintenance Mode</CardTitle>
            <CardDescription>
              Show a maintenance page to all visitors except admins. Supports an auto-off timer or scheduling a future start.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={stats?.maintenanceMode ? 'destructive' : 'default'}>
                  {stats?.maintenanceMode ? 'ON' : 'OFF'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {stats?.maintenanceMode ? 'Non-admins see a maintenance page' : 'Site is live'}
                </span>
              </div>
              <Switch
                checked={stats?.maintenanceManualFlag ?? false}
                onCheckedChange={toggleNow}
                disabled={!stats || updateMaintenance.isPending}
              />
            </div>

            {stats?.maintenanceScheduledStart && !stats?.maintenanceManualFlag && (
              <div className="text-xs rounded-md bg-muted/50 border p-2 flex items-center justify-between gap-2">
                <span>
                  Scheduled to start {formatDateTime(stats.maintenanceScheduledStart)}
                  {stats.maintenanceScheduledEnd ? ` · auto-off ${formatDateTime(stats.maintenanceScheduledEnd)}` : ''}
                </span>
                <Button size="sm" variant="ghost" className="h-6 px-2" onClick={clearSchedule}>Cancel</Button>
              </div>
            )}
            {stats?.maintenanceManualFlag && stats?.maintenanceScheduledEnd && (
              <div className="text-xs rounded-md bg-muted/50 border p-2">
                Auto turns off {formatDateTime(stats.maintenanceScheduledEnd)}
              </div>
            )}

            <div className="border-t pt-3 space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Turn on now for a limited time</p>
                <div className="flex gap-2">
                  <Select value={autoOffMinutes} onValueChange={setAutoOffMinutes}>
                    <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={startTimedMaintenance} disabled={updateMaintenance.isPending}>
                    Start timer
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Schedule for later</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <Input
                    type="datetime-local"
                    className="h-8 text-xs w-auto"
                    value={scheduleStart}
                    onChange={(e) => setScheduleStart(e.target.value)}
                  />
                  <Select value={scheduleDurationMinutes} onValueChange={setScheduleDurationMinutes}>
                    <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No auto-off</SelectItem>
                      {DURATION_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" disabled={!scheduleStart || updateMaintenance.isPending} onClick={scheduleFuture}>
                    Schedule
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database Connection Pool */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Database Connection Pool</CardTitle>
            <CardDescription>Live Postgres connection pool status</CardDescription>
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-bold font-heading">{stats.dbPool.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div>
                  <p className="text-xl font-bold font-heading text-green-600">{stats.dbPool.idle}</p>
                  <p className="text-xs text-muted-foreground">Idle</p>
                </div>
                <div>
                  <p className={`text-xl font-bold font-heading ${stats.dbPool.waiting > 0 ? 'text-amber-600' : ''}`}>{stats.dbPool.waiting}</p>
                  <p className="text-xs text-muted-foreground">Waiting</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Connecting…</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cache + Export */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cache Management</CardTitle>
            <CardDescription>Clear this browser's cached query data and force refresh</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={clearCaches} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Clear Local Cache
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" /> Bulk Data Export
            </CardTitle>
            <CardDescription>Download data as CSV files</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => exportCSV('users')} disabled={exporting === 'users'} className="gap-2">
                <Download className="h-4 w-4" /> {exporting === 'users' ? 'Exporting…' : 'Users'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportCSV('orders')} disabled={exporting === 'orders'} className="gap-2">
                <Download className="h-4 w-4" /> {exporting === 'orders' ? 'Exporting…' : 'Orders'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportCSV('revenue')} disabled={exporting === 'revenue'} className="gap-2">
                <Download className="h-4 w-4" /> {exporting === 'revenue' ? 'Exporting…' : 'Revenue'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5" /> Backend Services
          </CardTitle>
          <CardDescription>Whether each integration is actually configured right now</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serviceRows.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">Connecting…</TableCell></TableRow>
              ) : (
                serviceRows.map((s) => (
                  <TableRow key={s.name}>
                    <TableCell className="text-sm flex items-center gap-2"><s.icon className="h-4 w-4 text-muted-foreground" /> {s.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="default"
                        className={s.ok ? 'bg-green-500/10 text-green-600 border-green-200' : 'bg-red-500/10 text-red-600 border-red-200'}
                      >
                        {s.ok ? 'configured' : 'not configured'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Table Row Counts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-5 w-5" /> Database Table Overview
          </CardTitle>
          <CardDescription>Live row counts, updating automatically</CardDescription>
        </CardHeader>
        <CardContent>
          {tableCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Connecting…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableCounts.map(([name, count]) => (
                  <TableRow key={name}>
                    <TableCell className="font-mono text-sm">{name}</TableCell>
                    <TableCell className="text-right font-medium">{count.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemControls;
