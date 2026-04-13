import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { Mail, Eye, Save, FileText, ChevronDown } from 'lucide-react';

/* ── Global placeholder groups ── */
const GLOBAL_PLACEHOLDERS: { group: string; items: string[] }[] = [
  {
    group: 'User Profile',
    items: [
      '{{user_name}}','{{user_email}}','{{user_phone}}','{{user_avatar_url}}','{{user_batch}}',
      '{{user_blood_group}}','{{user_company_name}}','{{user_country}}','{{user_current_job}}',
      '{{user_date_of_birth}}','{{user_district}}','{{user_division}}','{{user_occupation}}',
      '{{user_professional_role}}','{{user_referral_code}}','{{user_roll_id}}','{{user_university}}',
      '{{user_username}}','{{user_created_at}}',
    ],
  },
  {
    group: 'Course',
    items: ['{{course_name}}','{{course_id}}','{{course_price}}','{{course_description}}','{{course_url}}','{{course_instructor}}'],
  },
  {
    group: 'Order / Invoice',
    items: ['{{order_id}}','{{order_total}}','{{order_items}}','{{order_date}}','{{invoice_number}}','{{payment_method}}','{{payment_status}}'],
  },
  {
    group: 'Ebook',
    items: ['{{ebook_title}}','{{ebook_id}}','{{ebook_author}}','{{ebook_price}}','{{ebook_download_url}}'],
  },
  {
    group: 'Certificate',
    items: ['{{certificate_number}}','{{certificate_download_url}}','{{certificate_date}}'],
  },
  {
    group: 'Registration',
    items: ['{{registration_type}}','{{registration_date}}','{{registration_status}}'],
  },
  {
    group: 'System',
    items: ['{{site_name}}','{{site_url}}','{{support_email}}','{{current_date}}','{{current_year}}','{{login_url}}'],
  },
];

/* ── Default template bodies ── */
function defaultBody(key: string): { subject: string; body: string } {
  const defs: Record<string, { subject: string; body: string }> = {
    order_confirmation: {
      subject: 'Order Confirmed — #{{order_id}}',
      body: `<h2 style="margin:0 0 16px">Thank you for your order, {{user_name}}!</h2>
<p>Your order <strong>#{{order_id}}</strong> has been confirmed.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr style="background:#f0f0f0"><td style="padding:8px;font-weight:bold">Items</td><td style="padding:8px">{{order_items}}</td></tr>
<tr><td style="padding:8px;font-weight:bold">Total</td><td style="padding:8px">{{order_total}}</td></tr>
<tr style="background:#f0f0f0"><td style="padding:8px;font-weight:bold">Payment</td><td style="padding:8px">{{payment_method}}</td></tr>
<tr><td style="padding:8px;font-weight:bold">Invoice</td><td style="padding:8px">{{invoice_number}}</td></tr>
</table>
<p>If you have any questions, contact us at {{support_email}}.</p>`,
    },
    order_cancellation: {
      subject: 'Order Cancelled — #{{order_id}}',
      body: `<h2 style="margin:0 0 16px">Order Cancelled</h2>
<p>Hi {{user_name}}, your order <strong>#{{order_id}}</strong> has been cancelled.</p>
<p><strong>Reason:</strong> {{reason}}</p>
<p>If this was a mistake, please contact {{support_email}}.</p>`,
    },
    instructor_approved: {
      subject: 'Congratulations! You are now an Instructor',
      body: `<h2 style="margin:0 0 16px">Welcome to Our Instructor Team!</h2>
<p>Dear {{user_name}},</p>
<p>Your instructor application has been <strong>approved</strong>. You can now create courses and start teaching.</p>
<p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Go to Dashboard</a></p>`,
    },
    instructor_rejected: {
      subject: 'Instructor Application Update',
      body: `<h2 style="margin:0 0 16px">Application Update</h2>
<p>Dear {{user_name}},</p>
<p>After careful review, we were unable to approve your instructor application at this time.</p>
<p><strong>Reason:</strong> {{reason}}</p>
<p>Feel free to reapply or contact {{support_email}} for more information.</p>`,
    },
    student_approved: {
      subject: 'Account Approved — Start Learning!',
      body: `<h2 style="margin:0 0 16px">Your Account is Approved!</h2>
<p>Hi {{user_name}}, your student account has been approved. You can now enroll in courses.</p>
<p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Login Now</a></p>`,
    },
    student_rejected: {
      subject: 'Account Registration Update',
      body: `<h2 style="margin:0 0 16px">Registration Update</h2>
<p>Dear {{user_name}}, we were unable to approve your registration at this time.</p>
<p><strong>Reason:</strong> {{reason}}</p>
<p>Please contact {{support_email}} if you have questions.</p>`,
    },
    password_reset: {
      subject: 'Reset Your Password',
      body: `<h2 style="margin:0 0 16px">Password Reset Request</h2>
<p>Hi {{user_name}}, we received a request to reset your password.</p>
<p><a href="{{reset_link}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Reset Password</a></p>
<p style="color:#888;font-size:13px">If you didn't request this, please ignore this email.</p>`,
    },
    welcome_email: {
      subject: 'Welcome to {{site_name}}!',
      body: `<h2 style="margin:0 0 16px">Welcome, {{user_name}}! 🎉</h2>
<p>Thank you for joining <strong>{{site_name}}</strong>. We're thrilled to have you!</p>
<p>Your Student ID: <strong>{{user_roll_id}}</strong></p>
<p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Explore Courses</a></p>`,
    },
    enrollment_confirmation: {
      subject: 'Enrolled in {{course_name}}',
      body: `<h2 style="margin:0 0 16px">Enrollment Confirmed!</h2>
<p>Hi {{user_name}}, you have been successfully enrolled in <strong>{{course_name}}</strong>.</p>
<p><a href="{{course_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Start Learning</a></p>`,
    },
    certificate_issued: {
      subject: 'Your Certificate is Ready — {{course_name}}',
      body: `<h2 style="margin:0 0 16px">Congratulations, {{user_name}}! 🏆</h2>
<p>You have earned a certificate for completing <strong>{{course_name}}</strong>.</p>
<p>Certificate No: <strong>{{certificate_number}}</strong></p>
<p><a href="{{certificate_download_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Download Certificate</a></p>`,
    },
    registration_approved: {
      subject: 'Registration Approved',
      body: `<h2 style="margin:0 0 16px">Registration Approved!</h2>
<p>Hi {{user_name}}, your <strong>{{registration_type}}</strong> registration has been approved.</p>
<p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Login Now</a></p>`,
    },
    registration_rejected: {
      subject: 'Registration Update',
      body: `<h2 style="margin:0 0 16px">Registration Update</h2>
<p>Dear {{user_name}}, your <strong>{{registration_type}}</strong> registration could not be approved.</p>
<p><strong>Reason:</strong> {{reason}}</p>
<p>Contact {{support_email}} for assistance.</p>`,
    },
    push_notification: {
      subject: '{{notification_title}}',
      body: `<h2 style="margin:0 0 16px">{{notification_title}}</h2>
<p>Hi {{user_name}},</p>
<p>{{notification_body}}</p>
<p><a href="{{action_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">View Details</a></p>`,
    },
    account_suspended: {
      subject: 'Account Suspended',
      body: `<h2 style="margin:0 0 16px;color:#c53030">Account Suspended</h2>
<p>Dear {{user_name}}, your account has been suspended.</p>
<p><strong>Reason:</strong> {{reason}}</p>
<p>Please contact <a href="mailto:{{support_email}}">{{support_email}}</a> for more information.</p>`,
    },
    payment_received: {
      subject: 'Payment Received — {{amount}}',
      body: `<h2 style="margin:0 0 16px">Payment Received ✓</h2>
<p>Hi {{user_name}}, we have received your payment of <strong>{{amount}}</strong> via {{payment_method}}.</p>
<p>Invoice: <strong>{{invoice_number}}</strong></p>
<p><a href="{{invoice_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">View Invoice</a></p>`,
    },
    refund_processed: {
      subject: 'Refund Processed — {{amount}}',
      body: `<h2 style="margin:0 0 16px">Refund Processed</h2>
<p>Hi {{user_name}}, a refund of <strong>{{amount}}</strong> for order <strong>#{{order_id}}</strong> has been processed.</p>
<p>The amount will be credited within 5-7 business days.</p>`,
    },
    ebook_purchase: {
      subject: 'Ebook Purchase Confirmed — {{ebook_title}}',
      body: `<h2 style="margin:0 0 16px">Ebook Purchase Confirmed!</h2>
<p>Hi {{user_name}}, you have purchased <strong>{{ebook_title}}</strong> by {{ebook_author}}.</p>
<p><a href="{{ebook_download_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Read Now</a></p>`,
    },
    ebook_download: {
      subject: 'Your Ebook Download Link — {{ebook_title}}',
      body: `<h2 style="margin:0 0 16px">Your Ebook is Ready</h2>
<p>Hi {{user_name}}, here's your download link for <strong>{{ebook_title}}</strong>.</p>
<p><a href="{{ebook_download_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Download Ebook</a></p>
<p style="color:#888;font-size:13px">This link is for your personal use only.</p>`,
    },
    user_registration: {
      subject: 'Welcome to {{site_name}} — Account Created',
      body: `<h2 style="margin:0 0 16px">Account Created Successfully!</h2>
<p>Hi {{user_name}}, your account at <strong>{{site_name}}</strong> has been created.</p>
<p>Your Roll ID: <strong>{{user_roll_id}}</strong></p>
<p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Login to Your Account</a></p>`,
    },
    course_completion: {
      subject: 'Congratulations! You Completed {{course_name}}',
      body: `<h2 style="margin:0 0 16px">Course Completed! 🎓</h2>
<p>Dear {{user_name}}, congratulations on completing <strong>{{course_name}}</strong>!</p>
<p>Your certificate is ready for download.</p>
<p><a href="{{certificate_download_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Get Certificate</a></p>`,
    },
    assignment_submitted: {
      subject: 'Assignment Submitted Successfully',
      body: `<h2 style="margin:0 0 16px">Assignment Submitted</h2>
<p>Hi {{user_name}}, your assignment for <strong>{{course_name}}</strong> has been submitted successfully.</p>
<p>Your instructor will review and grade it shortly.</p>`,
    },
    quiz_completed: {
      subject: 'Quiz Results — {{course_name}}',
      body: `<h2 style="margin:0 0 16px">Quiz Completed!</h2>
<p>Hi {{user_name}}, you have completed the quiz for <strong>{{course_name}}</strong>.</p>
<p>Check your dashboard for detailed results.</p>
<p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">View Results</a></p>`,
    },
    wallet_credit: {
      subject: 'Wallet Credited — {{amount}}',
      body: `<h2 style="margin:0 0 16px">Wallet Credited ✓</h2>
<p>Hi {{user_name}}, <strong>{{amount}}</strong> has been added to your wallet.</p>
<p>You can use this balance for course enrollments and ebook purchases.</p>`,
    },
    wallet_debit: {
      subject: 'Wallet Debit — {{amount}}',
      body: `<h2 style="margin:0 0 16px">Wallet Debit</h2>
<p>Hi {{user_name}}, <strong>{{amount}}</strong> has been deducted from your wallet.</p>
<p>Check your wallet history for details.</p>`,
    },
    id_card_issued: {
      subject: 'Your Student ID Card is Ready',
      body: `<h2 style="margin:0 0 16px">Student ID Card Issued 🎫</h2>
<p>Hi {{user_name}}, your student ID card has been generated.</p>
<p>Roll ID: <strong>{{user_roll_id}}</strong></p>
<p><a href="{{login_url}}" style="display:inline-block;padding:12px 24px;background:#1a365d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">View ID Card</a></p>`,
    },
  };
  return defs[key] || { subject: '', body: '' };
}

const TEMPLATE_TYPES = [
  { key: 'order_confirmation', label: 'Order Confirmation' },
  { key: 'order_cancellation', label: 'Order Cancellation' },
  { key: 'instructor_approved', label: 'Instructor Approved' },
  { key: 'instructor_rejected', label: 'Instructor Rejected' },
  { key: 'student_approved', label: 'Student Account Approved' },
  { key: 'student_rejected', label: 'Student Account Rejected' },
  { key: 'password_reset', label: 'Password Reset' },
  { key: 'welcome_email', label: 'Welcome Email' },
  { key: 'enrollment_confirmation', label: 'Enrollment Confirmation' },
  { key: 'certificate_issued', label: 'Certificate Issued' },
  { key: 'registration_approved', label: 'Registration Approved' },
  { key: 'registration_rejected', label: 'Registration Rejected' },
  { key: 'push_notification', label: 'Push Notification' },
  { key: 'account_suspended', label: 'Account Suspended' },
  { key: 'payment_received', label: 'Payment Received' },
  { key: 'refund_processed', label: 'Refund Processed' },
  { key: 'ebook_purchase', label: 'Ebook Purchase Confirmation' },
  { key: 'ebook_download', label: 'Ebook Download Link' },
  { key: 'user_registration', label: 'New User Registration' },
  { key: 'course_completion', label: 'Course Completion' },
  { key: 'assignment_submitted', label: 'Assignment Submitted' },
  { key: 'quiz_completed', label: 'Quiz Completed' },
  { key: 'wallet_credit', label: 'Wallet Credit' },
  { key: 'wallet_debit', label: 'Wallet Debit' },
  { key: 'id_card_issued', label: 'Student ID Card Issued' },
];

interface TemplateData {
  subject: string;
  body: string;
}

const EmailTemplatesTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [formData, setFormData] = useState<TemplateData>({ subject: '', body: '' });
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const keys = TEMPLATE_TYPES.map(t => `email_template_${t.key}`);
      const { data } = await supabase.from('site_settings').select('*').in('key', keys);
      const map: Record<string, TemplateData> = {};
      data?.forEach((s: any) => {
        try {
          map[s.key.replace('email_template_', '')] = JSON.parse(s.value || '{}');
        } catch { /* ignore */ }
      });
      return map;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ key, data }: { key: string; data: TemplateData }) => {
      const settingKey = `email_template_${key}`;
      const value = JSON.stringify(data);
      const { data: existing } = await supabase.from('site_settings').select('id').eq('key', settingKey).maybeSingle();
      if (existing) {
        await supabase.from('site_settings').update({ value }).eq('key', settingKey);
      } else {
        await supabase.from('site_settings').insert({ key: settingKey, value });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setEditing(null);
      toast({ title: 'Template saved successfully' });
    },
    onError: () => toast({ title: 'Failed to save template', variant: 'destructive' }),
  });

  const openEditor = (key: string) => {
    const existing = templates?.[key];
    if (existing?.subject || existing?.body) {
      setFormData(existing);
    } else {
      setFormData(defaultBody(key));
    }
    setEditing(key);
  };

  const insertPlaceholder = (p: string) => {
    const ta = bodyRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newBody = formData.body.substring(0, start) + p + formData.body.substring(end);
      setFormData(prev => ({ ...prev, body: newBody }));
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + p.length; ta.focus(); }, 0);
    } else {
      setFormData(prev => ({ ...prev, body: prev.body + ' ' + p }));
    }
  };

  const previewConfig = previewKey ? TEMPLATE_TYPES.find(t => t.key === previewKey) : null;
  const previewData = previewKey ? (templates?.[previewKey] || defaultBody(previewKey)) : null;

  if (isLoading) return <div className="text-muted-foreground">Loading templates...</div>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Customize email templates sent to users. Use placeholder variables like <code className="bg-muted px-1 rounded">{'{{user_name}}'}</code> for dynamic content. All placeholders from every category are available in every template.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TEMPLATE_TYPES.map(tmpl => {
          const hasTemplate = !!templates?.[tmpl.key]?.subject;
          return (
            <Card key={tmpl.key} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    {tmpl.label}
                  </CardTitle>
                  <Badge variant={hasTemplate ? 'default' : 'secondary'} className="text-[10px]">
                    {hasTemplate ? 'Custom' : 'Default'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground mb-3 truncate">
                  {templates?.[tmpl.key]?.subject || defaultBody(tmpl.key).subject || 'No subject'}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEditor(tmpl.key)}>
                    <Mail className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPreviewKey(tmpl.key)}>
                    <Eye className="h-3 w-3 mr-1" /> Preview
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Editor Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit: {TEMPLATE_TYPES.find(t => t.key === editing)?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Subject Line</Label>
              <Input value={formData.subject} onChange={e => setFormData(p => ({ ...p, subject: e.target.value }))} placeholder="Enter email subject..." />
            </div>
            <div className="space-y-2">
              <Label>Email Body (HTML)</Label>
              <Textarea ref={bodyRef} rows={14} value={formData.body} onChange={e => setFormData(p => ({ ...p, body: e.target.value }))} placeholder="Enter email body content..." className="font-mono text-xs" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Click a placeholder to insert at cursor:</Label>
              <div className="space-y-1 max-h-48 overflow-y-auto border rounded p-2">
                {GLOBAL_PLACEHOLDERS.map(g => (
                  <Collapsible key={g.group}>
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground w-full py-1">
                      <ChevronDown className="h-3 w-3" /> {g.group}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="flex flex-wrap gap-1 pl-4 py-1">
                        {g.items.map(p => (
                          <Badge key={p} variant="outline" className="text-[10px] cursor-pointer hover:bg-primary/10" onClick={() => insertPlaceholder(p)}>
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </div>
            <Button onClick={() => editing && saveMutation.mutate({ key: editing, data: formData })} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewKey} onOpenChange={() => setPreviewKey(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview: {previewConfig?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted p-3 rounded">
              <span className="text-xs font-medium text-muted-foreground">Subject:</span>
              <p className="text-sm font-medium">{previewData?.subject || 'No subject'}</p>
            </div>
            <div className="border rounded p-4 bg-background">
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewData?.body || '<p>No content</p>' }} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailTemplatesTab;
