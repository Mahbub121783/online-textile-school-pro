import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { sendCustomEmail, sendTemplateEmail } from '@/lib/emailSender';
import { Send, Users, User, BookOpen, PenLine } from 'lucide-react';

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

  const { data: courses } = useQuery({
    queryKey: ['courses-for-email'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').order('title');
      return data || [];
    },
  });

  const handleSend = async () => {
    setSending(true);
    setSentCount(0);
    try {
      let emails: string[] = [];

      if (audience === 'individual') {
        if (!recipientEmail) { toast({ title: 'Enter recipient email', variant: 'destructive' }); setSending(false); return; }
        emails = recipientEmail.split(',').map(e => e.trim()).filter(Boolean);
      } else if (audience === 'all_students') {
        const { data: profiles } = await supabase.from('user_profiles').select('id');
        if (profiles) {
          const userIds = profiles.map(p => p.id);
          // We need emails from auth - fetch from user_profiles that have email-like data
          // For now, we use a workaround: fetch users who have roles
          const { data: roleUsers } = await supabase.from('user_roles').select('user_id').eq('role', 'student');
          if (roleUsers) {
            const studentIds = roleUsers.map(r => r.user_id);
            const { data: studentProfiles } = await supabase.from('user_profiles').select('id, full_name');
            // We can't get emails from profiles directly, inform admin
            toast({ title: 'Bulk email requires user emails. Please enter emails manually or use individual mode.', variant: 'destructive' });
            setSending(false);
            return;
          }
        }
      } else if (audience === 'course_students') {
        if (!selectedCourse) { toast({ title: 'Select a course', variant: 'destructive' }); setSending(false); return; }
        toast({ title: 'Course-based bulk email requires user emails. Please enter emails manually.', variant: 'destructive' });
        setSending(false);
        return;
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
              <div className="flex gap-2">
                <Button size="sm" variant={audience === 'individual' ? 'default' : 'outline'} onClick={() => setAudience('individual')}><User className="h-3 w-3 mr-1" />Individual</Button>
                <Button size="sm" variant={audience === 'all_students' ? 'default' : 'outline'} onClick={() => setAudience('all_students')}><Users className="h-3 w-3 mr-1" />All Students</Button>
                <Button size="sm" variant={audience === 'course_students' ? 'default' : 'outline'} onClick={() => setAudience('course_students')}><BookOpen className="h-3 w-3 mr-1" />Course Students</Button>
              </div>

              {audience === 'individual' && (
                <div className="space-y-2">
                  <Label>Email Address(es)</Label>
                  <Input placeholder="email@example.com (comma-separated for multiple)" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Separate multiple emails with commas</p>
                </div>
              )}

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
                      <SelectItem value="order_confirmation">Order Confirmation</SelectItem>
                      <SelectItem value="welcome_email">Welcome Email</SelectItem>
                      <SelectItem value="enrollment_confirmation">Enrollment Confirmation</SelectItem>
                      <SelectItem value="certificate_issued">Certificate Issued</SelectItem>
                      <SelectItem value="instructor_approved">Instructor Approved</SelectItem>
                      <SelectItem value="student_approved">Student Approved</SelectItem>
                      <SelectItem value="push_notification">Push Notification</SelectItem>
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
                    <Textarea rows={12} className="font-mono text-xs" placeholder="Write your email content here... HTML is supported." value={body} onChange={e => setBody(e.target.value)} />
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
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {['{{user_name}}', '{{site_name}}', '{{course_name}}', '{{order_id}}'].map(p => (
                  <Badge key={p} variant="outline" className="text-xs cursor-pointer" onClick={() => setBody(b => b + ' ' + p)}>
                    {p}
                  </Badge>
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
