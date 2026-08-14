import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ShoppingCart, Clock, CheckCircle, XCircle, Search, Eye, Loader2 } from 'lucide-react';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const AdminOrders = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOrderId, setRejectOrderId] = useState('');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin-orders', statusFilter],
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch invoices for all orders
  const orderIds = orders.map((o: any) => o.id);
  const { data: invoices = [] } = useQuery({
    queryKey: ['admin-order-invoices', orderIds.join(',')],
    queryFn: async () => {
      if (!orderIds.length) return [];
      const { data } = await supabase.from('invoices').select('*').in('order_id', orderIds);
      return data || [];
    },
    enabled: orderIds.length > 0,
  });

  // Fetch user profiles for orders
  const userIds = [...new Set(orders.map((o: any) => o.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ['admin-order-profiles', userIds.join(',')],
    queryFn: async () => {
      if (!userIds.length) return [];
      const { data } = await supabase.from('user_profiles').select('id, full_name, avatar_url').in('id', userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  // Fetch course and ebook names for items
  const courseIds = [...new Set(orders.flatMap((o: any) => o.order_items?.filter((i: any) => i.item_type === 'course').map((i: any) => i.item_id) || []))];
  const ebookIds = [...new Set(orders.flatMap((o: any) => o.order_items?.filter((i: any) => i.item_type === 'ebook').map((i: any) => i.item_id) || []))];

  const { data: courses = [] } = useQuery({
    queryKey: ['admin-order-courses', courseIds.join(',')],
    queryFn: async () => {
      if (!courseIds.length) return [];
      const { data } = await supabase.from('courses').select('id, title, instructor_id, revenue_share_pct').in('id', courseIds);
      return data || [];
    },
    enabled: courseIds.length > 0,
  });

  const { data: ebooks = [] } = useQuery({
    queryKey: ['admin-order-ebooks', ebookIds.join(',')],
    queryFn: async () => {
      if (!ebookIds.length) return [];
      const { data } = await supabase.from('ebooks').select('id, title').in('id', ebookIds);
      return data || [];
    },
    enabled: ebookIds.length > 0,
  });

  const getProfile = (userId: string) => profiles.find((p: any) => p.id === userId);
  const getInvoice = (orderId: string) => invoices.find((i: any) => i.order_id === orderId);
  const getItemName = (item: any) => {
    if (item.item_type === 'course') return courses.find((c: any) => c.id === item.item_id)?.title || 'Course';
    if (item.item_type === 'ebook') return ebooks.find((e: any) => e.id === item.item_id)?.title || 'eBook';
    return 'Item';
  };

  const approveMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const order = orders.find((o: any) => o.id === orderId);
      if (!order) throw new Error('Order not found');

      // Update order status
      await supabase.from('orders').update({ status: 'completed' } as any).eq('id', orderId);
      // Update invoice
      await supabase.from('invoices').update({ payment_status: 'paid', paid_at: new Date().toISOString() } as any).eq('order_id', orderId);

      // Create enrollments for course items
      const courseItems = (order.order_items || []).filter((i: any) => i.item_type === 'course');
      for (const item of courseItems) {
        await supabase.from('enrollments').upsert({
          user_id: order.user_id,
          course_id: item.item_id,
          payment_id: orderId,
        }, { onConflict: 'user_id,course_id' } as any);
      }

      // Grant ebook access for ebook items
      const ebookItems = (order.order_items || []).filter((i: any) => i.item_type === 'ebook');
      for (const item of ebookItems) {
        await supabase.from('ebook_access_tokens').insert({
          user_id: order.user_id,
          ebook_id: item.item_id,
          token: crypto.randomUUID(),
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        } as any);
      }

      // Credit instructor revenue
      for (const item of courseItems) {
        const course = courses.find((c: any) => c.id === item.item_id);
        if (course?.instructor_id) {
          const sharePct = Number(course.revenue_share_pct ?? 70);
          const amount = (Number(item.price) * sharePct) / 100;
          if (amount > 0) {
            await supabase.rpc('credit_wallet', {
              _user_id: course.instructor_id,
              _amount: amount,
              _description: `Revenue from order ${orderId.slice(0, 8)}`,
              _reference_id: orderId,
            });
          }
        }
      }

      // Credit referral reward -- mirrors backend/src/functions/
      // processPayment.js's logic, which only runs for the UddoktaPay
      // gateway path. Manually-verified orders (bank transfer / bKash-Nagad
      // "send money" -- the common path for this platform) approved here
      // never credited the referrer at all until now.
      try {
        const { data: buyerProfile } = await supabase.from('user_profiles').select('referred_by').eq('id', order.user_id).single();
        if (buyerProfile?.referred_by) {
          await supabase.from('referral_rewards')
            .update({ status: 'credited', reward_amount: 50, credited_at: new Date().toISOString() })
            .eq('referred_id', order.user_id)
            .eq('status', 'pending');
          await supabase.rpc('credit_wallet', {
            _user_id: buyerProfile.referred_by,
            _amount: 50,
            _description: `Referral reward for order ${orderId.slice(0, 8)}`,
            _reference_id: orderId,
          });
        }
      } catch (e) { console.warn('referral credit skipped:', e); }

      // Send approval notification + email
      const { createNotificationWithEmail, NOTIFICATION_TYPES } = await import('@/lib/notifications');
      await createNotificationWithEmail({
        userId: order.user_id,
        type: NOTIFICATION_TYPES.ORDER_APPROVED,
        title: 'Order Approved ✅',
        message: `Your order #${orderId.slice(0, 8)} has been approved. Your items are now accessible!`,
        link: '/dashboard/orders',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Order approved and fulfilled!');
      setDetailOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const order = orders.find((o: any) => o.id === orderId);
      if (!order) throw new Error('Order not found');

      await supabase.from('orders').update({ status: 'rejected' } as any).eq('id', orderId);
      await supabase.from('invoices').update({ payment_status: 'failed' } as any).eq('order_id', orderId);

      const { createNotificationWithEmail, NOTIFICATION_TYPES } = await import('@/lib/notifications');
      await createNotificationWithEmail({
        userId: order.user_id,
        type: NOTIFICATION_TYPES.ORDER_REJECTED,
        title: 'Order Rejected ❌',
        message: `Your order #${orderId.slice(0, 8)} was rejected. Reason: ${reason || 'Not specified'}`,
        link: '/dashboard/orders',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Order rejected');
      setRejectOpen(false);
      setRejectReason('');
      setDetailOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filteredOrders = orders.filter((o: any) => {
    if (!search) return true;
    const profile = getProfile(o.user_id);
    const invoice = getInvoice(o.id);
    const s = search.toLowerCase();
    return (
      o.id.toLowerCase().includes(s) ||
      profile?.full_name?.toLowerCase().includes(s) ||
      invoice?.billing_name?.toLowerCase().includes(s) ||
      o.payment_reference?.toLowerCase().includes(s) ||
      o.payment_method?.toLowerCase().includes(s)
    );
  });

  const stats = {
    total: orders.length,
    pending: orders.filter((o: any) => o.status === 'pending').length,
    completed: orders.filter((o: any) => o.status === 'completed').length,
    rejected: orders.filter((o: any) => o.status === 'rejected').length,
  };

  const openDetail = (order: any) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold">Order Management</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center">
          <ShoppingCart className="h-6 w-6 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total Orders</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <Clock className="h-6 w-6 mx-auto text-yellow-500 mb-1" />
          <p className="text-2xl font-bold">{stats.pending}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-1" />
          <p className="text-2xl font-bold">{stats.completed}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <XCircle className="h-6 w-6 mx-auto text-red-500 mb-1" />
          <p className="text-2xl font-bold">{stats.rejected}</p>
          <p className="text-xs text-muted-foreground">Rejected</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, TxID, order ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filteredOrders.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No orders found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>TxID</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order: any) => {
                    const profile = getProfile(order.user_id);
                    const invoice = getInvoice(order.id);
                    return (
                      <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(order)}>
                        <TableCell className="font-mono text-xs">#{order.id.slice(0, 8)}</TableCell>
                        <TableCell className="font-medium">{invoice?.billing_name || profile?.full_name || 'Unknown'}</TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="flex flex-wrap gap-1">
                            {(order.order_items || []).map((item: any) => (
                              <Badge key={item.id} variant="outline" className="text-xs truncate max-w-[140px]">
                                {getItemName(item)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize text-xs">{order.payment_method?.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="font-mono text-xs">{order.payment_reference || '—'}</TableCell>
                        <TableCell className="text-right font-medium">৳{Number(order.total).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={`${statusColors[order.status] || ''} capitalize`}>{order.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'dd MMM yy')}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openDetail(order); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedOrder && (() => {
            const invoice = getInvoice(selectedOrder.id);
            const profile = getProfile(selectedOrder.user_id);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>Order #{selectedOrder.id.slice(0, 8)}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <Badge className={`${statusColors[selectedOrder.status]} capitalize text-sm`}>{selectedOrder.status}</Badge>
                    <span className="text-sm text-muted-foreground">{format(new Date(selectedOrder.created_at), 'dd MMM yyyy, hh:mm a')}</span>
                  </div>

                  {/* Customer Info */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Customer Details</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p><span className="text-muted-foreground">Name:</span> {invoice?.billing_name || profile?.full_name}</p>
                      <p><span className="text-muted-foreground">Email:</span> {invoice?.billing_email || '—'}</p>
                      <p><span className="text-muted-foreground">Phone:</span> {invoice?.billing_phone || '—'}</p>
                      <p><span className="text-muted-foreground">District:</span> {invoice?.billing_district || '—'}</p>
                    </CardContent>
                  </Card>

                  {/* Payment Info */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Payment Info</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p><span className="text-muted-foreground">Method:</span> <span className="capitalize">{selectedOrder.payment_method?.replace(/_/g, ' ')}</span></p>
                      <p><span className="text-muted-foreground">Transaction ID:</span> <span className="font-mono">{selectedOrder.payment_reference || '—'}</span></p>
                      <p><span className="text-muted-foreground">Amount:</span> ৳{Number(selectedOrder.total).toLocaleString()}</p>
                      {selectedOrder.discount_amount > 0 && (
                        <p><span className="text-muted-foreground">Discount:</span> ৳{Number(selectedOrder.discount_amount).toLocaleString()} {selectedOrder.coupon_code && `(${selectedOrder.coupon_code})`}</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Order Items */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Order Items</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {(selectedOrder.order_items || []).map((item: any) => (
                        <div key={item.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0">
                          <div>
                            <p className="font-medium">{getItemName(item)}</p>
                            <p className="text-xs text-muted-foreground capitalize">{item.item_type}</p>
                          </div>
                          <p className="font-medium">৳{Number(item.price).toLocaleString()}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Action Buttons */}
                  {selectedOrder.status === 'pending' && (
                    <div className="flex gap-3">
                      <Button
                        className="flex-1"
                        onClick={() => approveMutation.mutate(selectedOrder.id)}
                        disabled={approveMutation.isPending}
                      >
                        {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => { setRejectOrderId(selectedOrder.id); setRejectOpen(true); }}
                      >
                        <XCircle className="h-4 w-4 mr-2" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Order</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason for rejection (optional)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate({ orderId: rejectOrderId, reason: rejectReason })}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrders;
