import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Search, RefreshCw, Wallet, CreditCard, Plus } from 'lucide-react';

const RefundsTab = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('wallet');
  const [refundReason, setRefundReason] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: refunds, isLoading } = useQuery({
    queryKey: ['refund-requests'],
    queryFn: async () => {
      const { data } = await supabase.from('refund_requests' as any).select('*').order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const { data } = await supabase.from('orders').select('*, user_profiles:user_id(full_name), order_items(*)').or(`id.eq.${query},payment_reference.eq.${query}`).limit(1).maybeSingle();
      return data;
    },
    onSuccess: (data) => {
      if (data) {
        setSelectedOrder(data);
        setRefundAmount(String(data.total));
      } else {
        toast({ title: 'Order not found', variant: 'destructive' });
      }
    },
  });

  const refundMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder || !user) return;
      const amount = parseFloat(refundAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid amount');

      // Insert refund request
      await supabase.from('refund_requests' as any).insert({
        order_id: selectedOrder.id,
        user_id: selectedOrder.user_id,
        amount,
        refund_method: refundMethod,
        reason: refundReason,
        status: 'processed',
        processed_by: user.id,
        processed_at: new Date().toISOString(),
        transaction_reference: selectedOrder.payment_reference,
      } as any);

      // If wallet refund, credit the user's wallet
      if (refundMethod === 'wallet') {
        await supabase.functions.invoke('admin-wallet-adjust', {
          body: {
            userId: selectedOrder.user_id, type: 'credit', amount,
            description: `Refund for order ${selectedOrder.id.slice(0, 8)}`,
          },
        });
      }

      // Update order status
      await supabase.from('orders').update({ status: 'refunded' }).eq('id', selectedOrder.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refund-requests'] });
      queryClient.invalidateQueries({ queryKey: ['payment-orders'] });
      setSelectedOrder(null);
      setRefundAmount('');
      setRefundReason('');
      setDialogOpen(false);
      toast({ title: 'Refund processed successfully' });
    },
    onError: (err) => toast({ title: 'Refund failed', description: (err as Error).message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      {/* Search & Initiate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Initiate Refund</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Label>Search by Order ID or Transaction Reference</Label>
              <Input placeholder="Enter order ID or payment reference..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <Button onClick={() => searchMutation.mutate(searchQuery)} disabled={!searchQuery || searchMutation.isPending}>
              <Search className="h-4 w-4 mr-2" />
              Find Order
            </Button>
          </div>

          {selectedOrder && (
            <div className="mt-4 p-4 bg-secondary rounded-lg space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-muted-foreground">Customer:</span><p className="font-medium">{selectedOrder.user_profiles?.full_name || 'Unknown'}</p></div>
                <div><span className="text-muted-foreground">Total:</span><p className="font-medium">৳{Number(selectedOrder.total).toLocaleString()}</p></div>
                <div><span className="text-muted-foreground">Method:</span><p className="font-medium">{selectedOrder.payment_method || 'N/A'}</p></div>
                <div><span className="text-muted-foreground">Status:</span><Badge>{selectedOrder.status}</Badge></div>
              </div>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-3 w-3 mr-1" /> Process Refund</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Process Refund</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Refund Amount (৳)</Label>
                      <Input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Refund Method</Label>
                      <Select value={refundMethod} onValueChange={setRefundMethod}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wallet"><div className="flex items-center gap-2"><Wallet className="h-3 w-3" /> Wallet Credit</div></SelectItem>
                          <SelectItem value="direct"><div className="flex items-center gap-2"><CreditCard className="h-3 w-3" /> Direct Refund</div></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Reason</Label>
                      <Textarea value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="Reason for refund..." />
                    </div>
                    <Button onClick={() => refundMutation.mutate()} disabled={refundMutation.isPending} className="w-full">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {refundMutation.isPending ? 'Processing...' : 'Confirm Refund'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refund Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Refund History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Refund ID</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refunds?.map((refund: any) => (
                  <TableRow key={refund.id}>
                    <TableCell className="font-mono text-xs">{refund.id?.slice(0, 8)}...</TableCell>
                    <TableCell className="font-mono text-xs">{refund.order_id?.slice(0, 8)}...</TableCell>
                    <TableCell className="font-medium">৳{Number(refund.amount).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{refund.refund_method === 'wallet' ? 'Wallet' : 'Direct'}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">{refund.reason || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={refund.status === 'processed' ? 'default' : refund.status === 'pending' ? 'secondary' : 'destructive'}>
                        {refund.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {refund.created_at ? new Date(refund.created_at).toLocaleDateString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {(!refunds || refunds.length === 0) && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No refund requests yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RefundsTab;
