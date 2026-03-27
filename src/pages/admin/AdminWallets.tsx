import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Wallet, Search, Plus, Minus, ArrowUpRight, ArrowDownRight, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

const AdminWallets = () => {
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [txType, setTxType] = useState<'credit' | 'debit'>('credit');
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const queryClient = useQueryClient();

  const { data: wallets = [], isLoading } = useQuery({
    queryKey: ['admin-wallets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallets')
        .select('*, user_profiles!wallets_user_id_fkey(full_name, phone)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['admin-wallet-transactions', selectedUserId],
    enabled: !!selectedUserId,
    queryFn: async () => {
      const wallet = wallets.find((w: any) => w.user_id === selectedUserId);
      if (!wallet) return [];
      const { data } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  // Top-up requests
  const { data: topupRequests = [] } = useQuery({
    queryKey: ['admin-topup-requests'],
    queryFn: async () => {
      const { data } = await supabase
        .from('wallet_topup_requests' as any)
        .select('*')
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  // Fetch user profiles for top-up requests
  const { data: userProfiles = [] } = useQuery({
    queryKey: ['admin-user-profiles-for-topups'],
    queryFn: async () => {
      const { data } = await supabase.from('user_profiles').select('id, full_name, phone');
      return data ?? [];
    },
  });

  const getUserName = (userId: string) => {
    const p = userProfiles.find((u: any) => u.id === userId) as any;
    return p?.full_name || 'Unknown';
  };

  const walletMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(txAmount);
      if (!amount || amount <= 0) throw new Error('Invalid amount');
      if (!selectedUserId) throw new Error('No user selected');

      const fnName = txType === 'credit' ? 'credit_wallet' : 'debit_wallet';
      const { error } = await supabase.rpc(fnName as any, {
        _user_id: selectedUserId,
        _amount: amount,
        _description: txDescription || `Admin ${txType}`,
        _reference_id: `admin-${Date.now()}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['admin-wallet-transactions'] });
      toast.success(`Wallet ${txType}ed successfully`);
      setTxAmount('');
      setTxDescription('');
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approveTopup = async (request: any) => {
    try {
      const { error: rpcError } = await supabase.rpc('credit_wallet' as any, {
        _user_id: request.user_id,
        _amount: request.amount,
        _description: `Wallet top-up via ${request.payment_method} (TxID: ${request.transaction_id})`,
        _reference_id: `topup-${request.id}`,
      });
      if (rpcError) throw rpcError;

      const { error: updateError } = await supabase
        .from('wallet_topup_requests' as any)
        .update({ status: 'approved', processed_at: new Date().toISOString() } as any)
        .eq('id', request.id);
      if (updateError) throw updateError;

      toast.success('Top-up approved and wallet credited!');
      queryClient.invalidateQueries({ queryKey: ['admin-topup-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-wallets'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
    }
  };

  const rejectTopup = async (request: any) => {
    try {
      const { error } = await supabase
        .from('wallet_topup_requests' as any)
        .update({ status: 'rejected', admin_note: rejectNote || 'Rejected by admin', processed_at: new Date().toISOString() } as any)
        .eq('id', request.id);
      if (error) throw error;

      toast.success('Top-up request rejected');
      setRejectNote('');
      queryClient.invalidateQueries({ queryKey: ['admin-topup-requests'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject');
    }
  };

  const filtered = wallets.filter((w: any) => {
    if (!search) return true;
    const name = (w.user_profiles as any)?.full_name?.toLowerCase() ?? '';
    return name.includes(search.toLowerCase());
  });

  const totalBalance = wallets.reduce((sum: number, w: any) => sum + Number(w.balance ?? 0), 0);
  const pendingTopups = topupRequests.filter((r: any) => r.status === 'pending');

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold">Wallet Management</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Wallets</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{wallets.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Balance</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-primary">৳{totalBalance.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active Wallets</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{wallets.filter((w: any) => Number(w.balance) > 0).length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending Requests</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-orange-500">{pendingTopups.length}</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="wallets">
        <TabsList>
          <TabsTrigger value="wallets">All Wallets</TabsTrigger>
          <TabsTrigger value="topup-requests">
            Top-Up Requests {pendingTopups.length > 0 && <Badge variant="destructive" className="ml-1 text-xs">{pendingTopups.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawal Requests</TabsTrigger>
        </TabsList>

        {/* All Wallets Tab */}
        <TabsContent value="wallets" className="space-y-4">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No wallets found</TableCell></TableRow>
                  ) : filtered.map((w: any) => (
                    <TableRow key={w.id} className={selectedUserId === w.user_id ? 'bg-muted/50' : ''}>
                      <TableCell className="font-medium">{(w.user_profiles as any)?.full_name || 'Unknown'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{(w.user_profiles as any)?.phone || '—'}</TableCell>
                      <TableCell className="text-right font-bold">৳{Number(w.balance ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{w.updated_at ? format(new Date(w.updated_at), 'dd MMM yyyy') : '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Dialog open={dialogOpen && selectedUserId === w.user_id} onOpenChange={(open) => { setDialogOpen(open); if (open) setSelectedUserId(w.user_id); }}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" className="gap-1" onClick={() => { setSelectedUserId(w.user_id); setTxType('credit'); }}>
                                <Plus className="h-3 w-3" /> Credit
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader><DialogTitle>{txType === 'credit' ? 'Credit' : 'Debit'} Wallet</DialogTitle></DialogHeader>
                              <div className="space-y-4">
                                <div className="flex gap-2">
                                  <Button variant={txType === 'credit' ? 'default' : 'outline'} size="sm" onClick={() => setTxType('credit')}>Credit</Button>
                                  <Button variant={txType === 'debit' ? 'default' : 'outline'} size="sm" onClick={() => setTxType('debit')}>Debit</Button>
                                </div>
                                <div><Label>Amount (৳)</Label><Input type="number" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} placeholder="0" /></div>
                                <div><Label>Description</Label><Textarea value={txDescription} onChange={(e) => setTxDescription(e.target.value)} placeholder="Reason for transaction..." /></div>
                                <Button onClick={() => walletMutation.mutate()} disabled={walletMutation.isPending} className="w-full">
                                  {walletMutation.isPending ? 'Processing...' : `${txType === 'credit' ? 'Credit' : 'Debit'} ৳${txAmount || '0'}`}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button size="sm" variant="ghost" onClick={() => setSelectedUserId(selectedUserId === w.user_id ? null : w.user_id)}>
                            History
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {selectedUserId && transactions.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Transaction History</CardTitle></CardHeader>
              <CardContent>
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
                        <TableCell className="text-sm">{format(new Date(tx.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                        <TableCell className="text-sm">{tx.description || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={tx.type === 'credit' ? 'default' : 'destructive'} className="gap-1">
                            {tx.type === 'credit' ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                            {tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${tx.type === 'credit' ? 'text-green-600' : 'text-destructive'}`}>
                          {tx.type === 'credit' ? '+' : '-'}৳{Number(tx.amount).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Top-Up Requests Tab */}
        <TabsContent value="topup-requests">
          <Card>
            <CardHeader><CardTitle>Top-Up Requests</CardTitle></CardHeader>
            <CardContent>
              {topupRequests.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No top-up requests yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topupRequests.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">{format(new Date(r.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                        <TableCell className="font-medium">{getUserName(r.user_id)}</TableCell>
                        <TableCell className="text-sm capitalize">{r.payment_method}</TableCell>
                        <TableCell className="text-sm font-mono">{r.transaction_id || '—'}</TableCell>
                        <TableCell className="text-right font-bold">৳{Number(r.amount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'}>
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {r.status === 'pending' && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="default" className="gap-1" onClick={() => approveTopup(r)}>
                                <CheckCircle className="h-3 w-3" /> Approve
                              </Button>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="destructive" className="gap-1">
                                    <XCircle className="h-3 w-3" /> Reject
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader><DialogTitle>Reject Top-Up Request</DialogTitle></DialogHeader>
                                  <div className="space-y-4">
                                    <p className="text-sm">৳{Number(r.amount).toLocaleString()} via {r.payment_method} (TxID: {r.transaction_id})</p>
                                    <div><Label>Reason (optional)</Label><Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Reason for rejection..." /></div>
                                    <Button variant="destructive" className="w-full" onClick={() => rejectTopup(r)}>Confirm Rejection</Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          )}
                          {r.status !== 'pending' && r.admin_note && (
                            <span className="text-xs text-muted-foreground">{r.admin_note}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Withdrawal Requests Tab */}
        <TabsContent value="withdrawals">
          <WithdrawalRequestsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Withdrawal requests from wallet_transactions
const WithdrawalRequestsTab = () => {
  const queryClient = useQueryClient();

  const { data: withdrawals = [] } = useQuery({
    queryKey: ['admin-withdrawal-requests'],
    queryFn: async () => {
      const { data } = await supabase
        .from('wallet_transactions')
        .select('*, wallets!inner(user_id, user_profiles!wallets_user_id_fkey(full_name))')
        .eq('type', 'withdrawal_request')
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const approveWithdrawal = async (tx: any) => {
    try {
      const userId = (tx.wallets as any)?.user_id;
      if (!userId) throw new Error('User not found');

      // Debit wallet
      const { error: debitErr } = await supabase.rpc('debit_wallet' as any, {
        _user_id: userId,
        _amount: tx.amount,
        _description: `Withdrawal processed: ${tx.description}`,
        _reference_id: `wd-${tx.id}`,
      });
      if (debitErr) throw debitErr;

      // Delete the withdrawal_request transaction (it's been replaced by the debit)
      await supabase.from('wallet_transactions').delete().eq('id', tx.id);

      toast.success('Withdrawal approved and processed!');
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawal-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-wallets'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to process');
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Withdrawal Requests</CardTitle></CardHeader>
      <CardContent>
        {withdrawals.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No withdrawal requests.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals.map((tx: any) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-sm">{format(new Date(tx.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                  <TableCell className="font-medium">{(tx.wallets as any)?.user_profiles?.full_name || 'Unknown'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{tx.description || '—'}</TableCell>
                  <TableCell className="text-right font-bold">৳{Number(tx.amount).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="default" className="gap-1" onClick={() => approveWithdrawal(tx)}>
                      <CheckCircle className="h-3 w-3" /> Approve & Process
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminWallets;
