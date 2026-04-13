import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ValidatedCoupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_discount_amount: number | null;
  min_order_amount: number | null;
  usage_limit: number | null;
  used_count: number | null;
}

export const useCouponValidation = () => {
  const [appliedCoupon, setAppliedCoupon] = useState<ValidatedCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const calculateDiscount = (subtotal: number): number => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.discount_type === 'percentage') {
      const raw = subtotal * (appliedCoupon.discount_value / 100);
      return Math.min(raw, appliedCoupon.max_discount_amount || Infinity);
    }
    return Math.min(appliedCoupon.discount_value, subtotal);
  };

  const applyCoupon = async (code: string, subtotal: number) => {
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

  return { appliedCoupon, couponLoading, applyCoupon, removeCoupon, calculateDiscount };
};
