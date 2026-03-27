import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ShoppingCart, Clock, CheckCircle, XCircle, BookOpen, Library } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <Clock className="h-3.5 w-3.5" />, label: 'Pending Verification' },
  completed: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle className="h-3.5 w-3.5" />, label: 'Completed' },
  rejected: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="h-3.5 w-3.5" />, label: 'Rejected' },
};

const OrdersPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['my-orders', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Collect item ids
  const courseIds = [...new Set(orders.flatMap((o: any) => o.order_items?.filter((i: any) => i.item_type === 'course').map((i: any) => i.item_id) || []))];
  const ebookIds = [...new Set(orders.flatMap((o: any) => o.order_items?.filter((i: any) => i.item_type === 'ebook').map((i: any) => i.item_id) || []))];

  const { data: courses = [] } = useQuery({
    queryKey: ['order-courses', courseIds.join(',')],
    queryFn: async () => {
      if (!courseIds.length) return [];
      const { data } = await supabase.from('courses').select('id, title, slug, thumbnail_url').in('id', courseIds);
      return data || [];
    },
    enabled: courseIds.length > 0,
  });

  const { data: ebooksData = [] } = useQuery({
    queryKey: ['order-ebooks', ebookIds.join(',')],
    queryFn: async () => {
      if (!ebookIds.length) return [];
      const { data } = await supabase.from('ebooks').select('id, title, slug, cover_url').in('id', ebookIds);
      return data || [];
    },
    enabled: ebookIds.length > 0,
  });

  const getItemInfo = (item: any) => {
    if (item.item_type === 'course') {
      const c = courses.find((c: any) => c.id === item.item_id);
      return { name: c?.title || 'Course', icon: <BookOpen className="h-4 w-4 text-primary" />, link: c ? `/courses/${c.slug}` : null, accessible: true };
    }
    const e = ebooksData.find((e: any) => e.id === item.item_id);
    return { name: e?.title || 'eBook', icon: <Library className="h-4 w-4 text-primary" />, link: e ? `/ebooks/${e.slug}` : null, accessible: true };
  };

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-heading font-bold">My Orders</h1>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No orders yet</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/courses')}>Browse Courses</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => {
            const status = statusConfig[order.status] || statusConfig.pending;
            return (
              <Card key={order.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-sm font-mono">#{order.id.slice(0, 8)}</CardTitle>
                      <Badge className={`${status.color} flex items-center gap-1`}>
                        {status.icon} {status.label}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">৳{Number(order.total).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Payment method */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Payment:</span>
                    <span className="capitalize">{order.payment_method?.replace(/_/g, ' ')}</span>
                    {order.payment_reference && (
                      <span className="font-mono text-xs text-muted-foreground">TxID: {order.payment_reference}</span>
                    )}
                  </div>

                  {/* Items */}
                  <div className="space-y-2">
                    {(order.order_items || []).map((item: any) => {
                      const info = getItemInfo(item);
                      return (
                        <div key={item.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            {info.icon}
                            <span className="text-sm font-medium">{info.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">৳{Number(item.price).toLocaleString()}</span>
                            {order.status === 'completed' && info.link && (
                              <Button size="sm" variant="outline" onClick={() => navigate(info.link!)}>Access</Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Status message */}
                  {order.status === 'pending' && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-400">
                      ⏳ Your payment is being verified by admin. You'll be notified once approved.
                    </div>
                  )}
                  {order.status === 'rejected' && (
                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-400">
                      ❌ This order was rejected. Please contact support or place a new order.
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
