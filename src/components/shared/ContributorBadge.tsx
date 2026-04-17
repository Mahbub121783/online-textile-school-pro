import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface ContributorBadgeProps {
  id: string;
  name?: string | null;
  avatarUrl?: string | null;
  role?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showRole?: boolean;
}

const sizeMap = {
  sm: { avatar: 'h-6 w-6', text: 'text-xs' },
  md: { avatar: 'h-8 w-8', text: 'text-sm' },
  lg: { avatar: 'h-10 w-10', text: 'text-base' },
};

export const ContributorBadge = ({
  id,
  name,
  avatarUrl,
  role,
  size = 'md',
  className,
  showRole = false,
}: ContributorBadgeProps) => {
  const s = sizeMap[size];
  const display = name || 'Contributor';
  return (
    <Link
      to={`/contributor/${id}`}
      className={cn(
        'inline-flex items-center gap-2 rounded-full pr-3 pl-1 py-1 hover:bg-accent transition-colors group',
        className,
      )}
    >
      <Avatar className={s.avatar}>
        <AvatarImage src={avatarUrl || ''} alt={display} />
        <AvatarFallback className="text-xs">{display[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col leading-tight">
        <span className={cn('font-medium group-hover:text-primary transition-colors', s.text)}>{display}</span>
        {showRole && role && (
          <span className="text-[10px] text-muted-foreground capitalize">{role.replace('_', ' ')}</span>
        )}
      </div>
    </Link>
  );
};

export default ContributorBadge;
