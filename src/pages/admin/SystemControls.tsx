import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldAlert, Download, Database, RefreshCw, Server, HardDrive, Zap, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

const SystemControls = () => {
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState<string | null>(null);

  const { data: maintenanceMode } = useQuery({
    queryKey: ['maintenance-mode'],
    queryFn: async () => {
      const { data } = await supabase.from('site_settings' as any).select('*').eq('key', 'maintenance_mode').single();
      return (data as any)?.value === 'true';
    },
    enabled: isSuperAdmin,
  });

  const { data: tableCounts, isLoading: countsLoading } = useQuery({
    queryKey: ['system-table-counts'],
    queryFn: async () => {
      const tables = ['user_profiles', 'courses', 'enrollments', 'orders', 'lessons', 'quizzes', 'assignments', 'certificates', 'ebooks', 'notifications', 'media_library', 'wallet_transactions'];
      const results: { name: string; count: number }[] = [];

      await Promise.all(
        tables.map(async (table) => {
          const { count } = await supabase.from(table as any).select('id', { count: 'exact', head: true });
          results.push({ name: table, count: count ?? 0 });
        })
      );

      results.sort((a, b) => b.count - a.count);
      return results;
    },
    enabled: isSuperAdmin,
  });

  const { data: edgeFunctions } = useQuery({
    queryKey: ['edge-functions-list'],
    queryFn: () => {
      return [
        { name: 'cloudinary-proxy', status: 'deployed' },
        { name: 'r2-presign', status: 'deployed' },
        { name: 'process-payment', status: 'deployed' },
      ];
    },
    enabled: isSuperAdmin,
  });

  const toggleMaintenance = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from('site_settings' as any).upsert(
        { key: 'maintenance_mode', value: String(enabled) },
        { onConflict: 'key' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-mode'] });
      toast.success('Maintenance mode updated');
    },
    onError: () => toast.error('Failed to update maintenance mode'),
  });

  const exportCSV = async (type: 'users' | 'orders' | 'revenue') => {
    setExporting(type);
    try {
      let csvContent = '';
      
      if (type === 'users') {
        const { data } = await supabase.from('user_profiles').select('id, full_name, phone, bio, created_at').limit(5000);
        csvContent = 'ID,Name,Phone,Bio,Created At\n';
        csvContent += (data || []).map(u => `"${u.id}","${u.full_name || ''}","${u.phone || ''}","${(u.bio || '').replace(/"/g, '""')}","${u.created_at || ''}"`).join('\n');
      } else if (type === 'orders') {
        const { data } = await supabase.from('orders').select('id, user_id, total, status, payment_method, coupon_code, created_at').limit(5000);
        csvContent = 'ID,User ID,Total,Status,Payment Method,Coupon,Created At\n';
        csvContent += (data || []).map(o => `"${o.id}","${o.user_id}",${o.total},"${o.status || ''}","${o.payment_method || ''}","${o.coupon_code || ''}","${o.created_at || ''}"`).join('\n');
      } else {
        const { data } = await supabase.from('orders').select('total, status, payment_method, created_at').eq('status', 'completed').limit(5000);
        csvContent = 'Total,Status,Payment Method,Date\n';
        csvContent += (data || []).map(o => `${o.total},"${o.status}","${o.payment_method || ''}","${o.created_at || ''}"`).join('\n');
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
    toast.success('All query caches cleared');
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

  const totalRecords = tableCounts?.reduce((sum, t) => sum + t.count, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Server className="h-6 w-6 text-primary" /> System Controls
        </h2>
        <p className="text-muted-foreground text-sm mt-1">System health, exports, and maintenance</p>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold font-heading">{totalRecords.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total DB Records</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <Zap className="h-8 w-8 text-accent" />
              <div>
                <p className="text-2xl font-bold font-heading">{edgeFunctions?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Edge Functions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <HardDrive className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold font-heading">{tableCounts?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Active Tables</p>
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
            <CardDescription>Toggle site maintenance mode for visitors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={maintenanceMode ? 'destructive' : 'default'}>
                  {maintenanceMode ? 'ON' : 'OFF'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {maintenanceMode ? 'Site is in maintenance' : 'Site is live'}
                </span>
              </div>
              <Switch
                checked={maintenanceMode ?? false}
                onCheckedChange={(checked) => toggleMaintenance.mutate(checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Cache Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cache Management</CardTitle>
            <CardDescription>Clear all cached data and force refresh</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={clearCaches} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Clear All Caches
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Bulk Data Export
          </CardTitle>
          <CardDescription>Download data as CSV files</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => exportCSV('users')} disabled={exporting === 'users'} className="gap-2">
              <Download className="h-4 w-4" /> {exporting === 'users' ? 'Exporting...' : 'Export Users'}
            </Button>
            <Button variant="outline" onClick={() => exportCSV('orders')} disabled={exporting === 'orders'} className="gap-2">
              <Download className="h-4 w-4" /> {exporting === 'orders' ? 'Exporting...' : 'Export Orders'}
            </Button>
            <Button variant="outline" onClick={() => exportCSV('revenue')} disabled={exporting === 'revenue'} className="gap-2">
              <Download className="h-4 w-4" /> {exporting === 'revenue' ? 'Exporting...' : 'Export Revenue'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edge Functions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5" /> Edge Functions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Function</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {edgeFunctions?.map(fn => (
                <TableRow key={fn.name}>
                  <TableCell className="font-mono text-sm">{fn.name}</TableCell>
                  <TableCell>
                    <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-200">
                      {fn.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
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
        </CardHeader>
        <CardContent>
          {countsLoading ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableCounts?.map(t => (
                  <TableRow key={t.name}>
                    <TableCell className="font-mono text-sm">{t.name}</TableCell>
                    <TableCell className="text-right font-medium">{t.count.toLocaleString()}</TableCell>
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
