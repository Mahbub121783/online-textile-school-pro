import { Link } from 'react-router-dom';
import { Trophy, Users } from 'lucide-react';
import type { TopLeaderboardRow } from '@/hooks/useTopLeaderboard';

const RANK_STYLE: Record<number, { ring: string; glow: string; badge: string; size: string; lift: string }> = {
  1: { ring: 'ring-4 ring-amber-300', glow: 'shadow-[0_0_30px_rgba(252,211,77,0.55)]', badge: 'bg-amber-400 text-amber-950', size: 'h-24 w-24 sm:h-28 sm:w-28', lift: 'sm:-translate-y-4' },
  2: { ring: 'ring-2 ring-slate-200', glow: 'shadow-lg', badge: 'bg-slate-200 text-slate-800', size: 'h-20 w-20', lift: '' },
  3: { ring: 'ring-2 ring-orange-300', glow: 'shadow-lg', badge: 'bg-orange-300 text-orange-950', size: 'h-20 w-20', lift: '' },
};

const PodiumCard = ({ row }: { row: TopLeaderboardRow }) => {
  const style = RANK_STYLE[row.rank] || RANK_STYLE[3];
  const name = row.profile?.full_name || 'Student';
  const isFirst = row.rank === 1;

  return (
    <Link
      to={`/contributor/${row.user_id}`}
      className={`group relative flex flex-col items-center gap-3 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/25 px-5 py-6 transition-all hover:bg-white/20 hover:-translate-y-1 ${style.lift}`}
      style={{ minWidth: isFirst ? '11rem' : '9.5rem' }}
    >
      {isFirst && (
        <Trophy className="absolute -top-6 h-8 w-8 text-amber-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]" />
      )}

      <div className="relative">
        {/* Blank when there's no photo -- no letter-fallback placeholder */}
        <div className={`rounded-full overflow-hidden bg-white/10 ${style.ring} ${style.glow} ${style.size}`}>
          {row.profile?.avatar_url && (
            <img src={row.profile.avatar_url} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <span
          className={`absolute -bottom-1 -right-1 flex items-center justify-center h-7 w-7 rounded-full text-xs font-black border-2 border-white/80 ${style.badge}`}
        >
          {row.rank}
        </span>
      </div>

      <div className="text-center">
        <p className={`text-primary-foreground font-bold truncate max-w-[9rem] group-hover:underline ${isFirst ? 'text-base' : 'text-sm'}`}>
          {name}
        </p>
        <p className={`font-heading font-black tabular-nums leading-none mt-1 ${isFirst ? 'text-2xl text-amber-300' : 'text-lg text-accent'}`}>
          {row.total_points}
          <span className="text-[10px] text-primary-foreground/70 font-normal ml-1">pts</span>
        </p>
      </div>
    </Link>
  );
};

const LeaderboardSlideContent = ({
  title,
  rows,
  participantCount,
}: {
  title: string;
  rows: TopLeaderboardRow[];
  participantCount?: number;
}) => {
  // Re-keying on the exact ranking snapshot re-triggers the entrance
  // animation whenever someone's rank/score actually changes -- a visible
  // "just updated" pulse rather than a silent, easy-to-miss data swap.
  const updateKey = rows.map((r) => `${r.user_id}:${r.total_points}`).join('|');
  // Podium order left-to-right: 2nd, 1st, 3rd (classic podium), falling
  // back gracefully when fewer than 3 have scored yet.
  const ordered = [rows[1], rows[0], rows[2]].filter(Boolean) as TopLeaderboardRow[];

  return (
    <div className="max-w-3xl mx-auto text-center">
      <div className="mb-5 flex items-center justify-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-primary-foreground/80">Live</span>
        </span>
        {typeof participantCount === 'number' && participantCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-foreground/80 bg-white/10 rounded-full px-2.5 py-1">
            <Users className="h-3.5 w-3.5" /> {participantCount} student{participantCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold mb-8 flex items-center justify-center gap-2 text-primary-foreground">
        <Trophy className="h-7 w-7 text-amber-300" /> {title}
      </h1>

      {rows.length === 0 ? (
        <p className="text-primary-foreground/70">No practice scores yet — be the first!</p>
      ) : (
        <div key={updateKey} className="flex items-end justify-center gap-4 sm:gap-6 flex-wrap animate-hero-lb-pulse">
          {ordered.map((row) => (
            <PodiumCard key={row.user_id} row={row} />
          ))}
        </div>
      )}

      <Link
        to="/practice/leaderboard"
        className="inline-block mt-8 text-sm font-semibold text-primary-foreground/90 hover:text-primary-foreground underline underline-offset-4"
      >
        View full leaderboard →
      </Link>

      <style>{`
        @keyframes heroLbPulse {
          0% { opacity: 0; transform: scale(0.97); }
          60% { opacity: 1; }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-hero-lb-pulse {
          animation: heroLbPulse 0.5s ease-out both;
        }
      `}</style>
    </div>
  );
};

export default LeaderboardSlideContent;
