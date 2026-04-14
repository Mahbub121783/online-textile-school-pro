import { supabase } from '@/integrations/supabase/client';
import { sendCustomEmail } from '@/lib/emailSender';

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

/**
 * Create in-app notification AND send email notification.
 * Fetches user email from auth if not provided.
 */
export async function createNotificationWithEmail(
  params: CreateNotificationParams & { recipientEmail?: string }
) {
  // Create in-app notification
  await createNotification(params);

  // Send email notification
  try {
    let email = params.recipientEmail;
    if (!email) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', params.userId)
        .single();
      if (profile) {
        // Get email from auth - use a known workaround via edge function or stored email
        // For now, try to get from institutional_email_requests or user_profiles
        const { data: emailReq } = await supabase
          .from('institutional_email_requests')
          .select('requested_email')
          .eq('user_id', params.userId)
          .eq('status', 'approved')
          .limit(1);
        email = (emailReq as any)?.[0]?.requested_email;
      }
    }
    if (email) {
      await sendCustomEmail(
        email,
        `🔔 ${params.title}`,
        buildNotificationEmailHtml(params.title, params.message, params.link),
        { notification_type: params.type, user_id: params.userId }
      );
    }
  } catch (e) {
    console.error('Failed to send notification email:', e);
  }
}

function buildNotificationEmailHtml(title: string, message: string, link?: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:#0ea5e9;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:18px;">🔔 ${title}</h2>
      </div>
      <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
        <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 16px;">${message}</p>
        ${link ? `<a href="https://learn-textile-hub.lovable.app${link}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;">View Details</a>` : ''}
      </div>
      <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:16px;">Online Textile School — Notification</p>
    </div>
  `;
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

/**
 * Broadcast in-app notifications AND send emails to all recipients.
 */
export async function broadcastNotificationWithEmail(params: {
  userIds: string[];
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}) {
  await broadcastNotification(params);
  // Send emails in background - don't block
  for (const uid of params.userIds) {
    createNotificationWithEmail({
      userId: uid,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
      metadata: params.metadata,
      recipientEmail: undefined,
    }).catch(() => {});
  }
}

export async function notifyAllStudents(params: Omit<CreateNotificationParams, 'userId'>) {
  const { data: roles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'student');
  if (!roles?.length) return;
  return broadcastNotification({ userIds: roles.map(r => r.user_id), ...params });
}

export async function notifyAllStudentsWithEmail(params: Omit<CreateNotificationParams, 'userId'>) {
  const { data: roles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'student');
  if (!roles?.length) return;
  return broadcastNotificationWithEmail({ userIds: roles.map(r => r.user_id), ...params });
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
  COURSE_APPROVED: 'course_approved',
  COURSE_REJECTED: 'course_rejected',
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
  // Admin actions
  ORDER_APPROVED: 'order_approved',
  ORDER_REJECTED: 'order_rejected',
  PAYMENT_CONFIRMED: 'payment_confirmed',
  ACCOUNT_BLOCKED: 'account_blocked',
  ACCOUNT_UNBLOCKED: 'account_unblocked',
  EMAIL_APPROVED: 'email_approved',
  EMAIL_REJECTED: 'email_rejected',
  EMAIL_BLOCKED: 'email_blocked',
  EMAIL_UNBLOCKED: 'email_unblocked',
  WALLET_TOPUP_APPROVED: 'wallet_topup_approved',
  WALLET_TOPUP_REJECTED: 'wallet_topup_rejected',
  RESEARCH_STATUS: 'research_status',
  CERTIFICATE_READY: 'certificate_ready',
  EVENT_PUBLISHED: 'event_published',
  // Social
  CHAT_REQUEST_RECEIVED: 'chat_request_received',
  CHAT_REQUEST_ACCEPTED: 'chat_request_accepted',
  CHAT_REQUEST_REJECTED: 'chat_request_rejected',
  NEW_MESSAGE: 'new_message',
  UNREPLIED_MESSAGE: 'unreplied_message',
  // Mail
  EDUMAIL_RECEIVED: 'edumail_received',
} as const;
