import { Link } from 'react-router-dom';
import { Crown, Medal, Trophy } from 'lucide-react';
import type { TopLeaderboardRow } from '@/hooks/useTopLeaderboard';

const rankIcon = (rank: number) => {
  if (rank === 1) return <Crown className="h-6 w-6 text-amber-300 drop-shadow" />;
  if (rank === 2) return <Medal className="h-6 w-6 text-slate-200 drop-shadow" />;
  if (rank === 3) return <Medal className="h-6 w-6 text-orange-300 drop-shadow" />;
  return <span className="text-sm font-bold">#{rank}</span>;
};

const PodiumCard = ({ row }: { row: TopLeaderboardRow }) => {
  const isFirst = row.rank === 1;
  const name = row.profile?.full_name || 'Student';
  return (
    <Link
      to={`/contributor/${row.user_id}`}
      className={`group flex flex-col items-center gap-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 px-4 py-4 transition-all hover:bg-white/20 hover:-translate-y-1 ${
        isFirst ? 'sm:scale-110 sm:py-6 order-first sm:order-none' : ''
      }`}
      style={{ minWidth: '9rem' }}
    >
      <div className="flex items-center justify-center h-6">{rankIcon(row.rank)}</div>
      <div
        className={`relative rounded-full overflow-hidden bg-white/20 border-2 shrink-0 ${
          isFirst ? 'h-16 w-16 border-amber-300' : 'h-12 w-12 border-white/40'
        }`}
      >
        {row.profile?.avatar_url ? (
          <img src={row.profile.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-bold text-primary-foreground">
            {name[0]?.toUpperCase()}
          </div>
        )}
      </div>
      <p className="text-primary-foreground font-semibold text-sm text-center truncate max-w-[8rem] group-hover:underline">
        {name}
      </p>
      <p className="text-accent font-heading font-black text-lg tabular-nums leading-none">
        {row.total_points}
        <span className="text-[10px] text-primary-foreground/70 font-normal ml-1">pts</span>
      </p>
    </Link>
  );
};

const LeaderboardSlideContent = ({
  title,
  rows,
}: {
  title: string;
  rows: TopLeaderboardRow[];
}) => {
  // Re-keying on the exact ranking snapshot re-triggers the entrance
  // animation whenever someone's rank/score actually changes -- a visible
  // "just updated" pulse rather than a silent, easy-to-miss data swap.
  const updateKey = rows.map((r) => `${r.user_id}:${r.total_points}`).join('|');

  return (
    <div className="max-w-3xl mx-auto text-center">
      <div className="mb-6 flex items-center justify-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-primary-foreground/80">Live</span>
      </div>

      <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold mb-6 flex items-center justify-center gap-2 text-primary-foreground">
        <Trophy className="h-7 w-7 text-amber-300" /> {title}
      </h1>

      {rows.length === 0 ? (
        <p className="text-primary-foreground/70">No practice scores yet — be the first!</p>
      ) : (
        <div key={updateKey} className="flex items-end justify-center gap-3 sm:gap-5 flex-wrap animate-hero-lb-pulse">
          {rows.map((row) => (
            <PodiumCard key={row.user_id} row={row} />
          ))}
        </div>
      )}

      <Link
        to="/practice/leaderboard"
        className="inline-block mt-7 text-sm font-semibold text-primary-foreground/90 hover:text-primary-foreground underline underline-offset-4"
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
