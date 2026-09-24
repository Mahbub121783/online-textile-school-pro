import { Link } from 'react-router-dom';
import { Coins, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTokenBalance } from '@/hooks/useTokenBalance';

const CreditBalancePill = () => {
  const { user } = useAuth();
  const { data } = useTokenBalance();
  if (!user) return null;
  const total = (data?.daily_balance ?? 0) + (data?.paid_balance ?? 0);
  const flashDay = !!data?.is_flash_day;
  return (
    <Link
      to="/practice/credits"
      title={
        flashDay
          ? `Friday Flash Day — +50 bonus credits! Daily ${data?.daily_balance ?? 0} • Paid ${data?.paid_balance ?? 0}`
          : `Practice Credits — Daily ${data?.daily_balance ?? 0} • Paid ${data?.paid_balance ?? 0}`
      }
      className={`hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-full border transition-colors ${
        flashDay
          ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-600 dark:text-amber-400'
          : 'bg-accent/10 hover:bg-accent/20 border-accent/30 text-accent-foreground'
      }`}
    >
      {flashDay ? <Zap className="h-4 w-4 fill-current" /> : <Coins className="h-4 w-4 text-accent" />}
      <span className="text-sm font-semibold tabular-nums">{total}</span>
    </Link>
  );
};

export default CreditBalancePill;
