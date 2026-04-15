import { useState } from 'react';
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
import { Plus, Edit, Trash2, Users, Eye, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

const emptyWs = {
  title: '', slug: '', description: '', short_description: '', thumbnail_url: '',
  workshop_type: 'one_day' as const, start_date: '', end_date: '', start_time: '', end_time: '',
  meet_link: '', max_participants: '' as any, status: 'draft' as const, is_featured: false,
  registration_deadline: '', instructor_name: '', instructor_bio: '', instructor_avatar: '',
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
  const [newMaterial, setNewMaterial] = useState({ name: '', url: '', type: 'pdf' });

  // Sessions state
  const [sessionForm, setSessionForm] = useState({ title: '', session_date: '', start_time: '', end_time: '', meet_link: '', description: '' });
  const [showSessionForm, setShowSessionForm] = useState(false);

  const { data: workshops = [], isLoading } = useQuery({
    queryKey: ['admin-workshops'],
    queryFn: async () => {
      const { data, error } = await supabase.from('workshops').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
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

  const saveMutation = useMutation({
    mutationFn: async (ws: any) => {
      const payload = {
        ...ws,
        max_participants: ws.max_participants ? Number(ws.max_participants) : null,
        registration_deadline: ws.registration_deadline || null,
        end_date: ws.end_date || null,
        created_by: user?.id,
      };
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;
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

  const openEdit = (ws: any) => { setEditWs(ws); setShowForm(true); };
  const openCreate = () => { setEditWs({ ...emptyWs }); setShowForm(true); };

  const getRegCount = (wsId: string) => {
    // We don't preload all counts, so this is shown via the view button
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Workshops</h1>
          <p className="text-sm text-muted-foreground">Manage workshops, registrations, sessions & quizzes</p>
        </div>
        <Button onClick={openCreate} className="gap-1"><Plus className="h-4 w-4" />Create Workshop</Button>
      </div>

      {isLoading ? (
        <div className="animate-pulse h-32 bg-muted rounded-lg" />
      ) : (
        <div className="grid gap-4">
          {workshops.map((ws: any) => (
            <Card key={ws.id}>
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                {ws.thumbnail_url && <img src={ws.thumbnail_url} className="w-24 h-16 rounded object-cover" />}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{ws.title}</h3>
                    <Badge>{ws.status}</Badge>
                    <Badge variant="outline">{ws.workshop_type === 'multi_day' ? 'Multi-Day' : 'One Day'}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(ws.start_date), 'MMM dd, yyyy')} · /{ws.slug}
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
          ))}
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
                    <div><Label>Thumbnail URL</Label><Input value={editWs.thumbnail_url || ''} onChange={(e) => setEditWs({ ...editWs, thumbnail_url: e.target.value })} /></div>
                    <div className="flex items-center gap-2 col-span-2">
                      <Switch checked={editWs.is_featured} onCheckedChange={(v) => setEditWs({ ...editWs, is_featured: v })} />
                      <Label>Featured</Label>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <Label className="text-sm font-semibold">Instructor</Label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div><Label>Name</Label><Input value={editWs.instructor_name || ''} onChange={(e) => setEditWs({ ...editWs, instructor_name: e.target.value })} /></div>
                      <div><Label>Avatar URL</Label><Input value={editWs.instructor_avatar || ''} onChange={(e) => setEditWs({ ...editWs, instructor_avatar: e.target.value })} /></div>
                      <div className="col-span-2"><Label>Bio</Label><Textarea rows={2} value={editWs.instructor_bio || ''} onChange={(e) => setEditWs({ ...editWs, instructor_bio: e.target.value })} /></div>
                    </div>
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
                  {/* Materials */}
                  <div className="border-t pt-3">
                    <Label className="text-sm font-semibold">Materials</Label>
                    <div className="space-y-1 mt-2">
                      {(editWs.materials || []).map((m: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="flex-1">{m.name} ({m.type})</span>
                          <Button variant="ghost" size="sm" onClick={() => {
                            const arr = [...editWs.materials];
                            arr.splice(i, 1);
                            setEditWs({ ...editWs, materials: arr });
                          }}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      ))}
                      <div className="grid grid-cols-3 gap-2">
                        <Input value={newMaterial.name} onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })} placeholder="Name" className="text-sm" />
                        <Input value={newMaterial.url} onChange={(e) => setNewMaterial({ ...newMaterial, url: e.target.value })} placeholder="URL" className="text-sm" />
                        <div className="flex gap-1">
                          <Input value={newMaterial.type} onChange={(e) => setNewMaterial({ ...newMaterial, type: e.target.value })} placeholder="Type" className="text-sm" />
                          <Button size="sm" onClick={() => {
                            if (newMaterial.name && newMaterial.url) {
                              setEditWs({ ...editWs, materials: [...(editWs.materials || []), { ...newMaterial }] });
                              setNewMaterial({ name: '', url: '', type: 'pdf' });
                            }
                          }}>+</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => saveMutation.mutate(editWs)} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Saving...' : 'Save Workshop'}
                  </Button>
                </TabsContent>
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
    </div>
  );
}
