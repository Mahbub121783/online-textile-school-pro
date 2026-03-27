import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';

const PaymentCancel = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <UtilityBar /><Header />
      <main className="flex-1 flex items-center justify-center pb-14 lg:pb-0">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <XCircle className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="font-heading text-xl font-bold">Payment Cancelled</h2>
            <p className="text-muted-foreground">You cancelled the payment. Your order has not been charged.</p>
            <div className="flex gap-3 justify-center pt-2">
              <Button onClick={() => navigate('/checkout')}>Back to Checkout</Button>
              <Button variant="outline" onClick={() => navigate('/cart')}>View Cart</Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer /><BottomNav />
    </div>
  );
};

export default PaymentCancel;
