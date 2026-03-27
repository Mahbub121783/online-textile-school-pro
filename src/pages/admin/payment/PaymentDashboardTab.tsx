import { useState, useMemo, forwardRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DollarSign, TrendingUp, TrendingDown, ShoppingCart, Download, CalendarIcon, Users, Wallet } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const PaymentDashboardTab = () => {
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [selectedUser, setSelectedUser] = useState<string>('all');

  const { data: allOrders = [] } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const { data } = await supabase.from('orders').select('*, user_profiles!orders_user_id_fkey(full_name)').order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: refunds = [] } = useQuery({
    queryKey: ['admin-refunds-summary'],
    queryFn: async () => {
      const { data } = await supabase.from('refund_requests').select('*').eq('status', 'processed');
      return (data || []) as any[];
    },
  });

  const { data: walletTxs = [] } = useQuery({
    queryKey: ['admin-wallet-txs'],
    queryFn: async () => {
      const { data } = await supabase.from('wallet_transactions').select('*, wallets!inner(user_id)').order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: instructors = [] } = useQuery({
    queryKey: ['admin-instructors-list'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'instructor');
      if (!roles?.length) return [];
      const ids = roles.map(r => r.user_id);
      const { data } = await supabase.from('user_profiles').select('id, full_name').in('id', ids);
      return (data || []) as any[];
    },
  });

  const { data: instructorWallets = [] } = useQuery({
    queryKey: ['admin-instructor-wallets'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'instructor');
      if (!roles?.length) return [];
      const ids = roles.map(r => r.user_id);
      const { data } = await supabase.from('wallets').select('*').in('user_id', ids);
      return (data || []) as any[];
    },
  });

  const filteredOrders = useMemo(() => {
    return allOrders.filter((o: any) => {
      if (!o.created_at) return true;
      const d = new Date(o.created_at);
      if (startDate && d < startOfDay(startDate)) return false;
      if (endDate && d > endOfDay(endDate)) return false;
      return true;
    });
  }, [allOrders, startDate, endDate]);

  const completedOrders = filteredOrders.filter((o: any) => o.status === 'completed');
  const pendingOrders = filteredOrders.filter((o: any) => o.status === 'pending');
  const totalRevenue = completedOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
  const totalRefunds = refunds.reduce((s: number, r: any) => s + Number(r.amount), 0);

  const instructorCredits = walletTxs.filter((t: any) => t.type === 'credit' && t.description?.includes('Revenue'));
  const totalInstructorShares = instructorCredits.reduce((s: number, t: any) => s + Number(t.amount), 0);
  const platformRevenue = totalRevenue - totalInstructorShares;
  const netProfit = platformRevenue - totalRefunds;

  const instructorPayouts = walletTxs.filter((t: any) => t.type === 'debit');
  const totalPayouts = instructorPayouts.reduce((s: number, t: any) => s + Number(t.amount), 0);

  const revenueByMethod = useMemo(() => {
    const map: Record<string, number> = {};
    completedOrders.forEach((o: any) => {
      const method = o.payment_method || 'unknown';
      map[method] = (map[method] || 0) + Number(o.total);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [completedOrders]);

  const selectedInstructorData = useMemo(() => {
    if (selectedUser === 'all') return null;
    const wallet = instructorWallets.find((w: any) => w.user_id === selectedUser);
    const userTxs = walletTxs.filter((t: any) => (t.wallets as any)?.user_id === selectedUser);
    const credits = userTxs.filter((t: any) => t.type === 'credit');
    const debits = userTxs.filter((t: any) => t.type === 'debit');
    const pendingW = userTxs.filter((t: any) => t.type === 'withdrawal_request');
    return {
      balance: Number(wallet?.balance || 0),
      totalEarned: credits.reduce((s: number, t: any) => s + Number(t.amount), 0),
      totalWithdrawn: debits.reduce((s: number, t: any) => s + Number(t.amount), 0),
      pendingWithdrawals: pendingW.length,
      recentTxs: userTxs.slice(0, 10),
    };
  }, [selectedUser, walletTxs, instructorWallets]);

  const exportCSV = () => {
    const headers = ['Order ID', 'Customer', 'Amount', 'Payment Method', 'Status', 'Date'];
    const rows = filteredOrders.map((o: any) => [
      o.id,
      (o.user_profiles as any)?.full_name || 'N/A',
      Number(o.total).toFixed(2),
      o.payment_method || 'N/A',
      o.status || 'pending',
      o.created_at ? format(new Date(o.created_at), 'yyyy-MM-dd HH:mm') : 'N/A',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <DatePicker label="From" date={startDate} onSelect={setStartDate} />
        <DatePicker label="To" date={endDate} onSelect={setEndDate} />
        {(startDate || endDate) && (
          <Button variant="ghost" size="sm" onClick={() => { setStartDate(undefined); setEndDate(undefined); }}>Clear</Button>
        )}
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard label="Total Revenue" value={`৳${totalRevenue.toLocaleString()}`} icon={DollarSign} color="text-primary" />
        <MetricCard label="Platform Revenue" value={`৳${platformRevenue.toLocaleString()}`} icon={TrendingUp} color="text-accent" />
        <MetricCard label="Instructor Shares" value={`৳${totalInstructorShares.toLocaleString()}`} icon={Users} color="text-muted-foreground" />
        <MetricCard label="Refunds Issued" value={`৳${totalRefunds.toLocaleString()}`} icon={TrendingDown} color="text-destructive" />
        <MetricCard label="Net Profit" value={`৳${netProfit.toLocaleString()}`} icon={Wallet} color="text-primary" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard label="Completed Orders" value={completedOrders.length} icon={ShoppingCart} color="text-primary" />
        <MetricCard label="Pending Orders" value={pendingOrders.length} icon={ShoppingCart} color="text-muted-foreground" />
        <MetricCard label="Instructor Payouts" value={`৳${totalPayouts.toLocaleString()}`} icon={DollarSign} color="text-accent" />
      </div>

      {revenueByMethod.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by Payment Method</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueByMethod}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {revenueByMethod.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base">Instructor Financial View</CardTitle>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-60"><SelectValue placeholder="All instructors" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Instructors</SelectItem>
                {instructors.map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>{i.full_name || i.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {selectedInstructorData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Wallet Balance</p>
                  <p className="text-lg font-bold">৳{selectedInstructorData.balance.toLocaleString()}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Total Earned</p>
                  <p className="text-lg font-bold text-primary">৳{selectedInstructorData.totalEarned.toLocaleString()}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Total Withdrawn</p>
                  <p className="text-lg font-bold">৳{selectedInstructorData.totalWithdrawn.toLocaleString()}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Pending Withdrawals</p>
                  <p className="text-lg font-bold">{selectedInstructorData.pendingWithdrawals}</p>
                </div>
              </div>
              {selectedInstructorData.recentTxs.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInstructorData.recentTxs.map((tx: any) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm">{tx.created_at ? format(new Date(tx.created_at), 'dd MMM yyyy') : 'N/A'}</TableCell>
                        <TableCell className="text-sm">{tx.description || '—'}</TableCell>
                        <TableCell><Badge variant={tx.type === 'credit' ? 'default' : 'destructive'}>{tx.type}</Badge></TableCell>
                        <TableCell className={`text-right font-medium ${tx.type === 'credit' ? 'text-primary' : 'text-destructive'}`}>
                          {tx.type === 'credit' ? '+' : '-'}৳{Number(tx.amount).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select an instructor to view their financial details.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Orders ({filteredOrders.length})</CardTitle></CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No orders found for the selected period.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.slice(0, 50).map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="text-sm">{(o.user_profiles as any)?.full_name || 'N/A'}</TableCell>
                    <TableCell className="text-sm font-medium">৳{Number(o.total).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{o.payment_method || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={o.status === 'completed' ? 'default' : o.status === 'pending' ? 'secondary' : 'destructive'}>
                        {o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{o.created_at ? format(new Date(o.created_at), 'dd MMM yyyy') : 'N/A'}</TableCell>
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

const MetricCard = forwardRef<HTMLDivElement, { label: string; value: string | number; icon: any; color: string }>(
  ({ label, value, icon: Icon, color }, ref) => (
    <Card ref={ref}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 ${color}`} />
          <div>
            <p className="text-lg font-bold font-heading">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
);
MetricCard.displayName = 'MetricCard';

const DatePicker = ({ label, date, onSelect }: { label: string; date?: Date; onSelect: (d: Date | undefined) => void }) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" size="sm" className={cn('justify-start text-left font-normal', !date && 'text-muted-foreground')}>
        <CalendarIcon className="h-4 w-4 mr-1" />
        {date ? format(date, 'dd MMM yyyy') : label}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className="p-3 pointer-events-auto" />
    </PopoverContent>
  </Popover>
);

export default PaymentDashboardTab;
