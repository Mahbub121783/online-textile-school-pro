import { useState, useEffect } from 'react';
import { differenceInSeconds } from 'date-fns';

interface CountdownTimerProps {
  targetDate: Date;
  className?: string;
  compact?: boolean;
}

export function CountdownTimer({ targetDate, className = '', compact = false }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(targetDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (timeLeft.total <= 0) {
    return <span className={`text-green-600 font-semibold ${className}`}>Started!</span>;
  }

  if (compact) {
    return (
      <span className={`font-mono text-sm ${className}`}>
        {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m
      </span>
    );
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      {[
        { label: 'Days', value: timeLeft.days },
        { label: 'Hours', value: timeLeft.hours },
        { label: 'Min', value: timeLeft.minutes },
        { label: 'Sec', value: timeLeft.seconds },
      ].map((item) => (
        <div key={item.label} className="flex flex-col items-center bg-muted rounded-lg px-3 py-2 min-w-[3.5rem]">
          <span className="text-xl font-bold font-mono text-primary">{String(item.value).padStart(2, '0')}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function calculateTimeLeft(target: Date) {
  const total = differenceInSeconds(target, new Date());
  if (total <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    total,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}
