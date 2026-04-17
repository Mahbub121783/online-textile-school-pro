import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PlayerShellProps {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  isFullscreen?: boolean;
  className?: string;
}

/**
 * Theatre-style frame for the SecureMediaPlayer.
 * - Rounded dark container with padded gutters
 * - Header strip (source badge + title + menu)
 * - 16:9 video slot with side breathing room
 * - Permanent footer for controls
 * - Collapses to edge-to-edge in fullscreen
 */
const PlayerShell = ({ header, footer, children, isFullscreen, className }: PlayerShellProps) => {
  return (
    <div
      className={cn(
        'w-full transition-all duration-300',
        isFullscreen
          ? 'p-0 rounded-none bg-black'
          : 'p-2 sm:p-3 md:p-4 rounded-2xl bg-gradient-to-b from-zinc-900 to-black shadow-2xl ring-1 ring-white/10',
        className
      )}
    >
      {header && !isFullscreen && (
        <div className="flex items-center gap-2 px-2 sm:px-3 h-11 border-b border-white/5 bg-zinc-950/80 backdrop-blur rounded-t-xl">
          {header}
        </div>
      )}

      <div
        className={cn(
          'relative w-full aspect-video bg-black overflow-hidden ring-1 ring-white/5',
          isFullscreen ? 'rounded-none' : 'rounded-xl my-2',
          !header && !isFullscreen && 'rounded-t-xl mt-0',
          !footer && !isFullscreen && 'rounded-b-xl mb-0'
        )}
      >
        {children}
      </div>

      {footer && !isFullscreen && (
        <div className="px-2 sm:px-3 min-h-[56px] border-t border-white/5 bg-zinc-950/80 backdrop-blur rounded-b-xl flex items-center">
          {footer}
        </div>
      )}
    </div>
  );
};

export default PlayerShell;
