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

const CURR_LS_KEY = 'ots-currencies-cache';
const readCurrCache = (): any[] | null => {
  try { const raw = localStorage.getItem(CURR_LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
const writeCurrCache = (data: any[]) => { try { localStorage.setItem(CURR_LS_KEY, JSON.stringify(data)); } catch { /* */ } };

export const useCurrencies = () => {
  return useQuery({
    queryKey: ['active-currencies'],
    initialData: () => readCurrCache() ?? undefined,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('currencies')
          .select('code, symbol, exchange_rate, is_default')
          .eq('is_active', true)
          .order('is_default', { ascending: false });
        if (error) throw error;
        const rows = data ?? [];
        writeCurrCache(rows);
        return rows;
      } catch (err) {
        const cached = readCurrCache();
        if (cached) return cached;
        throw err;
      }
    },
    staleTime: 2 * 60 * 60 * 1000, // 2h — rarely changes
    gcTime: 4 * 60 * 60 * 1000,
    retry: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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
