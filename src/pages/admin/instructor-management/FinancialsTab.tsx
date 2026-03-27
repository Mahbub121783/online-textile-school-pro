import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DollarSign, TrendingUp, Clock, Gift, Check, X, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const FinancialsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: settings } = useSettings();

  const [globalShare, setGlobalShare] = useState('');
  const [bonusInstructor, setBonusInstructor] = useState('');
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusReason, setBonusReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const currentGlobalShare = settings?.['global_instructor_share'] || '70';

  // Fetch instructors
  const { data: instructors } = useQuery({
    queryKey: ['instructors-financial'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instructor');
      if (!roles?.length) return [];
      const ids = roles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', ids)
        .eq('is_active', true);
      return profiles || [];
    },
  });

  // Fetch courses for revenue share overrides
  const { data: courses } = useQuery({
    queryKey: ['courses-revenue-share'],
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('id, title, instructor_id, revenue_share_pct')
        .not('instructor_id', 'is', null)
        .order('title');
      return data || [];
    },
  });

  // Fetch withdrawal requests
  const { data: withdrawals = [], isLoading: loadingW } = useQuery({
    queryKey: ['withdrawal-requests'],
    queryFn: async () => {
      const { data } = await supabase
        .from('wallet_transactions')
        .select('*, wallets!inner(user_id, balance)')
        .eq('type', 'withdrawal_request')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!data?.length) return [];

      // Get user names
      const userIds = [...new Set(data.map((w: any) => (w.wallets as any)?.user_id).filter(Boolean))];
      const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', userIds);
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.full_name]));

      return data.map((w: any) => ({
        ...w,
        instructor_name: profileMap[(w.wallets as any)?.user_id] || 'Unknown',
        instructor_id: (w.wallets as any)?.user_id,
        wallet_balance: Number((w.wallets as any)?.balance || 0),
      }));
    },
  });

  // Fetch total payouts
  const { data: totalPayouts } = useQuery({
    queryKey: ['total-payouts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('wallet_transactions')
        .select('amount')
        .eq('type', 'debit');
      return data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    },
  });

  // Save global share
  const saveGlobalShare = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key: 'global_instructor_share', value: globalShare || currentGlobalShare }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      toast({ title: 'Global split saved', description: `Instructor share set to ${globalShare || currentGlobalShare}%` });
    },
  });

  // Update individual course revenue share
  const updateCourseShare = useMutation({
    mutationFn: async ({ courseId, pct }: { courseId: string; pct: number }) => {
      const { error } = await supabase
        .from('courses')
        .update({ revenue_share_pct: pct })
        .eq('id', courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses-revenue-share'] });
      toast({ title: 'Revenue share updated' });
    },
  });

  // Approve withdrawal
  const approveWithdrawal = useMutation({
    mutationFn: async (withdrawal: any) => {
      // Debit the wallet
      const { error: debitError } = await supabase.rpc('debit_wallet', {
        _user_id: withdrawal.instructor_id,
        _amount: Number(withdrawal.amount),
        _description: `Withdrawal approved — ${withdrawal.description?.replace('— Pending admin approval', '').trim() || 'Withdrawal'}`,
        _reference_id: withdrawal.reference_id || `wd-${Date.now()}`,
      });
      if (debitError) throw debitError;

      // Delete the withdrawal_request transaction (it's now replaced by the debit)
      await supabase.from('wallet_transactions').delete().eq('id', withdrawal.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawal-requests'] });
      queryClient.invalidateQueries({ queryKey: ['total-payouts'] });
      toast({ title: 'Withdrawal approved and processed' });
    },
    onError: (err: any) => toast({ title: 'Failed to approve', description: err.message, variant: 'destructive' }),
  });

  // Reject withdrawal
  const rejectWithdrawal = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      // Delete the request (or update description)
      await supabase.from('wallet_transactions').delete().eq('id', id);
    },
    onSuccess: () => {
      setRejectingId(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['withdrawal-requests'] });
      toast({ title: 'Withdrawal request rejected' });
    },
  });

  // Send bonus
  const sendBonus = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('credit_wallet', {
        _user_id: bonusInstructor,
        _amount: parseFloat(bonusAmount),
        _description: bonusReason || 'Admin bonus',
        _reference_id: `bonus-${Date.now()}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBonusInstructor('');
      setBonusAmount('');
      setBonusReason('');
      toast({ title: 'Bonus sent!', description: `৳${bonusAmount} credited to instructor wallet.` });
    },
  });

  const pendingWithdrawals = withdrawals?.length || 0;

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-secondary border-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold font-heading">{100 - Number(currentGlobalShare)}%</p>
                <p className="text-sm text-muted-foreground">Global Platform Profit</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-secondary border-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-warning" />
              <div>
                <p className="text-2xl font-bold font-heading">{pendingWithdrawals}</p>
                <p className="text-sm text-muted-foreground">Pending Withdrawals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-secondary border-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold font-heading">৳{totalPayouts?.toLocaleString() || '0'}</p>
                <p className="text-sm text-muted-foreground">Total Instructor Payouts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Split Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-secondary/50 border-none">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Global Instructor Share</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Input type="number" min={0} max={100} placeholder={currentGlobalShare} value={globalShare} onChange={(e) => setGlobalShare(e.target.value)} className="w-32" />
              <span className="text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">Current: {currentGlobalShare}% to instructors, {100 - Number(currentGlobalShare)}% platform</p>
            <Button className="bg-accent text-accent-foreground hover:bg-accent-hover" onClick={() => saveGlobalShare.mutate()} disabled={saveGlobalShare.isPending}>
              Save Global Split
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-secondary/50 border-none">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Individual Overrides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {courses?.map(course => (
                <div key={course.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate flex-1">{course.title}</span>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={0} max={100} className="w-20 h-8 text-xs" defaultValue={course.revenue_share_pct ?? currentGlobalShare}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val !== course.revenue_share_pct) {
                          updateCourseShare.mutate({ courseId: course.id, pct: val });
                        }
                      }}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
              {!courses?.length && <p className="text-sm text-muted-foreground">No courses found.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal Queue with Approve/Reject */}
      <Card className="bg-secondary/50 border-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg">Withdrawal Queue</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/payment/dashboard')}>
              <ExternalLink className="h-4 w-4 mr-1" /> View in Payment Dashboard
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending withdrawal requests.</p>
          ) : (
            <div className="rounded-lg overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Wallet Balance</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((w: any) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.instructor_name}</TableCell>
                      <TableCell className="font-bold text-primary">৳{Number(w.amount).toLocaleString()}</TableCell>
                      <TableCell>৳{w.wallet_balance.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{w.description}</TableCell>
                      <TableCell>{w.created_at ? format(new Date(w.created_at), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs"
                            onClick={() => approveWithdrawal.mutate(w)}
                            disabled={approveWithdrawal.isPending || w.wallet_balance < Number(w.amount)}
                          >
                            <Check className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Dialog open={rejectingId === w.id} onOpenChange={(open) => { if (!open) setRejectingId(null); }}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setRejectingId(w.id)}>
                                <X className="h-3 w-3 mr-1" /> Reject
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader><DialogTitle>Reject Withdrawal</DialogTitle></DialogHeader>
                              <div className="space-y-3">
                                <p className="text-sm">Rejecting ৳{Number(w.amount).toLocaleString()} request from {w.instructor_name}</p>
                                <div className="space-y-1">
                                  <Label>Reason (optional)</Label>
                                  <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." />
                                </div>
                                <Button variant="destructive" className="w-full" onClick={() => rejectWithdrawal.mutate({ id: w.id, reason: rejectReason })}>
                                  Confirm Rejection
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bonus Widget */}
      <Card className="bg-secondary/50 border-none">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Gift className="h-5 w-5 text-accent" /> Bonus / Gift
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={bonusInstructor} onValueChange={setBonusInstructor}>
              <SelectTrigger><SelectValue placeholder="Select Instructor" /></SelectTrigger>
              <SelectContent>
                {instructors?.map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.full_name || i.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Bonus Amount (৳)" value={bonusAmount} onChange={(e) => setBonusAmount(e.target.value)} />
            <Textarea placeholder="Reason (e.g., Top Weaving Course)" value={bonusReason} onChange={(e) => setBonusReason(e.target.value)} className="min-h-[40px]" />
          </div>
          <Button className="bg-accent text-accent-foreground hover:bg-accent-hover" onClick={() => sendBonus.mutate()} disabled={sendBonus.isPending || !bonusInstructor || !bonusAmount}>
            Send Bonus
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialsTab;
