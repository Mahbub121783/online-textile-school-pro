import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { trackMetaEvent } from '@/lib/metaPixel';

export interface CartItem {
  id: string;
  type: 'course' | 'ebook' | 'practice_credits';
  title: string;
  price: number;
  discount_price?: number;
  thumbnail_url?: string;
  instructor_name?: string;
  credits?: number; // for practice_credits items
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          if (state.items.find((i) => i.id === item.id)) return state;
          // Fire AddToCart Meta event
          try {
            trackMetaEvent('AddToCart', {
              content_ids: [item.id],
              content_type: item.type,
              content_name: item.title,
              value: item.discount_price ?? item.price,
              currency: 'BDT',
            });
          } catch {}
          return { items: [...state.items, item] };
        }),
      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      clearCart: () => set({ items: [] }),
      getTotal: () =>
        get().items.reduce((sum, item) => sum + (item.discount_price ?? item.price), 0),
      getItemCount: () => get().items.length,
    }),
    { name: 'ots-cart' }
  )
);
