import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Users, Calendar, Image, Upload, Search, X, GripVertical, BarChart3, TrendingUp, Clock, CheckCircle, Bell, Send, Video } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import MediaPickerModal from '@/components/shared/MediaPickerModal';

const emptyWs = {
  title: '', slug: '', description: '', short_description: '', thumbnail_url: '',
  workshop_type: 'one_day' as const, start_date: '', end_date: '', start_time: '', end_time: '',
  meet_link: '', max_participants: '' as any, status: 'draft' as const, is_featured: false,
  registration_deadline: '', instructor_id: null as string | null,
  prerequisites: '', what_you_learn: [] as string[], materials: [] as any[],
};

export default function AdminWorkshops() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editWs, setEditWs] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewRegs, setViewRegs] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('workshops');
  const [newLearnItem, setNewLearnItem] = useState('');

  // Notification state
  const [notifyWs, setNotifyWs] = useState<any>(null);
  const [notifyForm, setNotifyForm] = useState({ title: '', message: '' });
  // Media picker state
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<'thumbnail' | 'material'>('thumbnail');

  // Instructor search
  const [instructorSearch, setInstructorSearch] = useState('');
  const [showInstructorDropdown, setShowInstructorDropdown] = useState(false);

  // Curriculum state
  const [lessonForm, setLessonForm] = useState({ title: '', description: '', content: '', lesson_type: 'lecture' });
  const [showLessonForm, setShowLessonForm] = useState(false);

  // Sessions state
  const [sessionForm, setSessionForm] = useState({ title: '', session_date: '', start_time: '', end_time: '', meet_link: '', description: '' });
  const [showSessionForm, setShowSessionForm] = useState(false);

  const { data: workshops = [], isLoading } = useQuery({
    queryKey: ['admin-workshops'],
    queryFn: async () => {
      const { data, error } = await supabase.from('workshops').select('*, instructor:user_profiles!workshops_instructor_id_fkey(id, full_name, avatar_url)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // All registration counts for stats
  const { data: allRegCounts = {} } = useQuery({
    queryKey: ['admin-workshop-all-reg-counts'],
    queryFn: async () => {
      const ids = workshops.map((w: any) => w.id);
      if (!ids.length) return {};
      const { data } = await supabase
        .from('workshop_registrations')
        .select('workshop_id, status')
        .in('workshop_id', ids);
      const counts: Record<string, number> = {};
      let total = 0;
      (data || []).forEach((r: any) => {
        if (r.status === 'registered') {
          counts[r.workshop_id] = (counts[r.workshop_id] || 0) + 1;
          total++;
        }
      });
      counts.__total = total;
      return counts;
    },
    enabled: workshops.length > 0,
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ['admin-workshop-regs', viewRegs],
    queryFn: async () => {
      const { data } = await supabase.from('workshop_registrations').select('*').eq('workshop_id', viewRegs!).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!viewRegs,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['admin-workshop-sessions', editWs?.id],
    queryFn: async () => {
      const { data } = await supabase.from('workshop_sessions').select('*').eq('workshop_id', editWs!.id).order('sort_order');
      return data || [];
    },
    enabled: !!editWs?.id,
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ['admin-workshop-lessons', editWs?.id],
    queryFn: async () => {
      const { data } = await supabase.from('workshop_lessons').select('*').eq('workshop_id', editWs!.id).order('sort_order');
      return data || [];
    },
    enabled: !!editWs?.id,
  });

  // Instructor search query
  const { data: instructorResults = [] } = useQuery({
    queryKey: ['instructor-search', instructorSearch],
    queryFn: async () => {
      // Get users with instructor/admin roles
      const { data: roleUsers } = await supabase.from('user_roles').select('user_id').in('role', ['admin', 'super_admin', 'instructor']);
      if (!roleUsers?.length) return [];
      const ids = roleUsers.map((r: any) => r.user_id);
      const { data } = await supabase.from('user_profiles').select('id, full_name, avatar_url')
        .in('id', ids)
        .ilike('full_name', `%${instructorSearch}%`)
        .limit(10);
      return data || [];
    },
    enabled: instructorSearch.length >= 1,
  });

  // Selected instructor profile
  const { data: selectedInstructor } = useQuery({
    queryKey: ['instructor-profile', editWs?.instructor_id],
    queryFn: async () => {
      const { data } = await supabase.from('user_profiles').select('id, full_name, avatar_url').eq('id', editWs!.instructor_id).single();
      return data;
    },
    enabled: !!editWs?.instructor_id,
  });

  const saveMutation = useMutation({
    mutationFn: async (ws: any) => {
      const payload = {
        ...ws,
        max_participants: ws.max_participants ? Number(ws.max_participants) : null,
        registration_deadline: ws.registration_deadline || null,
        end_date: ws.end_date || null,
        instructor_id: ws.instructor_id || null,
        created_by: user?.id,
      };
      // Remove fields not in DB
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;
      delete payload.instructor;
      delete payload.instructor_name;
      delete payload.instructor_bio;
      delete payload.instructor_avatar;
      if (editWs?.id) {
        const { error } = await supabase.from('workshops').update(payload).eq('id', editWs.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('workshops').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-workshops'] });
      setShowForm(false);
      setEditWs(null);
      toast.success('Workshop saved');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workshops').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-workshops'] });
      toast.success('Workshop deleted');
    },
  });

  const saveSessionMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('workshop_sessions').insert({
        ...sessionForm,
        workshop_id: editWs.id,
        sort_order: sessions.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-workshop-sessions'] });
      setSessionForm({ title: '', session_date: '', start_time: '', end_time: '', meet_link: '', description: '' });
      setShowSessionForm(false);
      toast.success('Session added');
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workshop_sessions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-workshop-sessions'] }),
  });

  const saveLessonMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('workshop_lessons').insert({
        ...lessonForm,
        workshop_id: editWs.id,
        sort_order: lessons.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-workshop-lessons'] });
      setLessonForm({ title: '', description: '', content: '', lesson_type: 'lecture' });
      setShowLessonForm(false);
      toast.success('Lesson added');
    },
  });

  const deleteLessonMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workshop_lessons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-workshop-lessons'] }),
  });

  const openEdit = (ws: any) => { setEditWs(ws); setShowForm(true); setActiveTab('workshops'); };
  const openCreate = () => { setEditWs({ ...emptyWs }); setShowForm(true); setActiveTab('workshops'); };

  const handleMediaSelect = (url: string) => {
    if (mediaPickerTarget === 'thumbnail') {
      setEditWs({ ...editWs, thumbnail_url: url });
    } else {
      // Add as material
      const name = url.split('/').pop() || 'file';
      const ext = name.split('.').pop()?.toLowerCase() || 'file';
      setEditWs({
        ...editWs,
        materials: [...(editWs.materials || []), { name, url, type: ext }],
      });
    }
    setMediaPickerOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Workshops</h1>
          <p className="text-sm text-muted-foreground">Manage workshops, registrations, sessions & curriculum</p>
        </div>
        <Button onClick={openCreate} className="gap-1"><Plus className="h-4 w-4" />Create Workshop</Button>
      </div>

      {/* Stats Overview */}
      {!isLoading && workshops.length > 0 && (() => {
        const ongoing = workshops.filter((w: any) => w.status === 'ongoing').length;
        const upcoming = workshops.filter((w: any) => w.status === 'published').length;
        const completed = workshops.filter((w: any) => w.status === 'completed').length;
        const totalRegs = (allRegCounts as any).__total || 0;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><BarChart3 className="h-5 w-5 text-primary" /></div>
              <div><p className="text-2xl font-bold">{workshops.length}</p><p className="text-xs text-muted-foreground">Total Workshops</p></div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-green-600" /></div>
              <div><p className="text-2xl font-bold">{ongoing + upcoming}</p><p className="text-xs text-muted-foreground">Active ({ongoing} live)</p></div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><Users className="h-5 w-5 text-blue-600" /></div>
              <div><p className="text-2xl font-bold">{totalRegs}</p><p className="text-xs text-muted-foreground">Total Registrations</p></div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-amber-600" /></div>
              <div><p className="text-2xl font-bold">{completed}</p><p className="text-xs text-muted-foreground">Completed</p></div>
            </CardContent></Card>
          </div>
        );
      })()}

      {isLoading ? (
        <div className="animate-pulse h-32 bg-muted rounded-lg" />
      ) : (
        <div className="grid gap-4">
          {workshops.map((ws: any) => {
            const regCount = (allRegCounts as any)[ws.id] || 0;
            return (
            <Card key={ws.id}>
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                {ws.thumbnail_url && <img src={ws.thumbnail_url} className="w-24 h-16 rounded object-cover" />}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{ws.title}</h3>
                    <Badge>{ws.status}</Badge>
                    <Badge variant="outline">{ws.workshop_type === 'multi_day' ? 'Multi-Day' : 'One Day'}</Badge>
                    {regCount > 0 && <Badge variant="secondary" className="text-[10px]">{regCount} registrations</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(ws.start_date), 'MMM dd, yyyy')} · /{ws.slug}
                    {ws.instructor?.full_name && ` · by ${ws.instructor.full_name}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setViewRegs(ws.id)}><Users className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(ws)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => {
                    if (confirm('Delete this workshop?')) deleteMutation.mutate(ws.id);
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
            );
          })}
          {workshops.length === 0 && <p className="text-center text-muted-foreground py-8">No workshops yet.</p>}
        </div>
      )}

      {/* Workshop Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditWs(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle>{editWs?.id ? 'Edit' : 'Create'} Workshop</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[75vh] pr-4">
            {editWs && (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="workshops">Details</TabsTrigger>
                  {editWs.id && <TabsTrigger value="sessions">Sessions</TabsTrigger>}
                  {editWs.id && <TabsTrigger value="curriculum">Curriculum</TabsTrigger>}
                </TabsList>
                <TabsContent value="workshops" className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><Label>Title *</Label><Input value={editWs.title} onChange={(e) => setEditWs({ ...editWs, title: e.target.value })} /></div>
                    <div><Label>Slug *</Label><Input value={editWs.slug} onChange={(e) => setEditWs({ ...editWs, slug: e.target.value })} placeholder="my-workshop" /></div>
                    <div><Label>Type</Label>
                      <Select value={editWs.workshop_type} onValueChange={(v) => setEditWs({ ...editWs, workshop_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="one_day">One Day</SelectItem>
                          <SelectItem value="multi_day">Multi-Day</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Status</Label>
                      <Select value={editWs.status} onValueChange={(v) => setEditWs({ ...editWs, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['draft', 'published', 'ongoing', 'completed', 'cancelled'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Start Date *</Label><Input type="date" value={editWs.start_date} onChange={(e) => setEditWs({ ...editWs, start_date: e.target.value })} /></div>
                    <div><Label>End Date</Label><Input type="date" value={editWs.end_date || ''} onChange={(e) => setEditWs({ ...editWs, end_date: e.target.value })} /></div>
                    <div><Label>Start Time</Label><Input type="time" value={editWs.start_time || ''} onChange={(e) => setEditWs({ ...editWs, start_time: e.target.value })} /></div>
                    <div><Label>End Time</Label><Input type="time" value={editWs.end_time || ''} onChange={(e) => setEditWs({ ...editWs, end_time: e.target.value })} /></div>
                    <div className="col-span-2"><Label>Short Description</Label><Input value={editWs.short_description || ''} onChange={(e) => setEditWs({ ...editWs, short_description: e.target.value })} /></div>
                    <div className="col-span-2"><Label>Description</Label><Textarea rows={4} value={editWs.description || ''} onChange={(e) => setEditWs({ ...editWs, description: e.target.value })} /></div>
                    <div><Label>Google Meet Link</Label><Input value={editWs.meet_link || ''} onChange={(e) => setEditWs({ ...editWs, meet_link: e.target.value })} /></div>
                    <div><Label>Max Participants</Label><Input type="number" value={editWs.max_participants || ''} onChange={(e) => setEditWs({ ...editWs, max_participants: e.target.value })} placeholder="Unlimited" /></div>
                    <div><Label>Registration Deadline</Label><Input type="datetime-local" value={editWs.registration_deadline || ''} onChange={(e) => setEditWs({ ...editWs, registration_deadline: e.target.value })} /></div>

                    {/* Thumbnail via MediaPicker */}
                    <div className="col-span-2">
                      <Label>Featured Image</Label>
                      <div className="mt-1">
                        {editWs.thumbnail_url ? (
                          <div className="relative inline-block">
                            <img src={editWs.thumbnail_url} className="h-24 rounded-lg object-cover" />
                            <Button variant="destructive" size="sm" className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                              onClick={() => setEditWs({ ...editWs, thumbnail_url: '' })}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" className="gap-1" onClick={() => { setMediaPickerTarget('thumbnail'); setMediaPickerOpen(true); }}>
                            <Image className="h-4 w-4" />Select Image
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 col-span-2">
                      <Switch checked={editWs.is_featured} onCheckedChange={(v) => setEditWs({ ...editWs, is_featured: v })} />
                      <Label>Featured</Label>
                    </div>
                  </div>

                  {/* Instructor Search */}
                  <div className="border-t pt-3">
                    <Label className="text-sm font-semibold">Instructor</Label>
                    {editWs.instructor_id && selectedInstructor ? (
                      <div className="flex items-center gap-3 mt-2 p-2 border rounded-lg">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={selectedInstructor.avatar_url || ''} />
                          <AvatarFallback>{selectedInstructor.full_name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{selectedInstructor.full_name}</p>
                          <p className="text-xs text-muted-foreground">Instructor</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setEditWs({ ...editWs, instructor_id: null })}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="relative mt-2">
                        <div className="flex items-center gap-1">
                          <Search className="h-4 w-4 text-muted-foreground" />
                          <Input
                            value={instructorSearch}
                            onChange={(e) => { setInstructorSearch(e.target.value); setShowInstructorDropdown(true); }}
                            onFocus={() => setShowInstructorDropdown(true)}
                            placeholder="Search instructor by name..."
                            className="text-sm"
                          />
                        </div>
                        {showInstructorDropdown && instructorResults.length > 0 && (
                          <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-48 overflow-auto">
                            {instructorResults.map((inst: any) => (
                              <button
                                key={inst.id}
                                className="w-full flex items-center gap-2 p-2 hover:bg-muted text-left text-sm"
                                onClick={() => {
                                  setEditWs({ ...editWs, instructor_id: inst.id });
                                  setInstructorSearch('');
                                  setShowInstructorDropdown(false);
                                }}
                              >
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={inst.avatar_url || ''} />
                                  <AvatarFallback>{inst.full_name?.[0] || '?'}</AvatarFallback>
                                </Avatar>
                                <span>{inst.full_name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-3"><Label>Prerequisites</Label><Textarea rows={2} value={editWs.prerequisites || ''} onChange={(e) => setEditWs({ ...editWs, prerequisites: e.target.value })} /></div>

                  {/* What you'll learn */}
                  <div className="border-t pt-3">
                    <Label className="text-sm font-semibold">What You'll Learn</Label>
                    <div className="space-y-1 mt-2">
                      {(editWs.what_you_learn || []).map((item: string, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-sm flex-1">{item}</span>
                          <Button variant="ghost" size="sm" onClick={() => {
                            const arr = [...editWs.what_you_learn];
                            arr.splice(i, 1);
                            setEditWs({ ...editWs, what_you_learn: arr });
                          }}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Input value={newLearnItem} onChange={(e) => setNewLearnItem(e.target.value)} placeholder="Add item" className="text-sm" />
                        <Button size="sm" onClick={() => {
                          if (newLearnItem.trim()) {
                            setEditWs({ ...editWs, what_you_learn: [...(editWs.what_you_learn || []), newLearnItem.trim()] });
                            setNewLearnItem('');
                          }
                        }}>Add</Button>
                      </div>
                    </div>
                  </div>

                  {/* Materials via MediaPicker */}
                  <div className="border-t pt-3">
                    <Label className="text-sm font-semibold">Materials</Label>
                    <div className="space-y-1 mt-2">
                      {(editWs.materials || []).map((m: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm p-2 border rounded">
                          <span className="flex-1 truncate">{m.name}</span>
                          <Badge variant="outline" className="text-[10px]">{m.type}</Badge>
                          <Button variant="ghost" size="sm" onClick={() => {
                            const arr = [...editWs.materials];
                            arr.splice(i, 1);
                            setEditWs({ ...editWs, materials: arr });
                          }}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => { setMediaPickerTarget('material'); setMediaPickerOpen(true); }}>
                        <Upload className="h-4 w-4" />Upload / Select Material
                      </Button>
                    </div>
                  </div>

                  <Button className="w-full" onClick={() => saveMutation.mutate(editWs)} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Saving...' : 'Save Workshop'}
                  </Button>
                </TabsContent>

                {/* Sessions Tab */}
                {editWs.id && (
                  <TabsContent value="sessions" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-semibold">Sessions ({sessions.length})</Label>
                      <Button size="sm" onClick={() => setShowSessionForm(!showSessionForm)}><Plus className="h-3 w-3 mr-1" />Add Session</Button>
                    </div>
                    {showSessionForm && (
                      <div className="p-3 border rounded-lg space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div><Label>Title</Label><Input value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })} /></div>
                          <div><Label>Date</Label><Input type="date" value={sessionForm.session_date} onChange={(e) => setSessionForm({ ...sessionForm, session_date: e.target.value })} /></div>
                          <div><Label>Start</Label><Input type="time" value={sessionForm.start_time} onChange={(e) => setSessionForm({ ...sessionForm, start_time: e.target.value })} /></div>
                          <div><Label>End</Label><Input type="time" value={sessionForm.end_time} onChange={(e) => setSessionForm({ ...sessionForm, end_time: e.target.value })} /></div>
                          <div><Label>Meet Link</Label><Input value={sessionForm.meet_link} onChange={(e) => setSessionForm({ ...sessionForm, meet_link: e.target.value })} /></div>
                          <div><Label>Description</Label><Input value={sessionForm.description} onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })} /></div>
                        </div>
                        <Button size="sm" onClick={() => saveSessionMutation.mutate()} disabled={saveSessionMutation.isPending}>Save Session</Button>
                      </div>
                    )}
                    {sessions.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{s.title}</p>
                          <p className="text-xs text-muted-foreground">{s.session_date} · {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteSessionMutation.mutate(s.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </TabsContent>
                )}

                {/* Curriculum Tab */}
                {editWs.id && (
                  <TabsContent value="curriculum" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-semibold">Lessons ({lessons.length})</Label>
                      <Button size="sm" onClick={() => setShowLessonForm(!showLessonForm)}><Plus className="h-3 w-3 mr-1" />Add Lesson</Button>
                    </div>
                    {showLessonForm && (
                      <div className="p-3 border rounded-lg space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2"><Label>Title</Label><Input value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} /></div>
                          <div><Label>Type</Label>
                            <Select value={lessonForm.lesson_type} onValueChange={(v) => setLessonForm({ ...lessonForm, lesson_type: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="lecture">Lecture</SelectItem>
                                <SelectItem value="practical">Practical</SelectItem>
                                <SelectItem value="demo">Demo</SelectItem>
                                <SelectItem value="discussion">Discussion</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2"><Label>Description</Label><Input value={lessonForm.description || ''} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} /></div>
                          <div className="col-span-2"><Label>Content</Label><Textarea rows={3} value={lessonForm.content || ''} onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })} /></div>
                        </div>
                        <Button size="sm" onClick={() => saveLessonMutation.mutate()} disabled={saveLessonMutation.isPending}>Save Lesson</Button>
                      </div>
                    )}
                    {lessons.map((l: any, idx: number) => (
                      <div key={l.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground w-6">{idx + 1}.</span>
                          <div>
                            <p className="font-medium text-sm">{l.title}</p>
                            <div className="flex gap-2 mt-0.5">
                              <Badge variant="outline" className="text-[10px]">{l.lesson_type}</Badge>
                              {l.description && <p className="text-xs text-muted-foreground line-clamp-1">{l.description}</p>}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteLessonMutation.mutate(l.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </TabsContent>
                )}
              </Tabs>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Registrations Viewer */}
      <Dialog open={!!viewRegs} onOpenChange={(open) => { if (!open) setViewRegs(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle>Registrations ({registrations.length})</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[75vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reg #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.registration_number}</TableCell>
                    <TableCell>{r.full_name}</TableCell>
                    <TableCell className="text-xs">{r.email}</TableCell>
                    <TableCell className="text-xs">{r.mobile || '-'}</TableCell>
                    <TableCell className="text-xs">{r.institution || '-'}</TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    <TableCell className="text-xs">{format(new Date(r.created_at), 'MMM dd')}</TableCell>
                  </TableRow>
                ))}
                {registrations.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No registrations yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Media Picker */}
      <MediaPickerModal
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
      />
    </div>
  );
}
