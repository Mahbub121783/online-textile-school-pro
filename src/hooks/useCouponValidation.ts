import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CartItem } from '@/stores/cartStore';

export interface ValidatedCoupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_discount_amount: number | null;
  min_order_amount: number | null;
  usage_limit: number | null;
  used_count: number | null;
  per_user_limit: number | null;
  applicable_type: string;
  applicable_ids: string[] | null;
}

export const useCouponValidation = () => {
  const [appliedCoupon, setAppliedCoupon] = useState<ValidatedCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const getEligibleSubtotal = (cartItems: CartItem[]): number => {
    if (!appliedCoupon) return 0;
    return getEligibleItems(cartItems).reduce((sum, item) => sum + (item.discount_price ?? item.price), 0);
  };

  const getEligibleItems = (cartItems: CartItem[]): CartItem[] => {
    if (!appliedCoupon) return cartItems;
    const { applicable_type, applicable_ids } = appliedCoupon;
    if (applicable_type === 'all') return cartItems;
    
    let filtered = cartItems.filter(item => {
      if (applicable_type === 'course') return item.type === 'course';
      if (applicable_type === 'ebook') return item.type === 'ebook';
      return true;
    });

    if (applicable_ids && applicable_ids.length > 0) {
      filtered = filtered.filter(item => applicable_ids.includes(item.id));
    }

    return filtered;
  };

  const calculateDiscount = (subtotal: number, cartItems?: CartItem[]): number => {
    if (!appliedCoupon) return 0;
    const base = cartItems ? getEligibleSubtotal(cartItems) : subtotal;
    if (base <= 0) return 0;

    if (appliedCoupon.discount_type === 'percentage') {
      const raw = base * (appliedCoupon.discount_value / 100);
      return Math.min(raw, appliedCoupon.max_discount_amount || Infinity);
    }
    return Math.min(appliedCoupon.discount_value, base);
  };

  const applyCoupon = async (code: string, subtotal: number, userId?: string, cartItems?: CartItem[]) => {
    if (!code.trim()) return;
    setCouponLoading(true);
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        toast.error('Invalid or expired coupon code');
        setAppliedCoupon(null);
        setCouponLoading(false);
        return false;
      }

      const coupon = data as any;

      if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
        toast.error('This coupon has expired');
        setCouponLoading(false);
        return false;
      }
      if (coupon.usage_limit && (coupon.used_count ?? 0) >= coupon.usage_limit) {
        toast.error('This coupon has reached its usage limit');
        setCouponLoading(false);
        return false;
      }
      if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
        toast.error(`Minimum order amount is ৳${coupon.min_order_amount}`);
        setCouponLoading(false);
        return false;
      }

      // Per-user limit check
      if (userId && coupon.per_user_limit) {
        const { count } = await supabase
          .from('coupon_usage')
          .select('id', { count: 'exact', head: true })
          .eq('coupon_id', coupon.id)
          .eq('user_id', userId);
        if ((count ?? 0) >= coupon.per_user_limit) {
          toast.error(`You have already used this coupon ${coupon.per_user_limit} time(s)`);
          setCouponLoading(false);
          return false;
        }
      }

      // Product applicability check
      if (cartItems && cartItems.length > 0 && coupon.applicable_type !== 'all') {
        const typeMap: Record<string, string> = { course: 'course', ebook: 'ebook' };
        const matchingItems = cartItems.filter(item => {
          const typeMatch = typeMap[item.type] === coupon.applicable_type || coupon.applicable_type === 'all';
          if (!typeMatch) return false;
          if (coupon.applicable_ids && coupon.applicable_ids.length > 0) {
            return coupon.applicable_ids.includes(item.id);
          }
          return true;
        });
        if (matchingItems.length === 0) {
          const typeLabel = coupon.applicable_type === 'course' ? 'courses' : coupon.applicable_type === 'ebook' ? 'ebooks' : coupon.applicable_type;
          toast.error(`This coupon is only valid for ${typeLabel}${coupon.applicable_ids?.length ? ' (specific items)' : ''}`);
          setCouponLoading(false);
          return false;
        }
      }

      setAppliedCoupon(coupon);
      toast.success('Coupon applied successfully!');
      setCouponLoading(false);
      return true;
    } catch {
      toast.error('Failed to apply coupon');
      setCouponLoading(false);
      return false;
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  return { appliedCoupon, couponLoading, applyCoupon, removeCoupon, calculateDiscount, getEligibleItems };
};
