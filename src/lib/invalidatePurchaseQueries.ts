import type { QueryClient } from '@tanstack/react-query';

// Every dashboard list that can change as a result of a completed purchase
// (course, ebook, wallet-paid or gateway-paid) needs to be told to refetch
// explicitly -- staleTime alone means a page visited shortly before/after
// checkout can keep showing pre-purchase data for up to a minute. Centralized
// here since purchases complete through two separate code paths (inline
// free/wallet checkout in Checkout.tsx, and the payment-gateway redirect
// back to PaymentSuccess.tsx) that both need the same invalidation set.
export function invalidatePurchaseQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['enrollments'] });
  queryClient.invalidateQueries({ queryKey: ['enrollment'] });
  queryClient.invalidateQueries({ queryKey: ['purchased-ebooks-set'] });
  queryClient.invalidateQueries({ queryKey: ['my-ebooks'] });
  queryClient.invalidateQueries({ queryKey: ['my-orders'] });
  queryClient.invalidateQueries({ queryKey: ['wallet'] });
  queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
}
