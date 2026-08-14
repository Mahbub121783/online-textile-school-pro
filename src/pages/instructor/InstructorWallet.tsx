import { useState } from 'react';
import { Wallet, ArrowUpRight, ArrowDownRight, Send, Plus } from 'lucide-react';
import { useWallet, useWalletTransactions } from '@/hooks/useEnrollments';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

const WITHDRAWAL_METHODS = [
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'rocket', label: 'Rocket' },
  { value: 'bank', label: 'Bank Transfer' },
];

const InstructorWallet = () => {
  const { user } = useAuth();
  const { data: wallet, isLoading: loadingW } = useWallet();
  const { data: transactions = [], isLoading: loadingT } = useWalletTransactions();
  const queryClient = useQueryClient();

  const { data: gateways = [] } = useQuery({
    queryKey: ['payment-gateways-all'],
    queryFn: async () => {
      const { data } = await supabase.from('payment_gateways').select('id, gateway_name, display_name, is_active, credentials');
      return (data || []) as any[];
    },
  });

  const { data: topupRequests = [] } = useQuery({
    queryKey: ['topup-requests', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('wallet_topup_requests' as any).select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const [addOpen, setAddOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupMethod, setTopupMethod] = useState('');
  const [topupTxId, setTopupTxId] = useState('');
  const [topupSubmitting, setTopupSubmitting] = useState(false);

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('');
  const [withdrawAccount, setWithdrawAccount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  if (loadingW || loadingT) {
    return <div className="animate-pulse text-muted-foreground py-12 text-center">Loading wallet...</div>;
  }

  const balance = Number(wallet?.balance ?? 0);
  const earnings = transactions.filter((tx: any) => tx.type === 'credit');
  const totalEarnings = earnings.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);
  const pendingWithdrawals = transactions.filter((tx: any) => tx.type === 'withdrawal_request');
  const pendingTopups = topupRequests.filter((r: any) => r.status === 'pending');

  const getSendMoneyGateways = () =>
    gateways.filter((g: any) => ['bkash', 'nagad', 'rocket'].includes(g.gateway_name) && g.credentials?.payment_mode === 'send_money');

  const selectedGw = gateways.find((g: any) => g.gateway_name === topupMethod);

  const handleTopup = async () => {
    const amount = parseFloat(topupAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (!topupMethod) { toast.error('Select a payment method'); return; }
    if (!topupTxId.trim()) { toast.error('Enter the Transaction ID'); return; }

    setTopupSubmitting(true);
    try {
      const { error } = await supabase.from('wallet_topup_requests' as any).insert({
        user_id: user!.id,
        amount,
        payment_method: topupMethod,
        transaction_id: topupTxId.trim(),
        account_number: selectedGw?.credentials?.phone_number || '',
      });
      if (error) throw error;
      toast.success('Top-up request submitted! Please wait 10-15 minutes for admin verification.');
      setAddOpen(false);
      setTopupAmount(''); setTopupMethod(''); setTopupTxId('');
      queryClient.invalidateQueries({ queryKey: ['topup-requests'] });
    } catch (err: any) { toast.error(err.message || 'Failed to submit'); }
    setTopupSubmitting(false);
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (amount > balance) { toast.error('Amount exceeds wallet balance'); return; }
    if (!withdrawMethod) { toast.error('Select a withdrawal method'); return; }

    setWithdrawing(true);
    try {
      const walletId = wallet?.id;
      if (!walletId) throw new Error('Wallet not found');
      const { error } = await supabase.from('wallet_transactions').insert({
        wallet_id: walletId, amount, type: 'withdrawal_request',
        description: `Withdrawal via ${withdrawMethod}${withdrawAccount ? ` (${withdrawAccount})` : ''} — Pending admin approval`,
        reference_id: `wr-${Date.now()}`,
      });
      if (error) throw error;
      toast.success('Withdrawal request submitted!');
      setWithdrawOpen(false);
      setWithdrawAmount(''); setWithdrawMethod(''); setWithdrawAccount('');
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    } catch (err: any) { toast.error(err.message || 'Failed'); }
    setWithdrawing(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold">Instructor Wallet</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="h-6 w-6" />
            <span className="text-sm font-medium opacity-80">Available Balance</span>
          </div>
          <p className="font-heading text-3xl font-bold">৳{balance.toLocaleString()}</p>
        </div>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Earnings</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-primary">৳{totalEarnings.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Transactions</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{transactions.length}</p></CardContent>
        </Card>
      </div>

      <div className="flex gap-3 flex-wrap">
        {/* Add Funds */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-1"><Plus className="h-4 w-4" /> Add Funds</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Funds to Wallet</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Amount (৳)</Label>
                <Input type="number" min={1} placeholder="Enter amount" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={topupMethod} onValueChange={setTopupMethod}>
                  <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>
                    {getSendMoneyGateways().map((gw: any) => (
                      <SelectItem key={gw.gateway_name} value={gw.gateway_name}>{gw.display_name}</SelectItem>
                    ))}
                    {getSendMoneyGateways().length === 0 && (
                      <>
                        <SelectItem value="bkash">bKash</SelectItem>
                        <SelectItem value="nagad">Nagad</SelectItem>
                        <SelectItem value="rocket">Rocket</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {topupMethod && selectedGw?.credentials?.phone_number && (
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-sm text-muted-foreground">Send money to:</p>
                  <p className="text-xl font-bold text-primary">{selectedGw.credentials.phone_number}</p>
                  <p className="text-xs text-muted-foreground">{selectedGw.display_name} ({selectedGw.credentials.account_type || 'Personal'})</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Transaction ID *</Label>
                <Input placeholder="Enter Transaction ID" value={topupTxId} onChange={(e) => setTopupTxId(e.target.value)} />
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                ⏳ Please wait 10-15 minutes. Your balance will be loaded after admin verification.
              </div>
              <Button className="w-full" onClick={handleTopup} disabled={topupSubmitting}>
                {topupSubmitting ? 'Submitting...' : 'Submit Top-Up Request'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Withdraw */}
        <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={balance <= 0} className="gap-1"><Send className="h-4 w-4" /> Request Withdrawal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Request Withdrawal</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Available balance: <strong>৳{balance.toLocaleString()}</strong></p>
              <div className="space-y-2">
                <Label>Amount (৳)</Label>
                <Input type="number" min={1} max={balance} placeholder={`Max ৳${balance.toLocaleString()}`} value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Withdrawal Method</Label>
                <Select value={withdrawMethod} onValueChange={setWithdrawMethod}>
                  <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>
                    {WITHDRAWAL_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Account Number / Phone</Label>
                <Input placeholder="01XXXXXXXXX or account number" value={withdrawAccount} onChange={(e) => setWithdrawAccount(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handleWithdraw} disabled={withdrawing}>
                {withdrawing ? 'Submitting...' : 'Submit Withdrawal Request'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Top-Ups */}
      {pendingTopups.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pending Top-Up Requests</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingTopups.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm font-medium">৳{Number(r.amount).toLocaleString()} via {r.payment_method}</p>
                    <p className="text-xs text-muted-foreground">TxID: {r.transaction_id} • {format(new Date(r.created_at), 'dd MMM yyyy')}</p>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Withdrawals */}
      {pendingWithdrawals.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pending Withdrawal Requests</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingWithdrawals.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm font-medium">৳{Number(tx.amount).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{tx.description}</p>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader><CardTitle>Transaction History</CardTitle></CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No transactions yet. Earnings from course sales will appear here.</p>
          ) : (
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
                {transactions.map((tx: any) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm">{format(new Date(tx.created_at), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="text-sm">{tx.description || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={tx.type === 'credit' ? 'default' : tx.type === 'withdrawal_request' ? 'secondary' : 'destructive'} className="gap-1">
                        {tx.type === 'credit' ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {tx.type === 'withdrawal_request' ? 'Pending' : tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${tx.type === 'credit' ? 'text-green-600' : 'text-destructive'}`}>
                      {tx.type === 'credit' ? '+' : '-'}৳{Number(tx.amount).toLocaleString()}
                    </TableCell>
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

export default InstructorWallet;
