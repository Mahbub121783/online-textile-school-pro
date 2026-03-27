import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Send, GraduationCap } from 'lucide-react';
import { createNotification, broadcastNotification, notifyAllStudents } from '@/lib/notifications';

const CommunicationsTab = () => {
  const { toast } = useToast();

  // Notification Engine state
  const [recipientTarget, setRecipientTarget] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sendViaEmail, setSendViaEmail] = useState(false);

  // Course Marks Sender state
  const [selectedCourse, setSelectedCourse] = useState('');
  const [studentRoll, setStudentRoll] = useState('');
  const [grade, setGrade] = useState('');

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

    const payload = { type: 'announcement' as const, title: subject, message, link: null };

    if (recipientTarget === 'all-instructors') {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'instructor');
      if (roles?.length) await broadcastNotification({ userIds: roles.map(r => r.user_id), ...payload });
    } else if (recipientTarget === 'all-users') {
      await notifyAllStudents(payload);
    } else {
      await createNotification({ userId: recipientTarget, ...payload });
    }

    toast({
      title: 'Notification Sent',
      description: `In-app notification sent to ${recipientTarget === 'all-instructors' ? 'all instructors' : recipientTarget === 'all-users' ? 'all users' : 'selected instructor'}.`,
    });
    setSubject('');
    setMessage('');
    setRecipientTarget('');
  };

  const handleDispatchMark = () => {
    if (!selectedCourse || !studentRoll || !grade) {
      toast({ title: 'Missing fields', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }
    toast({
      title: 'Mark Dispatched',
      description: `Grade ${grade} sent to ${studentRoll} for the selected course.`,
    });
    setStudentRoll('');
    setGrade('');
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
            <Button onClick={handleSendNotification} className="bg-primary text-primary-foreground">
              <Send className="h-4 w-4 mr-2" /> Send Notification
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
            disabled={!selectedCourse || !studentRoll || !grade}
          >
            <GraduationCap className="h-4 w-4 mr-2" /> Dispatch Official Mark
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CommunicationsTab;
