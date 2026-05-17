import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useEnrollments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['enrollments', user?.id],
    enabled: !!user,
    staleTime: 120000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrollments')
        .select('*, courses(id, title, slug, thumbnail_url, total_lessons, total_duration_minutes, instructor_id, user_profiles!courses_instructor_id_fkey(full_name))')
        .eq('user_id', user!.id)
        .order('enrolled_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useIsEnrolled(courseId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['enrollment', user?.id, courseId],
    enabled: !!user && !!courseId,
    retry: 0,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('enrollments')
          .select('id')
          .eq('user_id', user!.id)
          .eq('course_id', courseId!)
          .maybeSingle();
        if (error) return false;
        return !!data;
      } catch {
        return false;
      }
    },
  });
}

export function useLessonProgress(courseId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['lesson-progress', user?.id, courseId],
    enabled: !!user && !!courseId,
    retry: 0,
    queryFn: async () => {
      try {
        const { data: sections } = await supabase
          .from('course_sections')
          .select('id')
          .eq('course_id', courseId!);
        if (!sections?.length) return [];

        const sectionIds = sections.map((s) => s.id);
        const { data: lessons } = await supabase
          .from('lessons')
          .select('id')
          .in('section_id', sectionIds);
        if (!lessons?.length) return [];

        const lessonIds = lessons.map((l) => l.id);
        const { data } = await supabase
          .from('lesson_progress')
          .select('*')
          .eq('user_id', user!.id)
          .in('lesson_id', lessonIds);
        return data ?? [];
      } catch {
        return [];
      }
    },
  });
}

export function useMarkLessonComplete() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ lessonId, courseId }: { lessonId: string; courseId: string }) => {
      // 1. Mark lesson complete
      const { error } = await supabase
        .from('lesson_progress')
        .upsert({
          user_id: user!.id,
          lesson_id: lessonId,
          completed: true,
          completed_at: new Date().toISOString(),
        }, { onConflict: 'user_id,lesson_id' });
      if (error) throw error;

      // 2. Recalculate enrollment progress_pct
      const { data: sections } = await supabase
        .from('course_sections')
        .select('id')
        .eq('course_id', courseId);
      if (!sections?.length) return;

      const sectionIds = sections.map((s) => s.id);
      const { data: allLessons } = await supabase
        .from('lessons')
        .select('id')
        .in('section_id', sectionIds);
      if (!allLessons?.length) return;

      const lessonIds = allLessons.map((l) => l.id);
      const { data: completed } = await supabase
        .from('lesson_progress')
        .select('lesson_id')
        .eq('user_id', user!.id)
        .eq('completed', true)
        .in('lesson_id', lessonIds);

      const completedCount = completed?.length ?? 0;
      const totalCount = allLessons.length;
      const progressPct = Math.round((completedCount / totalCount) * 100);

      // Update enrollment
      await supabase
        .from('enrollments')
        .update({
          progress_pct: progressPct,
          ...(progressPct >= 100 ? { completed_at: new Date().toISOString() } : {}),
        } as any)
        .eq('user_id', user!.id)
        .eq('course_id', courseId);

      // 3. Auto-issue certificate if course completed (100%)
      if (progressPct >= 100) {
        await autoIssueCertificate(user!.id, courseId);
      }
    },
    onSuccess: (_, { courseId }) => {
      qc.invalidateQueries({ queryKey: ['lesson-progress', user?.id, courseId] });
      qc.invalidateQueries({ queryKey: ['lesson-progress-map', user?.id] });
      qc.invalidateQueries({ queryKey: ['enrollments'] });
      qc.invalidateQueries({ queryKey: ['my-enrollments-cert', user?.id] });
      qc.invalidateQueries({ queryKey: ['my-certificates', user?.id] });
    },
  });
}

async function autoIssueCertificate(userId: string, courseId: string) {
  try {
    // Check if cert already exists
    const { data: existing } = await supabase
      .from('certificates')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .maybeSingle();
    if (existing) return; // already issued

    // Get course with template
    const { data: course } = await supabase
      .from('courses')
      .select('id, title, cert_template_id, certificate_threshold_pct')
      .eq('id', courseId)
      .single();
    if (!course) return;

    // Check threshold (default 100% — we're already at 100% if we got here)
    const threshold = course.certificate_threshold_pct ?? 100;

    // If gradebook_pass rule, check quiz scores
    let scorePercentage: number | null = null;
    if (course.cert_template_id) {
      const { data: template } = await supabase
        .from('certificate_templates')
        .select('download_rule, min_score_pct')
        .eq('id', course.cert_template_id)
        .single();

      if (template?.download_rule === 'gradebook_pass') {
        const { data: quizzes } = await supabase
          .from('quizzes')
          .select('id, pass_percentage')
          .eq('course_id', courseId)
          .eq('is_published', true);

        if (quizzes?.length) {
          const { data: attempts } = await supabase
            .from('quiz_attempts')
            .select('quiz_id, percentage')
            .eq('user_id', userId)
            .in('quiz_id', quizzes.map(q => q.id))
            .order('percentage', { ascending: false });

          const bestScores = new Map<string, number>();
          (attempts ?? []).forEach((a: any) => {
            if (!bestScores.has(a.quiz_id) || a.percentage > bestScores.get(a.quiz_id)!) {
              bestScores.set(a.quiz_id, a.percentage ?? 0);
            }
          });

          const avgScore = quizzes.reduce((sum, q) => sum + (bestScores.get(q.id) ?? 0), 0) / quizzes.length;
          scorePercentage = Math.round(avgScore);

          const minScore = template.min_score_pct ?? 60;
          if (avgScore < minScore) return; // not eligible
        }
      }
    }

    // Get template snapshot for certificate
    let templateSnapshot = null;
    if (course.cert_template_id) {
      const { data: tmpl } = await supabase
        .from('certificate_templates')
        .select('*')
        .eq('id', course.cert_template_id)
        .single();
      templateSnapshot = tmpl;
    }

    // Generate certificate number
    const certNumber = `CERT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Issue certificate
    const { error: certError } = await supabase.from('certificates').insert({
      user_id: userId,
      course_id: courseId,
      certificate_number: certNumber,
      score_percentage: scorePercentage,
      template_snapshot: templateSnapshot,
      issued_at: new Date().toISOString(),
    });

    if (certError) {
      console.error('Auto-issue certificate failed:', certError);
      return;
    }

    // Notify user
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'certificate',
      title: '🎉 Certificate Earned!',
      message: `Congratulations! You earned a certificate for completing "${course.title}".`,
      link: '/dashboard/certificates',
    });

    // Send certificate email
    try {
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .single();
      if (userProfile) {
        const { data: authUser } = await supabase.auth.admin?.getUserById?.(userId) || {};
        const email = (authUser as any)?.user?.email;
        if (email) {
          await supabase.functions.invoke('send-smtp-email', {
            body: {
              templateKey: 'certificate_issued',
              recipientEmail: email,
              placeholders: {
                student_name: 'Student',
                course_title: course.title,
                certificate_number: certNumber,
              },
            },
          });
        }
      }
    } catch (emailErr) {
      console.warn('Certificate email send failed (non-critical):', emailErr);
    }
  } catch (err) {
    console.error('Certificate auto-issue error:', err);
  }
}

export function useWallet() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['wallet', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useWalletTransactions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['wallet-transactions', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (!wallet) return [];

      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('id, wallet_id, amount, type, description, reference_id, created_at')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}
