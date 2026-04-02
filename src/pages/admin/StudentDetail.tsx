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
import { ArrowLeft, BookOpen, Book, Gift, Wallet, MessageSquare, Award, ClipboardList, FileQuestion, ShoppingCart, User, GraduationCap, Briefcase, MapPin } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

function ProfileField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || '—'}</p>
    </div>
  );
}

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

  const { data: walletTxns = [] } = useQuery({
    queryKey: ['student-wallet-txns', id],
    queryFn: async () => {
      if (!wallet?.id) return [];
      const { data } = await supabase.from('wallet_transactions').select('*').eq('wallet_id', wallet.id).order('created_at', { ascending: false }).limit(50);
      return data ?? [];
    },
    enabled: !!wallet?.id,
  });

  const { data: forumStats } = useQuery({
    queryKey: ['student-forum-stats', id],
    queryFn: async () => {
      const { count: posts } = await supabase.from('forum_posts').select('id', { count: 'exact', head: true }).eq('user_id', id!);
      const { count: comments } = await supabase.from('forum_comments').select('id', { count: 'exact', head: true }).eq('user_id', id!);
      const { data: points } = await supabase.from('forum_contributor_points').select('points').eq('user_id', id!);
      const totalPoints = (points ?? []).reduce((s, p) => s + (p.points || 0), 0);
      return { posts: posts || 0, comments: comments || 0, points: totalPoints };
    },
    enabled: !!id,
  });

  const { data: quizStats } = useQuery({
    queryKey: ['student-quiz-stats', id],
    queryFn: async () => {
      const { count } = await supabase.from('quiz_attempts').select('id', { count: 'exact', head: true }).eq('user_id', id!);
      return count || 0;
    },
    enabled: !!id,
  });

  const { data: assignmentStats } = useQuery({
    queryKey: ['student-assignment-stats', id],
    queryFn: async () => {
      const { count } = await supabase.from('assignment_submissions').select('id', { count: 'exact', head: true }).eq('user_id', id!);
      return count || 0;
    },
    enabled: !!id,
  });

  // Fetch ebook names for ebook items
  const { data: ebookNameMap = {} } = useQuery({
    queryKey: ['ebook-name-map', id],
    queryFn: async () => {
      const allEbookIds = orders.flatMap((o: any) => (o.order_items ?? []).filter((i: any) => i.item_type === 'ebook').map((i: any) => i.item_id));
      if (!allEbookIds.length) return {};
      const { data } = await supabase.from('ebooks').select('id, title, cover_url').in('id', allEbookIds);
      const map: Record<string, { title: string; cover_url: string | null }> = {};
      (data ?? []).forEach(e => { map[e.id] = { title: e.title, cover_url: e.cover_url }; });
      return map;
    },
    enabled: orders.length > 0,
  });

  // Fetch reading progress
  const { data: readingProgress = [] } = useQuery({
    queryKey: ['student-reading-progress', id],
    queryFn: async () => {
      const { data } = await supabase.from('ebook_reading_progress').select('*').eq('user_id', id!);
      return data ?? [];
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
  const readingMap: Record<string, any> = {};
  readingProgress.forEach((r: any) => { readingMap[r.ebook_id] = r; });

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
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-heading font-bold">{profile.full_name || 'Unnamed Student'}</h1>
                <Badge variant={profile.is_active !== false ? 'default' : 'destructive'}>
                  {profile.is_active !== false ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                <Badge variant="outline" className="font-mono">{profile.roll_id || 'No Roll ID'}</Badge>
                {profile.username && <Badge variant="secondary">@{profile.username}</Badge>}
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
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mt-6">
            <div className="rounded-lg border p-3 text-center">
              <BookOpen className="h-4 w-4 mx-auto text-primary" />
              <p className="text-lg font-bold mt-1">{enrollments.length}</p>
              <p className="text-[10px] text-muted-foreground">Courses</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Book className="h-4 w-4 mx-auto text-primary" />
              <p className="text-lg font-bold mt-1">{ebookItems.length}</p>
              <p className="text-[10px] text-muted-foreground">Ebooks</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Award className="h-4 w-4 mx-auto text-primary" />
              <p className="text-lg font-bold mt-1">{certificates.length}</p>
              <p className="text-[10px] text-muted-foreground">Certificates</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <FileQuestion className="h-4 w-4 mx-auto text-primary" />
              <p className="text-lg font-bold mt-1">{quizStats || 0}</p>
              <p className="text-[10px] text-muted-foreground">Quizzes</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <ClipboardList className="h-4 w-4 mx-auto text-primary" />
              <p className="text-lg font-bold mt-1">{assignmentStats || 0}</p>
              <p className="text-[10px] text-muted-foreground">Assignments</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <MessageSquare className="h-4 w-4 mx-auto text-primary" />
              <p className="text-lg font-bold mt-1">{forumStats?.posts || 0}</p>
              <p className="text-[10px] text-muted-foreground">Forum Posts</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <GraduationCap className="h-4 w-4 mx-auto text-primary" />
              <p className="text-lg font-bold mt-1">{forumStats?.points || 0}</p>
              <p className="text-[10px] text-muted-foreground">Forum Pts</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Wallet className="h-4 w-4 mx-auto text-primary" />
              <p className="text-lg font-bold mt-1">৳{totalSpend.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Total Spent</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList className="w-full flex flex-wrap h-auto gap-1">
          <TabsTrigger value="profile" className="gap-1"><User className="h-3.5 w-3.5" /> Profile</TabsTrigger>
          <TabsTrigger value="courses" className="gap-1"><BookOpen className="h-3.5 w-3.5" /> Courses</TabsTrigger>
          <TabsTrigger value="ebooks" className="gap-1"><Book className="h-3.5 w-3.5" /> Ebooks</TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1"><ShoppingCart className="h-3.5 w-3.5" /> Expenses</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1"><MessageSquare className="h-3.5 w-3.5" /> Activity</TabsTrigger>
          <TabsTrigger value="wallet" className="gap-1"><Wallet className="h-3.5 w-3.5" /> Wallet</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Personal Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <ProfileField label="Full Name" value={profile.full_name} />
                <ProfileField label="Username" value={profile.username} />
                <ProfileField label="Phone" value={profile.phone} />
                <ProfileField label="Roll ID" value={profile.roll_id} />
                <ProfileField label="Date of Birth" value={profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : null} />
                <ProfileField label="Blood Group" value={profile.blood_group} />
                <ProfileField label="Language" value={profile.language_preference} />
                <ProfileField label="Referral Code" value={profile.referral_code} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Education</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <ProfileField label="University" value={profile.university} />
                <ProfileField label="Batch" value={profile.batch} />
                <ProfileField label="Graduation Year" value={profile.graduation_year?.toString()} />
                <ProfileField label="Department" value={profile.department} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Briefcase className="h-4 w-4" /> Professional</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <ProfileField label="Occupation" value={profile.occupation} />
                <ProfileField label="Company" value={profile.company_name} />
                <ProfileField label="Business Type" value={profile.business_type} />
                <ProfileField label="Professional Role" value={profile.professional_role} />
                <ProfileField label="Current Job" value={profile.current_job_title} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" /> Location</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <ProfileField label="District" value={profile.district} />
                <ProfileField label="Division" value={profile.division} />
                <ProfileField label="Country" value={profile.country} />
                <ProfileField label="Address" value={profile.address} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

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
              <TableHeader>
                <TableRow>
                  <TableHead>Ebook</TableHead>
                  <TableHead className="text-center">Reading Progress</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ebookItems.map((i: any, idx: number) => {
                  const ebook = (ebookNameMap as any)[i.item_id];
                  const progress = readingMap[i.item_id];
                  return (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {ebook?.cover_url && <img src={ebook.cover_url} className="h-10 w-8 object-cover rounded" alt="" />}
                          <span className="font-medium">{ebook?.title || i.item_id.slice(0, 8)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {progress ? (
                          <div className="flex items-center gap-2 justify-center">
                            <Progress value={progress.progress_pct || 0} className="h-2 w-20" />
                            <span className="text-xs">{Math.round(progress.progress_pct || 0)}%</span>
                            <span className="text-xs text-muted-foreground">p.{progress.current_page}/{progress.total_pages || '?'}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not started</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">৳{i.price}</TableCell>
                    </TableRow>
                  );
                })}
                {!ebookItems.length && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No ebooks purchased</TableCell></TableRow>}
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
                  <TableHead className="text-center">Items</TableHead>
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
                    <TableCell className="text-center text-sm">{(o.order_items ?? []).length}</TableCell>
                    <TableCell className="text-right font-medium">৳{o.total}</TableCell>
                    <TableCell><Badge variant={o.status === 'completed' ? 'default' : 'secondary'}>{o.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {!orders.length && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No orders</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card><CardContent className="p-4 text-center"><MessageSquare className="h-5 w-5 mx-auto text-primary" /><p className="text-xl font-bold mt-2">{forumStats?.posts || 0}</p><p className="text-xs text-muted-foreground">Forum Posts</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><ClipboardList className="h-5 w-5 mx-auto text-primary" /><p className="text-xl font-bold mt-2">{forumStats?.comments || 0}</p><p className="text-xs text-muted-foreground">Comments</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><FileQuestion className="h-5 w-5 mx-auto text-primary" /><p className="text-xl font-bold mt-2">{quizStats || 0}</p><p className="text-xs text-muted-foreground">Quiz Attempts</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><ClipboardList className="h-5 w-5 mx-auto text-primary" /><p className="text-xl font-bold mt-2">{assignmentStats || 0}</p><p className="text-xs text-muted-foreground">Submissions</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><Award className="h-5 w-5 mx-auto text-primary" /><p className="text-xl font-bold mt-2">{certificates.length}</p><p className="text-xs text-muted-foreground">Certificates</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><GraduationCap className="h-5 w-5 mx-auto text-primary" /><p className="text-xl font-bold mt-2">{forumStats?.points || 0}</p><p className="text-xs text-muted-foreground">Contributor Pts</p></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="wallet">
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6 flex items-center gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Current Balance</p>
                  <p className="text-3xl font-bold">৳{wallet?.balance?.toLocaleString() || '0'}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Transaction History</CardTitle></CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {walletTxns.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—'}</TableCell>
                      <TableCell><Badge variant={tx.type === 'credit' ? 'default' : 'destructive'}>{tx.type}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tx.description || '—'}</TableCell>
                      <TableCell className={`text-right font-medium ${tx.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'credit' ? '+' : '-'}৳{Math.abs(tx.amount).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!walletTxns.length && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No transactions</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}