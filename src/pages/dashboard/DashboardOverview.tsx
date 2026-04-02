import { BookOpen, Award, Wallet, TrendingUp, Users, FileQuestion } from 'lucide-react';
import { useEnrollments, useWallet, useLessonProgress } from '@/hooks/useEnrollments';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';
import ProfileCompletenessWidget from '@/components/ProfileCompletenessWidget';
import StudentIdCard from '@/components/student/StudentIdCard';

const DashboardOverview = () => {
  const { user } = useAuth();
  const { data: enrollments = [], isLoading: loadingE } = useEnrollments();
  const { data: wallet, isLoading: loadingW } = useWallet();
  const navigate = useNavigate();

  const { data: certificates = [] } = useQuery({
    queryKey: ['cert-count', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('certificates').select('id').eq('user_id', user!.id);
      return data ?? [];
    },
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['referral-count', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('referral_rewards').select('id').eq('referrer_id', user!.id);
      return data ?? [];
    },
  });

  // Fetch lesson progress for all enrolled courses to find smart next lesson
  const inProgressEnrollments = enrollments.filter((e: any) => !e.completed_at);
  const firstInProgress = inProgressEnrollments[0];

  const { data: progressData = [] } = useLessonProgress(firstInProgress?.courses?.id);

  const { data: firstCourseSections = [] } = useQuery({
    queryKey: ['smart-continue-sections', firstInProgress?.courses?.id],
    enabled: !!firstInProgress?.courses?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('course_sections')
        .select('*, lessons(*)')
        .eq('course_id', firstInProgress.courses.id)
        .order('sort_order');
      return (data ?? []).map((s: any) => ({
        ...s,
        lessons: (s.lessons ?? []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      }));
    },
  });

  const completedIds = useMemo(() => new Set(progressData.filter((p: any) => p.completed).map((p: any) => p.lesson_id)), [progressData]);
  const allLessonsFirst = useMemo(() => firstCourseSections.flatMap((s: any) => s.lessons), [firstCourseSections]);
  const nextLessonForContinue = useMemo(() => allLessonsFirst.find((l: any) => !completedIds.has(l.id)), [allLessonsFirst, completedIds]);

  const completedCount = enrollments.filter((e: any) => e.completed_at).length;
  const avgProgress = enrollments.length
    ? Math.round(enrollments.reduce((s: number, e: any) => s + (e.progress_pct || 0), 0) / enrollments.length)
    : 0;

  const stats = [
    { label: 'Enrolled Courses', value: enrollments.length, icon: BookOpen, color: 'text-primary', link: '/dashboard/courses' },
    { label: 'Certificates', value: certificates.length, icon: Award, color: 'text-accent', link: '/dashboard/certificates' },
    { label: 'Avg. Progress', value: `${avgProgress}%`, icon: TrendingUp, color: 'text-primary', link: '/dashboard/courses' },
    { label: 'Wallet Balance', value: `৳${wallet?.balance ?? 0}`, icon: Wallet, color: 'text-primary', link: '/dashboard/wallet' },
    { label: 'Referrals', value: referrals.length, icon: Users, color: 'text-primary', link: '/dashboard/referrals' },
    { label: 'Completed', value: completedCount, icon: FileQuestion, color: 'text-accent', link: '/dashboard/courses' },
  ];

  if (loadingE || loadingW) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProfileCompletenessWidget />

      <h2 className="font-heading text-2xl font-bold">Welcome back!</h2>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-card border rounded-xl p-4 md:p-5 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(s.link)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="font-heading text-xl md:text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-xl p-6">
        <h3 className="font-heading font-bold text-lg mb-4">Continue Learning</h3>
        {enrollments.length > 0 ? (
          <div className="grid gap-3">
            {enrollments.slice(0, 3).map((enrollment: any) => {
              const isFirst = enrollment.id === firstInProgress?.id;
              const smartLink = isFirst && nextLessonForContinue
                ? `/learn/${enrollment.courses?.slug}/${nextLessonForContinue.id}`
                : `/courses/${enrollment.courses?.slug}`;

              return (
                <div key={enrollment.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <img
                    src={enrollment.courses?.thumbnail_url || '/placeholder.svg'}
                    alt={enrollment.courses?.title}
                    className="w-16 h-12 rounded object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{enrollment.courses?.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${enrollment.progress_pct || 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{enrollment.progress_pct || 0}%</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(smartLink)}>
                    {enrollment.completed_at ? 'Review' : 'Continue'}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted" />
            <p>You haven't enrolled in any courses yet.</p>
            <Button className="mt-4 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => navigate('/courses')}>
              Browse Courses
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;
