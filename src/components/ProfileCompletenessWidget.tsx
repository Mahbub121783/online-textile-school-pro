import { useAuth } from '@/hooks/useAuth';
import { useProfileCompleteness } from '@/hooks/useProfileCompleteness';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  settingsPath?: string;
  compact?: boolean;
}

const ProfileCompletenessWidget = ({ settingsPath = '/dashboard/settings', compact = false }: Props) => {
  const { profile } = useAuth();
  const { percentage, isComplete, incomplete } = useProfileCompleteness(profile);
  const navigate = useNavigate();

  if (isComplete && compact) return null;

  return (
    <div
      className={`rounded-lg p-3 cursor-pointer transition-colors ${
        isComplete
          ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800'
          : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800'
      }`}
      onClick={() => navigate(settingsPath)}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {isComplete ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        ) : (
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        )}
        <span className="text-xs font-heading font-bold">
          Profile {percentage}%
        </span>
      </div>
      <Progress value={percentage} className="h-1.5" />
      {!compact && !isComplete && (
        <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-2">
          Missing: {incomplete.map(f => f.label).join(', ')}
        </p>
      )}
    </div>
  );
};

export default ProfileCompletenessWidget;
