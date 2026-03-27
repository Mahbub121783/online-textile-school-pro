import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribes to Supabase Realtime changes on key tables and
 * automatically invalidates the relevant React Query caches.
 * Mount once in AdminLayout to keep all admin views live.
 */
export function useAdminRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
        queryClient.invalidateQueries({ queryKey: ['admin-course-stats'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
        queryClient.invalidateQueries({ queryKey: ['admin-recent-enrollments'] });
        queryClient.invalidateQueries({ queryKey: ['admin-course-stats'] });
        queryClient.invalidateQueries({ queryKey: ['admin-enrollment-chart'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-wallet-txs'] });
        queryClient.invalidateQueries({ queryKey: ['withdrawal-requests'] });
        queryClient.invalidateQueries({ queryKey: ['total-payouts'] });
        queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets' }, () => {
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
        queryClient.invalidateQueries({ queryKey: ['admin-instructor-wallets'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-course-stats'] });
        queryClient.invalidateQueries({ queryKey: ['courses-revenue-share'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        queryClient.invalidateQueries({ queryKey: ['admin-instructors-list'] });
        queryClient.invalidateQueries({ queryKey: ['instructors-financial'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'refund_requests' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-refunds-summary'] });
        queryClient.invalidateQueries({ queryKey: ['admin-refund-requests'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_gateways' }, () => {
        queryClient.invalidateQueries({ queryKey: ['payment-gateways'] });
        queryClient.invalidateQueries({ queryKey: ['active-payment-gateways'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_activity_log' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-recent-activity'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, () => {
        queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-quizzes'] });
        queryClient.invalidateQueries({ queryKey: ['quiz-question-counts'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_questions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['quiz-question-counts'] });
        queryClient.invalidateQueries({ queryKey: ['quiz-edit-questions'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_attempts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['quiz-attempt-counts'] });
        queryClient.invalidateQueries({ queryKey: ['quiz-results-attempts'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/**
 * Subscribes to Supabase Realtime for instructor-specific tables.
 * Mount in InstructorLayout.
 */
export function useInstructorRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('instructor-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['instructor-courses-revenue'] });
        queryClient.invalidateQueries({ queryKey: ['instructor-revenue-enrollments'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets' }, () => {
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, () => {
        queryClient.invalidateQueries({ queryKey: ['instructor-courses'] });
        queryClient.invalidateQueries({ queryKey: ['instructor-courses-revenue'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lessons' }, () => {
        queryClient.invalidateQueries({ queryKey: ['instructor-lessons'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, () => {
        queryClient.invalidateQueries({ queryKey: ['instructor-quizzes'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['instructor-assignments'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_attempts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['quiz-attempt-counts'] });
        queryClient.invalidateQueries({ queryKey: ['instructor-quiz-attempts'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignment_submissions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['instructor-submissions'] });
        queryClient.invalidateQueries({ queryKey: ['instructor-assign-subs'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discussions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['course-discussions'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'certificates' }, () => {
        queryClient.invalidateQueries({ queryKey: ['instructor-certificates'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/**
 * Subscribes to Supabase Realtime for student dashboard.
 * Mount in DashboardLayout.
 */
export function useStudentRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('student-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets' }, () => {
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_progress' }, () => {
        queryClient.invalidateQueries({ queryKey: ['lesson-progress'] });
        queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'certificates' }, () => {
        queryClient.invalidateQueries({ queryKey: ['cert-count'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discussions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['lesson-discussions'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
