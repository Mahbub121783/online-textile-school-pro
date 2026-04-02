import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, BookOpen, Book, Gift, Wallet, MessageSquare, Award, ClipboardList, FileQuestion, ShoppingCart } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [grantCourseOpen, setGrantCourseOpen] = useState(false);
  const [grantEbookOpen, setGrantEbookOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedEbook, setSelectedEbook] = useState('');

  const { data: profile } = useQuery({
    queryKey: ['student-profile', id],
    queryFn: async () => {
      const { data } = await supabase.from('user_profiles').select('*').eq('id', id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['student-enrollments', id],
    queryFn: async () => {
      const { data } = await supabase.from('enrollments').select('*, courses(title, thumbnail_url, slug)').eq('user_id', id!);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['student-orders', id],
    queryFn: async () => {
      const { data } = await supabase.from('orders').select('*, order_items(item_id, item_type, price)').eq('user_id', id!).order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: certificates = [] } = useQuery({
    queryKey: ['student-certificates', id],
    queryFn: async () => {
      const { data } = await supabase.from('certificates').select('*, courses(title)').eq('user_id', id!);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: wallet } = useQuery({
    queryKey: ['student-wallet', id],
    queryFn: async () => {
      const { data } = await supabase.from('wallets').select('*').eq('user_id', id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: forumStats } = useQuery({
    queryKey: ['student-forum-stats', id],
    queryFn: async () => {
      const { count: posts } = await supabase.from('forum_posts').select('id', { count: 'exact', head: true }).eq('user_id', id!);
      const { count: comments } = await supabase.from('forum_comments').select('id', { count: 'exact', head: true }).eq('user_id', id!);
      return { posts: posts || 0, comments: comments || 0 };
    },
    enabled: !!id,
  });

  const { data: allCourses = [] } = useQuery({
    queryKey: ['all-courses-for-grant'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').eq('is_published', true);
      return data ?? [];
    },
  });

  const { data: allEbooks = [] } = useQuery({
    queryKey: ['all-ebooks-for-grant'],
    queryFn: async () => {
      const { data } = await supabase.from('ebooks').select('id, title').eq('is_published', true);
      return data ?? [];
    },
  });

  const grantCourse = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase.from('enrollments').insert({ user_id: id!, course_id: courseId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Course access granted');
      qc.invalidateQueries({ queryKey: ['student-enrollments', id] });
      setGrantCourseOpen(false);
      setSelectedCourse('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const grantEbook = useMutation({
    mutationFn: async (ebookId: string) => {
      const { data: order, error: oErr } = await supabase.from('orders').insert({ user_id: id!, total: 0, status: 'completed', payment_method: 'admin_grant' }).select('id').single();
      if (oErr) throw oErr;
      const { error: iErr } = await supabase.from('order_items').insert({ order_id: order.id, item_id: ebookId, item_type: 'ebook', price: 0 });
      if (iErr) throw iErr;
    },
    onSuccess: () => {
      toast.success('Ebook access granted');
      qc.invalidateQueries({ queryKey: ['student-orders', id] });
      setGrantEbookOpen(false);
      setSelectedEbook('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const ebookItems = orders.flatMap((o: any) => (o.order_items ?? []).filter((i: any) => i.item_type === 'ebook'));
  const totalSpend = orders.filter((o: any) => o.status === 'completed').reduce((s: number, o: any) => s + (o.total || 0), 0);

  if (!profile) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/students')} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to Students
      </Button>

      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile.avatar_url} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{profile.full_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-xl font-heading font-bold">{profile.full_name || 'Unnamed Student'}</h1>
              <div className="flex flex-wrap gap-2 mt-1">
                <Badge variant="outline" className="font-mono">{profile.roll_id || 'No Roll ID'}</Badge>
                <Badge variant="secondary">{profile.phone || 'No Phone'}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Joined {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Dialog open={grantCourseOpen} onOpenChange={setGrantCourseOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1"><Gift className="h-4 w-4" /> Grant Course</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Grant Course Access</DialogTitle></DialogHeader>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger>
                    <SelectContent>
                      {allCourses.filter((c: any) => !enrollments.some((e: any) => e.course_id === c.id)).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => selectedCourse && grantCourse.mutate(selectedCourse)} disabled={!selectedCourse || grantCourse.isPending}>
                    {grantCourse.isPending ? 'Granting...' : 'Grant Access'}
                  </Button>
                </DialogContent>
              </Dialog>

              <Dialog open={grantEbookOpen} onOpenChange={setGrantEbookOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1"><Book className="h-4 w-4" /> Grant Ebook</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Grant Ebook Access</DialogTitle></DialogHeader>
                  <Select value={selectedEbook} onValueChange={setSelectedEbook}>
                    <SelectTrigger><SelectValue placeholder="Select an ebook" /></SelectTrigger>
                    <SelectContent>
                      {allEbooks.map((e: any) => (
                        <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => selectedEbook && grantEbook.mutate(selectedEbook)} disabled={!selectedEbook || grantEbook.isPending}>
                    {grantEbook.isPending ? 'Granting...' : 'Grant Access'}
                  </Button>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <div className="rounded-lg border p-3 text-center">
              <BookOpen className="h-5 w-5 mx-auto text-primary" />
              <p className="text-lg font-bold mt-1">{enrollments.length}</p>
              <p className="text-xs text-muted-foreground">Courses</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Book className="h-5 w-5 mx-auto text-primary" />
              <p className="text-lg font-bold mt-1">{ebookItems.length}</p>
              <p className="text-xs text-muted-foreground">Ebooks</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Award className="h-5 w-5 mx-auto text-primary" />
              <p className="text-lg font-bold mt-1">{certificates.length}</p>
              <p className="text-xs text-muted-foreground">Certificates</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Wallet className="h-5 w-5 mx-auto text-primary" />
              <p className="text-lg font-bold mt-1">৳{totalSpend.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Spent</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="courses">
        <TabsList className="w-full flex flex-wrap h-auto">
          <TabsTrigger value="courses" className="gap-1"><BookOpen className="h-3.5 w-3.5" /> Courses</TabsTrigger>
          <TabsTrigger value="ebooks" className="gap-1"><Book className="h-3.5 w-3.5" /> Ebooks</TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1"><ShoppingCart className="h-3.5 w-3.5" /> Expenses</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1"><MessageSquare className="h-3.5 w-3.5" /> Activity</TabsTrigger>
          <TabsTrigger value="wallet" className="gap-1"><Wallet className="h-3.5 w-3.5" /> Wallet</TabsTrigger>
        </TabsList>

        <TabsContent value="courses">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead className="text-center">Progress</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{(e.courses as any)?.title || 'Unknown'}</TableCell>
                    <TableCell><div className="flex items-center gap-2"><Progress value={e.progress_pct || 0} className="h-2 w-20" /><span className="text-xs">{e.progress_pct || 0}%</span></div></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString() : '—'}</TableCell>
                    <TableCell><Badge variant={e.completed_at ? 'default' : 'secondary'}>{e.completed_at ? 'Completed' : 'In Progress'}</Badge></TableCell>
                  </TableRow>
                ))}
                {!enrollments.length && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No enrollments</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="ebooks">
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Ebook ID</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
              <TableBody>
                {ebookItems.map((i: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs">{i.item_id}</TableCell>
                    <TableCell className="text-right">৳{i.price}</TableCell>
                  </TableRow>
                ))}
                {!ebookItems.length && <TableRow><TableCell colSpan={2} className="text-center py-6 text-muted-foreground">No ebooks purchased</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</TableCell>
                    <TableCell className="text-sm">{o.payment_method || '—'}</TableCell>
                    <TableCell className="text-right font-medium">৳{o.total}</TableCell>
                    <TableCell><Badge variant={o.status === 'completed' ? 'default' : 'secondary'}>{o.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {!orders.length && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No orders</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card><CardContent className="p-4 text-center"><MessageSquare className="h-6 w-6 mx-auto text-primary" /><p className="text-2xl font-bold mt-2">{forumStats?.posts || 0}</p><p className="text-xs text-muted-foreground">Forum Posts</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><ClipboardList className="h-6 w-6 mx-auto text-primary" /><p className="text-2xl font-bold mt-2">{forumStats?.comments || 0}</p><p className="text-xs text-muted-foreground">Comments</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><Award className="h-6 w-6 mx-auto text-primary" /><p className="text-2xl font-bold mt-2">{certificates.length}</p><p className="text-xs text-muted-foreground">Certificates</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><BookOpen className="h-6 w-6 mx-auto text-primary" /><p className="text-2xl font-bold mt-2">{enrollments.length}</p><p className="text-xs text-muted-foreground">Enrollments</p></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="wallet">
          <Card>
            <CardHeader><CardTitle>Wallet</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">৳{wallet?.balance?.toLocaleString() || '0'}</p>
              <p className="text-sm text-muted-foreground mt-1">Current Balance</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}