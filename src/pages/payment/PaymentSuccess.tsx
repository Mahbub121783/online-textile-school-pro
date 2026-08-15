import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { useCartStore } from '@/stores/cartStore';
import { useAuth } from '@/hooks/useAuth';
import { ensureStudentIdCard } from '@/lib/ensureStudentIdCard';
import { trackMetaEvent } from '@/lib/metaPixel';
import { invalidatePurchaseQueries } from '@/lib/invalidatePurchaseQueries';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const { clearCart } = useCartStore();
  const { user } = useAuth();

  useEffect(() => {
    const invoiceId = searchParams.get('invoice_id');
    if (invoiceId) {
      verifyPayment(invoiceId);
    } else {
      setStatus('success');
      clearCart();
      invalidatePurchaseQueries(queryClient);
      // Fire Meta Purchase (no amount available — best-effort)
      try {
        trackMetaEvent('Purchase', { value: 0, currency: 'BDT' },
          user?.email ? { email: user.email, externalId: user.id } : undefined);
      } catch {}
      if (user?.id) ensureStudentIdCard(user.id);
    }
  }, []);

  const verifyPayment = async (invoiceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('process-payment', {
        body: { action: 'verify', invoice_id: invoiceId },
      });

      if (error) throw error;
      if (data?.status === 'COMPLETED') {
        setStatus('success');
        clearCart();
        invalidatePurchaseQueries(queryClient);

        // Fire Meta Purchase event with real order data
        try {
          trackMetaEvent(
            'Purchase',
            {
              value: Number(data.amount ?? 0),
              currency: data.currency || 'BDT',
              order_id: invoiceId,
              content_ids: data.item_ids || [invoiceId],
              content_type: 'product',
            },
            user?.email ? { email: user.email, externalId: user.id } : undefined,
          );
        } catch {}

        if (user?.id) {
          ensureStudentIdCard(user.id);
          // Send payment confirmation notification + email
          import('@/lib/notifications').then(({ createNotificationWithEmail, NOTIFICATION_TYPES }) => {
            createNotificationWithEmail({
              userId: user.id,
              type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
              title: 'Payment Confirmed ✅',
              message: 'Your payment has been verified and your purchased items are now accessible!',
              link: '/dashboard/orders',
            });
          });
        }
      } else {
        setStatus('failed');
      }
    } catch {
      setStatus('failed');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <UtilityBar /><Header />
      <main className="flex-1 flex items-center justify-center pb-14 lg:pb-0">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            {status === 'verifying' && (
              <>
                <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin" />
                <h2 className="font-heading text-xl font-bold">Verifying Payment...</h2>
                <p className="text-muted-foreground">Please wait while we confirm your payment.</p>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle2 className="h-16 w-16 mx-auto text-primary" />
                <h2 className="font-heading text-xl font-bold">Payment Successful!</h2>
                <p className="text-muted-foreground">Your order has been confirmed. You can now access your courses.</p>
                <div className="flex gap-3 justify-center pt-2">
                  <Button onClick={() => navigate('/dashboard/courses')}>My Courses</Button>
                  <Button variant="outline" onClick={() => navigate('/dashboard')}>Dashboard</Button>
                </div>
              </>
            )}
            {status === 'failed' && (
              <>
                <XCircle className="h-16 w-16 mx-auto text-destructive" />
                <h2 className="font-heading text-xl font-bold">Payment Failed</h2>
                <p className="text-muted-foreground">Something went wrong with your payment. Please try again.</p>
                <div className="flex gap-3 justify-center pt-2">
                  <Button onClick={() => navigate('/checkout')}>Try Again</Button>
                  <Button variant="outline" onClick={() => navigate('/')}>Home</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer /><BottomNav />
    </div>
  );
};

export default PaymentSuccess;
