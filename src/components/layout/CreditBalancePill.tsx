import { Link } from 'react-router-dom';
import { Coins } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTokenBalance } from '@/hooks/useTokenBalance';

const CreditBalancePill = () => {
  const { user } = useAuth();
  const { data } = useTokenBalance();
  if (!user) return null;
  const total = (data?.daily_balance ?? 0) + (data?.paid_balance ?? 0);
  return (
    <Link
      to="/practice/credits"
      title={`Practice Credits — Daily ${data?.daily_balance ?? 0} • Paid ${data?.paid_balance ?? 0}`}
      className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent-foreground transition-colors"
    >
      <Coins className="h-4 w-4 text-accent" />
      <span className="text-sm font-semibold tabular-nums">{total}</span>
    </Link>
  );
};

export default CreditBalancePill;
