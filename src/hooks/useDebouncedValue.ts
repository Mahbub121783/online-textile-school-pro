import { useEffect, useState } from 'react';

/**
 * Debounce a fast-changing value (e.g. search input) before using it as a
 * React Query key or dependency, so we don't fire one DB query per keystroke.
 *
 * @example
 *   const [q, setQ] = useState('');
 *   const debouncedQ = useDebouncedValue(q, 500);
 *   useQuery({ queryKey: ['search', debouncedQ], ... });
 */
export function useDebouncedValue<T>(value: T, delayMs = 500): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
