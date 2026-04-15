import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Send, GraduationCap } from 'lucide-react';
import {
  createNotification,
  createNotificationWithEmail,
  broadcastNotification,
  broadcastNotificationWithEmail,
  notifyAllStudents,
  notifyAllStudentsWithEmail,
} from '@/lib/notifications';

const CommunicationsTab = () => {
  const { toast } = useToast();
  const { user } = useAuth();

  // Notification Engine state
  const [recipientTarget, setRecipientTarget] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sendViaEmail, setSendViaEmail] = useState(false);
  const [sending, setSending] = useState(false);

  // Course Marks Sender state
  const [selectedCourse, setSelectedCourse] = useState('');
  const [studentRoll, setStudentRoll] = useState('');
  const [grade, setGrade] = useState('');
  const [dispatching, setDispatching] = useState(false);

  // Fetch instructors for specific targeting
  const { data: instructors } = useQuery({
    queryKey: ['comms-instructors'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instructor');
      if (!roles?.length) return [];
      const ids = roles.map(r => r.user_id);
      const { data } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', ids)
        .eq('is_active', true);
      return data || [];
    },
  });

  // Fetch courses
  const { data: courses } = useQuery({
    queryKey: ['comms-courses'],
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('id, title')
        .eq('is_published', true)
        .order('title');
      return data || [];
    },
  });

  const handleSendNotification = async () => {
    if (!recipientTarget || !subject || !message) {
      toast({ title: 'Missing fields', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }
    setSending(true);

    try {
      const payload = { type: 'announcement' as const, title: subject, message, link: undefined };

      if (recipientTarget === 'all-instructors') {
        const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'instructor');
        if (roles?.length) {
          const ids = roles.map(r => r.user_id);
          if (sendViaEmail) {
            await broadcastNotificationWithEmail({ userIds: ids, ...payload });
          } else {
            await broadcastNotification({ userIds: ids, ...payload });
          }
        }
      } else if (recipientTarget === 'all-users') {
        if (sendViaEmail) {
          await notifyAllStudentsWithEmail(payload);
        } else {
          await notifyAllStudents(payload);
        }
      } else {
        if (sendViaEmail) {
          await createNotificationWithEmail({ userId: recipientTarget, ...payload });
        } else {
          await createNotification({ userId: recipientTarget, ...payload });
        }
      }

      toast({
        title: 'Notification Sent',
        description: `${sendViaEmail ? 'Email + in-app' : 'In-app'} notification sent to ${recipientTarget === 'all-instructors' ? 'all instructors' : recipientTarget === 'all-users' ? 'all users' : 'selected instructor'}.`,
      });
      setSubject('');
      setMessage('');
      setRecipientTarget('');
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleDispatchMark = async () => {
    if (!selectedCourse || !studentRoll || !grade) {
      toast({ title: 'Missing fields', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }

    setDispatching(true);
    try {
      // Look up student by roll_id or email
      const trimmed = studentRoll.trim();
      let studentQuery = supabase.from('user_profiles').select('id, full_name').limit(1);

      if (trimmed.includes('@')) {
        // Search by email — look up auth user via instructor_applications or institutional_email_requests
        const { data: emailMatch } = await supabase
          .from('instructor_applications')
          .select('user_id')
          .eq('email', trimmed)
          .limit(1);
        if (emailMatch?.length) {
          const { data: prof } = await supabase.from('user_profiles').select('id, full_name').eq('id', emailMatch[0].user_id).single();
          if (!prof) throw new Error('Student profile not found for that email.');
          var student = prof;
        } else {
          throw new Error('No user found with that email address.');
        }
      } else {
        // Search by roll_id
        const { data: rollMatch } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .eq('roll_id', trimmed)
          .limit(1);
        if (!rollMatch?.length) throw new Error(`No student found with Roll ID "${trimmed}".`);
        var student = rollMatch[0];
      }

      // Check enrollment
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('user_id', student.id)
        .eq('course_id', selectedCourse)
        .limit(1);
      if (!enrollment?.length) throw new Error(`Student "${student.full_name || student.id}" is not enrolled in this course.`);

      // Parse grade — could be letter (A+) or numeric (95)
      const numericScore = parseFloat(grade);
      const isNumeric = !isNaN(numericScore);

      // Insert into gradebook_manual_marks
      const { error: insertErr } = await supabase.from('gradebook_manual_marks').insert({
        user_id: student.id,
        course_id: selectedCourse,
        label: 'Official Mark',
        score: isNumeric ? numericScore : null,
        max_score: isNumeric ? 100 : null,
        notes: isNumeric ? `Score: ${grade}` : `Grade: ${grade}`,
        updated_by: user?.id,
      });
      if (insertErr) throw insertErr;

      // Also upsert into student_grades for letter grades
      if (!isNumeric) {
        await supabase.from('student_grades').insert({
          user_id: student.id,
          course_id: selectedCourse,
          letter_grade: grade.toUpperCase(),
          grade_point: 0,
          credits: 0,
          graded_by: user?.id,
          notes: 'Dispatched via admin communications',
        });
      }

      // Send notification to student
      const courseName = courses?.find(c => c.id === selectedCourse)?.title || 'your course';
      await createNotification({
        userId: student.id,
        type: 'result_published',
        title: 'Official Mark Published',
        message: `Your mark for "${courseName}" has been published: ${grade}`,
        link: '/dashboard/grades',
      });

      toast({
        title: 'Mark Dispatched ✓',
        description: `Grade "${grade}" recorded for ${student.full_name || trimmed} and notification sent.`,
      });
      setStudentRoll('');
      setGrade('');
    } catch (err: any) {
      toast({ title: 'Failed to dispatch mark', description: err.message, variant: 'destructive' });
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notification Engine */}
      <Card className="bg-secondary/50 border-none">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" /> Notification Engine
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Recipient Target</Label>
              <Select value={recipientTarget} onValueChange={setRecipientTarget}>
                <SelectTrigger>
                  <SelectValue placeholder="Select recipients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-instructors">All Instructors</SelectItem>
                  <SelectItem value="all-users">All Users</SelectItem>
                  {instructors?.map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.full_name || i.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                placeholder="Notification subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              placeholder="Write your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px]"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Label htmlFor="send-method" className="text-sm">In-App</Label>
              <Switch id="send-method" checked={sendViaEmail} onCheckedChange={setSendViaEmail} />
              <Label htmlFor="send-method" className="text-sm">Email</Label>
            </div>
            <Button onClick={handleSendNotification} className="bg-primary text-primary-foreground" disabled={sending}>
              <Send className="h-4 w-4 mr-2" /> {sending ? 'Sending...' : 'Send Notification'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Course Marks Sender */}
      <Card className="bg-secondary/50 border-none">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" /> Course Marks Sender
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Course</Label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Course" />
                </SelectTrigger>
                <SelectContent>
                  {courses?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Student Roll / Email</Label>
              <Input
                placeholder="e.g., OTS-001234 or email"
                value={studentRoll}
                onChange={(e) => setStudentRoll(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Grade / Mark</Label>
              <Input
                placeholder="e.g., A+ or 95"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              />
            </div>
          </div>
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent-hover"
            onClick={handleDispatchMark}
            disabled={!selectedCourse || !studentRoll || !grade || dispatching}
          >
            <GraduationCap className="h-4 w-4 mr-2" /> {dispatching ? 'Dispatching...' : 'Dispatch Official Mark'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CommunicationsTab;
