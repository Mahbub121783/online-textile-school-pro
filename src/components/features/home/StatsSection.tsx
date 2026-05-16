import { useEffect, useState, useRef } from 'react';
import { Users, BookOpen, GraduationCap, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const CountUp = ({ end, decimal, suffix }: { end: number; decimal?: boolean; suffix: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || end <= 0) return;
    hasAnimated.current = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 2000;
          const steps = 60;
          const stepValue = end / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += stepValue;
            if (current >= end) {
              setCount(end);
              clearInterval(timer);
            } else {
              setCount(current);
            }
          }, duration / steps);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [end]);

  return (
    <div ref={ref}>
      <span className="font-heading text-3xl md:text-4xl font-bold text-primary-foreground">
        {decimal ? count.toFixed(1) : Math.floor(count).toLocaleString()}{suffix}
      </span>
    </div>
  );
};

const STATS_CACHE_KEY = 'homepage_stats_v1';
const STATS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

const readStatsCache = () => {
  try {
    const raw = localStorage.getItem(STATS_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || Date.now() - parsed.at > STATS_CACHE_TTL) return undefined;
    return parsed.data;
  } catch { return undefined; }
};

const writeStatsCache = (data: any) => {
  try {
    localStorage.setItem(STATS_CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {}
};

const StatsSection = () => {
  const { data } = useQuery({
    queryKey: ['homepage-stats'],
    initialData: readStatsCache,
    queryFn: async () => {
      // Free-tier: read pre-aggregated row (refreshed by pg_cron every 6h)
      // instead of 4 expensive count queries per anon visitor.
      const { data } = await supabase
        .from('homepage_stats')
        .select('instructors, courses, students, avg_rating')
        .limit(1)
        .maybeSingle();
      const result = {
        instructors: data?.instructors ?? 0,
        courses: data?.courses ?? 0,
        students: data?.students ?? 0,
        avgRating: Number(data?.avg_rating ?? 4.8),
      };
      writeStatsCache(result);
      return result;
    },
    staleTime: 24 * 60 * 60 * 1000, // 24h — counts change slowly
    gcTime: 24 * 60 * 60 * 1000,
    retry: 0,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const stats = [
    { icon: Users, label: 'Total Instructors', value: data?.instructors || 0, suffix: '+' },
    { icon: BookOpen, label: 'Total Courses', value: data?.courses || 0, suffix: '+' },
    { icon: GraduationCap, label: 'Total Students', value: data?.students || 0, suffix: '+' },
    { icon: Star, label: 'Average Rating', value: data?.avgRating || 4.8, suffix: '/5', decimal: true },
  ];

  return (
    <section className="bg-primary py-12 md:py-16">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center space-y-2">
              <stat.icon className="h-8 w-8 text-accent-light mx-auto mb-2" />
              <CountUp end={stat.value} decimal={stat.decimal} suffix={stat.suffix} />
              <p className="text-sm text-primary-foreground/70">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
