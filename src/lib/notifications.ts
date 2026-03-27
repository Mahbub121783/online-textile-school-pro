import { supabase } from '@/integrations/supabase/client';

export interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}

export async function createNotification(params: CreateNotificationParams) {
  const { error } = await supabase.from('notifications' as any).insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link || null,
    metadata: params.metadata || {},
  });
  if (error) console.error('Failed to create notification:', error);
  return { error };
}

export async function broadcastNotification(params: {
  userIds: string[];
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}) {
  if (!params.userIds.length) return;
  const rows = params.userIds.map(uid => ({
    user_id: uid,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link || null,
    metadata: params.metadata || {},
  }));
  const { error } = await supabase.from('notifications' as any).insert(rows);
  if (error) console.error('Failed to broadcast notifications:', error);
  return { error };
}

export async function notifyAllStudents(params: Omit<CreateNotificationParams, 'userId'>) {
  const { data: roles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'student');
  if (!roles?.length) return;
  return broadcastNotification({ userIds: roles.map(r => r.user_id), ...params });
}

export async function notifyEnrolledStudents(courseId: string, params: Omit<CreateNotificationParams, 'userId'>) {
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('user_id')
    .eq('course_id', courseId);
  if (!enrollments?.length) return;
  const uniqueIds = [...new Set(enrollments.map(e => e.user_id))];
  return broadcastNotification({ userIds: uniqueIds, ...params });
}

export async function notifyInstructor(courseId: string, params: Omit<CreateNotificationParams, 'userId'>) {
  const { data: course } = await supabase
    .from('courses')
    .select('instructor_id')
    .eq('id', courseId)
    .single();
  if (!course?.instructor_id) return;
  return createNotification({ userId: course.instructor_id, ...params });
}

export const NOTIFICATION_TYPES = {
  COURSE_PUBLISHED: 'course_published',
  LESSON_LOCKED: 'lesson_locked',
  RESULT_PUBLISHED: 'result_published',
  RESULT_RECALCULATED: 'result_recalculated',
  MATERIAL_UPLOADED: 'material_uploaded',
  QA_ANSWERED: 'qa_answered',
  ASSIGNMENT_GRADED: 'assignment_graded',
  QUIZ_GRADED: 'quiz_graded',
  ENROLLMENT: 'enrollment',
  ANNOUNCEMENT: 'announcement',
  SYSTEM: 'system',
} as const;
