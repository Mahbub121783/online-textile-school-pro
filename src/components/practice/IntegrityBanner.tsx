import { Shield, ShieldAlert } from 'lucide-react';

interface Props {
  count: number;
  focusMode: boolean;
}

export function IntegrityBanner({ count, focusMode }: Props) {
  const safe = count === 0;
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
        safe
          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
          : count < 3
            ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
            : 'bg-destructive/15 text-destructive border-destructive/40'
      }`}
      title={focusMode ? 'Focus mode is active' : 'Standard mode'}
    >
      {safe ? <Shield className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
      <span>{count} warning{count === 1 ? '' : 's'}</span>
    </div>
  );
}
