import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CurrencyState {
  selectedCurrency: string;
  setSelectedCurrency: (code: string) => void;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      selectedCurrency: 'BDT',
      setSelectedCurrency: (code) => set({ selectedCurrency: code }),
    }),
    { name: 'ots-currency' }
  )
);

export const useCurrencies = () => {
  return useQuery({
    queryKey: ['active-currencies'],
    queryFn: async () => {
      const { data } = await supabase
        .from('currencies')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false });
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useConvertPrice = () => {
  const { data: currencies = [] } = useCurrencies();
  const { selectedCurrency } = useCurrencyStore();

  return (priceBDT: number): { amount: number; symbol: string; code: string } => {
    if (!priceBDT || selectedCurrency === 'BDT') {
      return { amount: priceBDT, symbol: '৳', code: 'BDT' };
    }
    const currency = currencies.find((c: any) => c.code === selectedCurrency);
    if (!currency) return { amount: priceBDT, symbol: '৳', code: 'BDT' };
    const converted = Math.round(priceBDT * currency.exchange_rate * 100) / 100;
    return { amount: converted, symbol: currency.symbol, code: currency.code };
  };
};
