import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { sendCustomEmail, sendTemplateEmail } from '@/lib/emailSender';
import { Send, Users, User, BookOpen, PenLine, Search, X, ChevronDown } from 'lucide-react';

/* ── Global placeholder groups (same as templates) ── */
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
  { group: 'Course', items: ['{{course_name}}','{{course_id}}','{{course_price}}','{{course_description}}','{{course_url}}','{{course_instructor}}'] },
  { group: 'Order / Invoice', items: ['{{order_id}}','{{order_total}}','{{order_items}}','{{order_date}}','{{invoice_number}}','{{payment_method}}','{{payment_status}}'] },
  { group: 'Ebook', items: ['{{ebook_title}}','{{ebook_id}}','{{ebook_author}}','{{ebook_price}}','{{ebook_download_url}}'] },
  { group: 'Certificate', items: ['{{certificate_number}}','{{certificate_download_url}}','{{certificate_date}}'] },
  { group: 'Registration', items: ['{{registration_type}}','{{registration_date}}','{{registration_status}}'] },
  { group: 'System', items: ['{{site_name}}','{{site_url}}','{{support_email}}','{{current_date}}','{{current_year}}','{{login_url}}'] },
];

interface UserResult {
  id: string;
  full_name: string;
  phone: string | null;
  roll_id: string | null;
  username: string | null;
  email?: string;
}

const TEMPLATE_OPTIONS = [
  { key: 'order_confirmation', label: 'Order Confirmation' },
  { key: 'order_cancellation', label: 'Order Cancellation' },
  { key: 'welcome_email', label: 'Welcome Email' },
  { key: 'enrollment_confirmation', label: 'Enrollment Confirmation' },
  { key: 'certificate_issued', label: 'Certificate Issued' },
  { key: 'instructor_approved', label: 'Instructor Approved' },
  { key: 'instructor_rejected', label: 'Instructor Rejected' },
  { key: 'student_approved', label: 'Student Approved' },
  { key: 'student_rejected', label: 'Student Rejected' },
  { key: 'password_reset', label: 'Password Reset' },
  { key: 'registration_approved', label: 'Registration Approved' },
  { key: 'registration_rejected', label: 'Registration Rejected' },
  { key: 'push_notification', label: 'Push Notification' },
  { key: 'account_suspended', label: 'Account Suspended' },
  { key: 'payment_received', label: 'Payment Received' },
  { key: 'refund_processed', label: 'Refund Processed' },
  { key: 'ebook_purchase', label: 'Ebook Purchase' },
  { key: 'ebook_download', label: 'Ebook Download' },
  { key: 'user_registration', label: 'User Registration' },
  { key: 'course_completion', label: 'Course Completion' },
  { key: 'assignment_submitted', label: 'Assignment Submitted' },
  { key: 'quiz_completed', label: 'Quiz Completed' },
  { key: 'wallet_credit', label: 'Wallet Credit' },
  { key: 'wallet_debit', label: 'Wallet Debit' },
  { key: 'id_card_issued', label: 'ID Card Issued' },
];

const AdminEmailCompose = () => {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<'custom' | 'template'>('custom');
  const [audience, setAudience] = useState<'individual' | 'all_students' | 'course_students'>('individual');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [templateKey, setTemplateKey] = useState('');
  const [sentCount, setSentCount] = useState(0);

  // User search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const { data: courses } = useQuery({
    queryKey: ['courses-for-email'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').order('title');
      return data || [];
    },
  });

  const { data: searchResults } = useQuery({
    queryKey: ['user-search-email', searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];
      const { data } = await supabase
        .from('user_profiles')
        .select('id, full_name, phone, roll_id, username')
        .or(`full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%,roll_id.ilike.%${searchQuery}%`)
        .limit(10);
      return (data || []) as UserResult[];
    },
    enabled: searchQuery.length >= 2,
  });

  const handleSearchChange = useCallback((val: string) => {
    setSearchQuery(val);
    setShowResults(val.length >= 2);
  }, []);

  const addUser = (user: UserResult) => {
    if (!selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(prev => [...prev, user]);
    }
    setSearchQuery('');
    setShowResults(false);
  };

  const removeUser = (id: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== id));
  };

  const insertPlaceholder = (p: string) => {
    const ta = bodyRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newBody = body.substring(0, start) + p + body.substring(end);
      setBody(newBody);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + p.length; ta.focus(); }, 0);
    } else {
      setBody(b => b + ' ' + p);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setSentCount(0);
    try {
      let emails: string[] = [];

      if (audience === 'individual') {
        // Combine manual emails + selected user emails
        const manualEmails = recipientEmail.split(',').map(e => e.trim()).filter(Boolean);
        // For selected users, we need their email — user_profiles doesn't store email
        // So we rely on manual email input for now, but selected users add their names for placeholders
        emails = manualEmails;
        if (emails.length === 0 && selectedUsers.length === 0) {
          toast({ title: 'Enter recipient email or select users', variant: 'destructive' });
          setSending(false);
          return;
        }
        if (emails.length === 0 && selectedUsers.length > 0) {
          toast({ title: 'Please also enter the email addresses for selected users', variant: 'destructive' });
          setSending(false);
          return;
        }
      } else if (audience === 'all_students') {
        const manualEmails = recipientEmail.split(',').map(e => e.trim()).filter(Boolean);
        if (manualEmails.length === 0) {
          toast({ title: 'Enter student email addresses (comma-separated) for bulk send', variant: 'destructive' });
          setSending(false);
          return;
        }
        emails = manualEmails;
      } else if (audience === 'course_students') {
        if (!selectedCourse) { toast({ title: 'Select a course', variant: 'destructive' }); setSending(false); return; }
        const manualEmails = recipientEmail.split(',').map(e => e.trim()).filter(Boolean);
        if (manualEmails.length === 0) {
          toast({ title: 'Enter enrolled student email addresses for this course', variant: 'destructive' });
          setSending(false);
          return;
        }
        emails = manualEmails;
      }

      let count = 0;
      for (const email of emails) {
        try {
          if (mode === 'template' && templateKey) {
            await sendTemplateEmail(templateKey, email, { user_name: email.split('@')[0] });
          } else {
            await sendCustomEmail(email, subject, body);
          }
          count++;
        } catch (err: any) {
          console.error(`Failed to send to ${email}:`, err);
        }
      }

      setSentCount(count);
      toast({ title: `${count} email(s) sent successfully` });
      if (count === emails.length) {
        setRecipientEmail('');
        setSubject('');
        setBody('');
        setSelectedUsers([]);
      }
    } catch (err: any) {
      toast({ title: 'Failed to send emails', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
        <PenLine className="h-6 w-6 text-primary" /> Compose Email
      </h2>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Audience */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Recipients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant={audience === 'individual' ? 'default' : 'outline'} onClick={() => setAudience('individual')}><User className="h-3 w-3 mr-1" />Individual</Button>
                <Button size="sm" variant={audience === 'all_students' ? 'default' : 'outline'} onClick={() => setAudience('all_students')}><Users className="h-3 w-3 mr-1" />All Students</Button>
                <Button size="sm" variant={audience === 'course_students' ? 'default' : 'outline'} onClick={() => setAudience('course_students')}><BookOpen className="h-3 w-3 mr-1" />Course Students</Button>
              </div>

              {/* User search */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Search className="h-3 w-3" /> Search Users from Database</Label>
                <div className="relative">
                  <Input
                    placeholder="Search by name, phone, roll ID, or username..."
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                    onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                    onBlur={() => setTimeout(() => setShowResults(false), 200)}
                  />
                  {showResults && searchResults && searchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {searchResults.map(u => (
                        <button
                          key={u.id}
                          className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                          onMouseDown={() => addUser(u)}
                        >
                          <span className="font-medium">{u.full_name || 'Unnamed'}</span>
                          <span className="text-xs text-muted-foreground">{u.roll_id || u.phone || u.username || ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedUsers.map(u => (
                      <Badge key={u.id} variant="secondary" className="text-xs flex items-center gap-1">
                        {u.full_name || 'Unnamed'} {u.roll_id ? `(${u.roll_id})` : ''}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => removeUser(u.id)} />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Manual email input */}
              <div className="space-y-2">
                <Label>Email Address(es)</Label>
                <Input placeholder="email@example.com (comma-separated for multiple)" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} />
                <p className="text-xs text-muted-foreground">Enter email addresses manually or search users above. Separate multiple with commas.</p>
              </div>

              {audience === 'course_students' && (
                <div className="space-y-2">
                  <Label>Select Course</Label>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger><SelectValue placeholder="Choose a course" /></SelectTrigger>
                    <SelectContent>
                      {courses?.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Content */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Email Content</CardTitle>
              <div className="flex gap-2">
                <Badge variant={mode === 'custom' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setMode('custom')}>Custom</Badge>
                <Badge variant={mode === 'template' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setMode('template')}>Use Template</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === 'template' ? (
                <div className="space-y-2">
                  <Label>Select Template</Label>
                  <Select value={templateKey} onValueChange={setTemplateKey}>
                    <SelectTrigger><SelectValue placeholder="Choose a template" /></SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_OPTIONS.map(t => (
                        <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input placeholder="Email subject line" value={subject} onChange={e => setSubject(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Body (HTML)</Label>
                    <Textarea ref={bodyRef} rows={12} className="font-mono text-xs" placeholder="Write your email content here... HTML is supported." value={body} onChange={e => setBody(e.target.value)} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Send</CardTitle>
              <CardDescription>Review and send your email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" onClick={handleSend} disabled={sending}>
                <Send className="h-4 w-4 mr-2" />
                {sending ? 'Sending...' : 'Send Email'}
              </Button>
              {sentCount > 0 && <p className="text-sm text-emerald-600 text-center">{sentCount} email(s) sent!</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Placeholders</CardTitle>
              <CardDescription className="text-xs">Click to insert into body</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {GLOBAL_PLACEHOLDERS.map(g => (
                  <Collapsible key={g.group}>
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground w-full py-1">
                      <ChevronDown className="h-3 w-3" /> {g.group}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="flex flex-wrap gap-1 pl-3 py-1">
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminEmailCompose;
