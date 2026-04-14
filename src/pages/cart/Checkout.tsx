import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCartStore } from '@/stores/cartStore';
import { useAuth } from '@/hooks/useAuth';
import { useCouponValidation } from '@/hooks/useCouponValidation';
import { supabase } from '@/integrations/supabase/client';
import { BD_DISTRICTS } from '@/lib/constants';
import { toast } from 'sonner';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { Tag, CreditCard, Smartphone, Loader2, Wallet, Building2, ChevronRight, CalendarClock } from 'lucide-react';
import { useWallet } from '@/hooks/useEnrollments';
import { useConvertPrice } from '@/hooks/useCurrency';

const Checkout = () => {
  const { items, getTotal, clearCart } = useCartStore();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(() => ({
    fullName: profile?.full_name || '',
    email: user?.email || '',
    phone: profile?.phone || '',
    district: profile?.district || '',
  }));

  const urlCoupon = new URLSearchParams(window.location.search).get('coupon') || '';
  const [couponCode, setCouponCode] = useState(urlCoupon);
  const { appliedCoupon, couponLoading, applyCoupon, removeCoupon, calculateDiscount } = useCouponValidation();
  const [couponAutoApplied, setCouponAutoApplied] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('manual');
  const [manualSubMethod, setManualSubMethod] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const convertPrice = useConvertPrice();
  const { data: allGateways = [] } = useQuery({
    queryKey: ['all-payment-gateways-checkout'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_gateways')
        .select('id, gateway_name, display_name, is_active, credentials');
      if (error) console.error('Gateway fetch error:', error);
      return (data || []) as any[];
    },
  });
  const activeGateways = allGateways.filter((g: any) => g.is_active);
  const { data: walletData } = useWallet();
  const walletBalance = Number(walletData?.balance ?? 0);

  // Auto-apply coupon from URL
  const autoApplyCouponFromUrl = async () => {
    if (couponAutoApplied || !urlCoupon || appliedCoupon) return;
    setCouponAutoApplied(true);
    await applyCoupon(urlCoupon, getTotal(), user?.id, items);
  };
  if (urlCoupon && !couponAutoApplied && user) {
    autoApplyCouponFromUrl();
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <UtilityBar /><Header />
        <main className="flex-1 flex items-center justify-center pb-14 lg:pb-0">
          <div className="text-center py-16 max-w-md mx-auto px-4">
            <h2 className="font-heading text-2xl font-bold mb-4">Please sign in to checkout</h2>
            <p className="text-muted-foreground mb-6">You need to be logged in to complete your purchase.</p>
            <Button className="bg-accent hover:bg-accent-hover text-accent-foreground" onClick={() => navigate(`/auth/login?redirect=/checkout`)}>
              Sign In to Continue
            </Button>
          </div>
        </main>
        <Footer /><BottomNav />
      </div>
    );
  }

  const subtotal = getTotal();
  const discountAmount = calculateDiscount(subtotal, items);
  const total = Math.max(subtotal - discountAmount, 0);

  const getActiveGateway = (name: string) => activeGateways.find((g: any) => g.gateway_name === name);
  const getAnyGateway = (name: string) => allGateways.find((g: any) => g.gateway_name === name);
  const bankGateway = getActiveGateway('bank');
  const selectedManualGateway = manualSubMethod ? getAnyGateway(manualSubMethod) : null;

  const isManualPayment = paymentMethod === 'manual';
  const needsTxId = isManualPayment || paymentMethod === 'bank';

  const handleApplyCoupon = () => applyCoupon(couponCode, subtotal, user?.id, items);
  const handleRemoveCoupon = () => { removeCoupon(); setCouponCode(''); };

  const generateInvoiceNumber = () => {
    const date = new Date();
    const y = date.getFullYear().toString().slice(-2);
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const rand = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `INV-${y}${m}-${rand}`;
  };

  const creditInstructorRevenue = async (orderId: string, orderItems: typeof items) => {
    for (const item of orderItems) {
      if (item.type === 'course') {
        const { data: course } = await supabase
          .from('courses')
          .select('instructor_id, revenue_share_pct')
          .eq('id', item.id)
          .single();
        if (course?.instructor_id) {
          const sharePct = Number(course.revenue_share_pct ?? 70);
          const itemPrice = item.discount_price ?? item.price;
          const instructorAmount = (itemPrice * sharePct) / 100;
          if (instructorAmount > 0) {
            await supabase.rpc('credit_wallet', {
              _user_id: course.instructor_id,
              _amount: instructorAmount,
              _description: `Revenue from order ${orderId.slice(0, 8)}`,
              _reference_id: orderId,
            });
          }
        }
      }
    }
  };

  // Enroll user in courses and ensure eBook ownership via completed order
  const enrollAfterPayment = async (orderId: string) => {
    for (const item of items) {
      if (item.type === 'course') {
        const { error: enrollError } = await supabase.from('enrollments').insert({
          user_id: user.id,
          course_id: item.id,
          payment_id: orderId,
        });
        // Ignore duplicate enrollment (already enrolled)
        if (enrollError && !enrollError.message.includes('duplicate')) throw enrollError;
      }
      // eBook ownership is verified via order_items + completed order status
      // No separate table needed — the order being "completed" is the proof of purchase
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    if (total > 0) {
      if (isManualPayment && !manualSubMethod) {
        toast.error('Please select a payment method (bKash, Nagad, or Rocket)');
        return;
      }
      if (needsTxId && !transactionId.trim()) {
        toast.error('Please enter the Transaction ID after sending money');
        return;
      }
    }

    setSubmitting(true);

    try {
      const effectiveMethod = total === 0 ? 'free' : isManualPayment ? `${manualSubMethod}_send_money` : paymentMethod;
      const orderId = crypto.randomUUID();
      const { error: orderError } = await supabase.from('orders').insert({
        id: orderId,
        user_id: user.id,
        total,
        status: 'pending',
        payment_method: effectiveMethod,
        payment_reference: transactionId || null,
        coupon_code: appliedCoupon?.code || null,
        discount_amount: discountAmount,
      });
      if (orderError) throw orderError;

      const orderItems = items.map((item) => ({
        order_id: orderId,
        item_id: item.id,
        item_type: item.type,
        price: item.discount_price ?? item.price,
      }));
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw new Error(`Failed to save order items: ${itemsError.message}`);

      const { error: invoiceError } = await supabase.from('invoices').insert({
        invoice_number: generateInvoiceNumber(),
        order_id: orderId,
        user_id: user.id,
        subtotal,
        discount_amount: discountAmount,
        coupon_code: appliedCoupon?.code || null,
        total,
        billing_name: formData.fullName,
        billing_email: formData.email,
        billing_phone: formData.phone,
        billing_district: formData.district,
        payment_method: effectiveMethod,
        payment_status: 'pending',
      });
      if (invoiceError) console.error('Invoice creation failed:', invoiceError);

      if (appliedCoupon) {
        // Record in new coupon_usage table (per-user tracking)
        await supabase.from('coupon_usage').insert({
          coupon_id: appliedCoupon.id,
          user_id: user.id,
          order_id: orderId,
        });
        // Also keep legacy coupon_usages record
        await supabase.from('coupon_usages').insert({
          coupon_id: appliedCoupon.id,
          user_id: user.id,
          order_id: orderId,
        });
        await supabase.from('coupons').update({ used_count: (appliedCoupon.used_count || 0) + 1 }).eq('id', appliedCoupon.id);
      }

      // UddoktaPay
      if (paymentMethod === 'uddoktapay' && total > 0) {
        const { data: paymentData, error: paymentError } = await supabase.functions.invoke('process-payment', {
          body: {
            orderId, amount: total, customerName: formData.fullName, customerEmail: formData.email, customerPhone: formData.phone,
            metadata: { coupon_code: appliedCoupon?.code },
          },
        });
        if (paymentError) throw paymentError;
        if (paymentData?.payment_url) { window.location.href = paymentData.payment_url; return; }
      }

      // Manual / Bank — pending verification
      if ((isManualPayment || paymentMethod === 'bank') && total > 0) {
        await supabase.from('notifications').insert({
          user_id: user.id, type: 'order', title: 'Order Placed',
          message: `Your order #${orderId.slice(0, 8)} has been placed and is pending verification.`,
          link: '/dashboard/orders',
        });
        await supabase.rpc('notify_admins', {
          _type: 'order', _title: 'New Order Received',
          _message: `New order #${orderId.slice(0, 8)} from ${formData.fullName} requires verification.`,
          _link: '/admin/orders',
        });
        clearCart();
        toast.success('Order placed! Your payment will be verified by admin.');
        navigate('/dashboard/orders');
        return;
      }

      // Wallet payment
      if (paymentMethod === 'wallet' && total > 0) {
        if (walletBalance < total) { toast.error('Insufficient wallet balance'); setSubmitting(false); return; }
        const { error: debitError } = await supabase.rpc('debit_wallet', {
          _user_id: user.id, _amount: total,
          _description: `Payment for order ${orderId}`, _reference_id: orderId,
        });
        if (debitError) throw debitError;
        await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId);
        await supabase.from('invoices').update({ payment_status: 'paid', paid_at: new Date().toISOString() }).eq('order_id', orderId);
        await enrollAfterPayment(orderId);
        await creditInstructorRevenue(orderId, items);
      }

      // Free order (100% coupon or free items)
      if (total === 0) {
        await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId);
        await supabase.from('invoices').update({ payment_status: 'paid', paid_at: new Date().toISOString() }).eq('order_id', orderId);
        await enrollAfterPayment(orderId);
        await creditInstructorRevenue(orderId, items);
      }

      clearCart();
      toast.success('Order placed successfully!');
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['enrollment'] });
      queryClient.invalidateQueries({ queryKey: ['purchased-ebooks-set'] });
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error(err.message || 'Failed to place order');
    }
    setSubmitting(false);
  };

  const update = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  const manualMethodIcons: Record<string, { icon: React.ReactNode; color: string }> = {
    bkash: { icon: <Smartphone className="h-5 w-5" />, color: 'text-pink-600' },
    nagad: { icon: <Smartphone className="h-5 w-5" />, color: 'text-orange-600' },
    rocket: { icon: <Smartphone className="h-5 w-5" />, color: 'text-purple-600' },
  };
  const gatewayIcons: Record<string, React.ReactNode> = {
    bank: <Building2 className="h-5 w-5 text-primary" />,
    uddoktapay: <CreditCard className="h-5 w-5 text-primary" />,
    sslcommerz: <CreditCard className="h-5 w-5 text-primary" />,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <UtilityBar /><Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <div className="bg-secondary py-4">
          <div className="container"><h1 className="font-heading text-2xl font-bold text-foreground">Checkout</h1></div>
        </div>
        <div className="container py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <form onSubmit={handleSubmit} className="flex-1 space-y-6">
              {/* Billing Details */}
              <div className="bg-card border rounded-xl p-6 space-y-4">
                <h2 className="font-heading font-bold text-lg">Billing Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Full Name *</Label><Input value={formData.fullName} onChange={(e) => update('fullName', e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Email *</Label><Input type="email" value={formData.email} onChange={(e) => update('email', e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Phone *</Label><Input value={formData.phone} onChange={(e) => update('phone', e.target.value)} required /></div>
                  <div className="space-y-2">
                    <Label>District</Label>
                    <Select value={formData.district} onValueChange={(v) => update('district', v)}>
                      <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
                      <SelectContent>{BD_DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Payment Method - only show when total > 0 */}
              {total > 0 && (
              <div className="bg-card border rounded-xl p-6 space-y-4">
                <h2 className="font-heading font-bold text-lg">Payment Method</h2>
                <RadioGroup value={paymentMethod} onValueChange={(v) => { setPaymentMethod(v); setTransactionId(''); setSenderNumber(''); setManualSubMethod(''); }} className="space-y-3">
                  {/* Wallet */}
                  <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="wallet" id="wallet" disabled={walletBalance <= 0} />
                    <Label htmlFor="wallet" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Wallet className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Wallet Balance</p>
                        <p className="text-xs text-muted-foreground">Available: ৳{walletBalance.toLocaleString()}{walletBalance < total ? ' (insufficient)' : ''}</p>
                      </div>
                    </Label>
                  </div>

                  {getActiveGateway('sslcommerz') && (
                    <PaymentOption value="sslcommerz" icon={gatewayIcons.sslcommerz} title="SSLCommerz" subtitle="Pay via SSLCommerz gateway (Cards, MFS, Net Banking)" />
                  )}
                  {getActiveGateway('uddoktapay') && (
                    <PaymentOption value="uddoktapay" icon={gatewayIcons.uddoktapay} title="bKash / Nagad / Rocket (Auto)" subtitle="Pay via UddoktaPay gateway" />
                  )}
                  {bankGateway && (
                    <PaymentOption value="bank" icon={gatewayIcons.bank} title="Bank Transfer"
                      subtitle={`${bankGateway.credentials?.bank_name || 'Bank'} — ${bankGateway.credentials?.account_number || ''}`} />
                  )}

                  <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="manual" id="manual" />
                    <Label htmlFor="manual" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Smartphone className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Manual Payment</p>
                        <p className="text-xs text-muted-foreground">Send money via bKash / Nagad / Rocket</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>

                {isManualPayment && (
                  <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                    <p className="text-sm font-medium">Select Payment Method:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {['bkash', 'nagad', 'rocket'].map(method => {
                        const gw = allGateways.find((g: any) => g.gateway_name === method);
                        const meta = manualMethodIcons[method];
                        const isSelected = manualSubMethod === method;
                        return (
                          <button key={method} type="button"
                            onClick={() => { setManualSubMethod(method); setTransactionId(''); setSenderNumber(''); }}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                              isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40 hover:bg-muted/50'
                            }`}>
                            <span className={meta.color}>{meta.icon}</span>
                            <span className="text-xs font-medium capitalize">{gw?.display_name || method}</span>
                          </button>
                        );
                      })}
                    </div>

                    {manualSubMethod && selectedManualGateway && (
                      <div className="bg-card border rounded-lg p-4 space-y-4">
                        <div className="text-center space-y-1">
                          <p className="text-sm text-muted-foreground">Send <span className="font-bold text-foreground">৳{total.toLocaleString()}</span> via {selectedManualGateway.display_name} Send Money</p>
                          <p className="text-2xl font-bold font-heading text-primary">{selectedManualGateway.credentials?.phone_number || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">Account Type: {selectedManualGateway.credentials?.account_type || 'Personal'}</p>
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-sm">Your {selectedManualGateway.display_name} Number *</Label>
                            <Input placeholder="Enter your sender number" value={senderNumber} onChange={(e) => setSenderNumber(e.target.value)} required />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm">Transaction ID (TrxID) *</Label>
                            <Input placeholder="Enter your Transaction ID (e.g., TRX1234ABCD)" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} required />
                            <p className="text-xs text-muted-foreground">After sending money, enter the Transaction ID you received.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {manualSubMethod && !selectedManualGateway && (
                      <div className="bg-card border rounded-lg p-4 space-y-4">
                        <p className="text-sm text-center text-muted-foreground">
                          {manualSubMethod.charAt(0).toUpperCase() + manualSubMethod.slice(1)} payment details not configured yet. Please contact admin.
                        </p>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-sm">Your Number *</Label>
                            <Input placeholder="Enter your sender number" value={senderNumber} onChange={(e) => setSenderNumber(e.target.value)} required />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm">Transaction ID (TrxID) *</Label>
                            <Input placeholder="Enter your Transaction ID" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} required />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'bank' && bankGateway && (
                  <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                    <p className="font-medium">Bank Transfer Details:</p>
                    <p>Bank: {bankGateway.credentials?.bank_name}</p>
                    <p>Account: {bankGateway.credentials?.account_name}</p>
                    <p>Number: {bankGateway.credentials?.account_number}</p>
                    <p>Branch: {bankGateway.credentials?.branch}</p>
                    {bankGateway.credentials?.routing_number && <p>Routing: {bankGateway.credentials.routing_number}</p>}
                    <div className="space-y-1 mt-3">
                      <Label className="text-sm">Transaction Reference *</Label>
                      <Input placeholder="Enter bank reference number" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} required />
                    </div>
                  </div>
                )}
              </div>
              )}

              <Button type="submit" className="w-full h-12 bg-accent hover:bg-accent-hover text-accent-foreground font-semibold" disabled={submitting || items.length === 0}>
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</> : `Place Order — ৳${total.toLocaleString()}`}
              </Button>
            </form>

            {/* Order Summary Sidebar */}
            <div className="lg:w-80 shrink-0 space-y-4">
              <div className="bg-card border rounded-xl p-6 sticky top-20 space-y-4">
                <h3 className="font-heading font-bold text-lg">Order Summary</h3>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="truncate mr-2">{item.title}</span>
                      <span className="shrink-0 font-medium">৳{(item.discount_price ?? item.price).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <Label className="text-sm flex items-center gap-1 mb-2"><Tag className="h-3 w-3" /> Coupon Code</Label>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between bg-muted rounded-lg p-2">
                      <span className="font-mono text-sm font-bold text-primary">{appliedCoupon.code}</span>
                      <Button variant="ghost" size="sm" onClick={handleRemoveCoupon} className="text-destructive text-xs">Remove</Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Enter code" className="text-sm" />
                      <Button variant="outline" size="sm" onClick={handleApplyCoupon} disabled={couponLoading}>
                        {couponLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Apply'}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>৳{subtotal.toLocaleString()}</span></div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-primary"><span>Discount</span><span>-৳{discountAmount.toLocaleString()}</span></div>
                  )}
                  <div className="flex justify-between font-heading font-bold text-lg border-t pt-2">
                    <span>Total</span><span>৳{total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer /><BottomNav />
    </div>
  );
};

const PaymentOption = ({ value, icon, title, subtitle }: { value: string; icon: React.ReactNode; title: string; subtitle: string }) => (
  <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-muted/50">
    <RadioGroupItem value={value} id={value} />
    <Label htmlFor={value} className="flex items-center gap-2 cursor-pointer flex-1">
      {icon}
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </Label>
  </div>
);

export default Checkout;
