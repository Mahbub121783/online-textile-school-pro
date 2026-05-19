import { Link } from 'react-router-dom';
import { Trash2, ShoppingCart as CartIcon, ArrowRight, Loader2, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCartStore } from '@/stores/cartStore';
import { useCouponValidation } from '@/hooks/useCouponValidation';
import { useState } from 'react';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';

const CartPage = () => {
  const { items, removeItem, getTotal } = useCartStore();
  const total = getTotal();
  const [couponCode, setCouponCode] = useState('');
  const { appliedCoupon, couponLoading, applyCoupon, removeCoupon, calculateDiscount } = useCouponValidation();

  const discountAmount = calculateDiscount(total);
  const finalTotal = Math.max(total - discountAmount, 0);

  const handleApply = () => applyCoupon(couponCode, total);
  const handleRemove = () => { removeCoupon(); setCouponCode(''); };

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <UtilityBar /><Header />
        <main className="flex-1 flex items-center justify-center pb-14 lg:pb-0">
          <div className="text-center py-16">
            <CartIcon className="h-16 w-16 mx-auto mb-4 text-muted" />
            <h2 className="font-heading text-2xl font-bold text-foreground mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6">Browse our courses and start learning today!</p>
            <Button asChild className="bg-accent hover:bg-accent-hover text-accent-foreground"><Link to="/courses">Browse Courses</Link></Button>
          </div>
        </main>
        <Footer /><BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <UtilityBar /><Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <div className="bg-secondary py-4">
          <div className="container">
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Shopping Cart</h1>
            <p className="text-sm text-muted-foreground">{items.length} item{items.length > 1 ? 's' : ''} in your cart</p>
          </div>
        </div>
        <div className="container py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 bg-card border rounded-lg p-4">
                  <div className="w-20 h-14 bg-secondary rounded overflow-hidden flex items-center justify-center shrink-0">
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl opacity-40">{item.type === 'course' ? '📚' : item.type === 'ebook' ? '📖' : '🪙'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-semibold text-sm truncate">{item.title}</h3>
                    <p className="text-xs text-muted-foreground capitalize">{item.type.replace('_', ' ')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-heading font-bold">৳{(item.discount_price ?? item.price).toLocaleString()}</p>
                    {item.discount_price && <p className="text-xs text-muted-foreground line-through">৳{item.price.toLocaleString()}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive shrink-0" onClick={() => removeItem(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="lg:w-80 shrink-0">
              <div className="bg-card border rounded-xl p-6 sticky top-20 space-y-4">
                <h3 className="font-heading font-bold text-lg">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>৳{total.toLocaleString()}</span></div>
                </div>

                {appliedCoupon ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-green-600" />
                        <span className="font-mono text-sm font-bold text-green-700 dark:text-green-400">{appliedCoupon.code}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleRemove} className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-৳{discountAmount.toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Coupon code"
                      className="text-sm"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                    />
                    <Button variant="outline" size="sm" onClick={handleApply} disabled={couponLoading}>
                      {couponLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Apply'}
                    </Button>
                  </div>
                )}

                <div className="border-t pt-3 flex justify-between font-heading font-bold text-lg">
                  <span>Total</span><span>৳{finalTotal.toLocaleString()}</span>
                </div>
                <Button asChild className="w-full h-12 bg-accent hover:bg-accent-hover text-accent-foreground font-semibold">
                  <Link to={`/checkout${appliedCoupon ? `?coupon=${appliedCoupon.code}` : ''}`}>Proceed to Checkout <ArrowRight className="h-4 w-4 ml-2" /></Link>
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Need help? WhatsApp: <a href="https://wa.me/8801721001923" className="text-primary hover:underline">+8801721001923</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer /><BottomNav />
    </div>
  );
};

export default CartPage;
