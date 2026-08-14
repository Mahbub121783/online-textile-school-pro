import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Search, Plus, Pencil, Trash2, Video, FileText, Eye, BookOpen, ClipboardList, X,
  Clock, Lock, Globe, CalendarIcon, Link2, Upload, Monitor, ExternalLink, Download,
  Loader2, CheckCircle2, AlertCircle
} from 'lucide-react';

const DRIVE_URL_REGEX = /^https:\/\/(drive|docs)\.google\.com\/.+/i;
import RichTextEditor from '@/components/instructor/RichTextEditor';
import MediaUploader from '@/components/instructor/MediaUploader';
import LessonPreviewModal from '@/components/admin/LessonPreviewModal';
import { useCmsScope } from '@/components/cms/CmsScopeContext';
import { useAuth } from '@/hooks/useAuth';

interface LessonForm {
  title: string;
  description: string;
  video_url: string;
  video_platform: string;
  lesson_type: string;
  duration_minutes: string;
  is_preview: boolean;
  section_id: string;
  live_class_url: string;
  live_class_platform: string;
  status: string;
  scheduled_unlock_at: string;
  resources: { name: string; url: string; type: string }[];
}

const defaultForm: LessonForm = {
  title: '', description: '', video_url: '', video_platform: 'youtube',
  lesson_type: 'video', duration_minutes: '0', is_preview: false, section_id: '',
  live_class_url: '', live_class_platform: 'zoom', status: 'draft',
  scheduled_unlock_at: '', resources: [],
};

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  locked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const LessonMakerTab = () => {
  const { scope, courseId: lockedCourseId } = useCmsScope();
  const { user } = useAuth();
  const isInstructor = scope === 'instructor';
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState(lockedCourseId || 'all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editDialog, setEditDialog] = useState<{ open: boolean; lesson?: any }>({ open: false });
  const [previewLesson, setPreviewLesson] = useState<any>(null);
  const [materialPicker, setMaterialPicker] = useState<{ open: boolean; lessonId: string; type: 'quiz' | 'assignment' }>({ open: false, lessonId: '', type: 'quiz' });
  const [materialSearch, setMaterialSearch] = useState('');
  const [form, setForm] = useState<LessonForm>(defaultForm);
  const [resourceForm, setResourceForm] = useState({ name: '', url: '', type: 'pdf' });
  const [driveLinkStatus, setDriveLinkStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [driveLinkError, setDriveLinkError] = useState('');
  const qc = useQueryClient();

  const checkDriveLink = async () => {
    if (form.video_platform !== 'drive' || !form.video_url.trim()) return;
    if (!DRIVE_URL_REGEX.test(form.video_url.trim())) {
      setDriveLinkStatus('invalid');
      setDriveLinkError('Not a Google Drive URL');
      return;
    }
    setDriveLinkStatus('checking');
    setDriveLinkError('');
    try {
      const { data, error } = await supabase.functions.invoke('validate-drive-link', { body: { url: form.video_url.trim() } });
      if (error) throw error;
      if (data?.valid) {
        setDriveLinkStatus('valid');
      } else {
        setDriveLinkStatus('invalid');
        setDriveLinkError(data?.error || 'Invalid or inaccessible Drive link');
      }
    } catch (e: any) {
      setDriveLinkStatus('invalid');
      setDriveLinkError(e.message || 'Failed to validate link');
    }
  };

  const { data: courses = [] } = useQuery({
    queryKey: ['admin-all-courses-for-lessons', scope, user?.id],
    queryFn: async () => {
      let q = supabase.from('courses').select('id, title').order('title');
      if (isInstructor && user?.id) q = q.eq('instructor_id', user.id);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['admin-all-sections', courseFilter],
    queryFn: async () => {
      let q = supabase.from('course_sections').select('*, courses!course_sections_course_id_fkey(title)').order('sort_order');
      if (courseFilter !== 'all' && courseFilter !== 'independent') q = q.eq('course_id', courseFilter);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['admin-all-lessons', courseFilter, statusFilter, search],
    queryFn: async () => {
      let q = supabase.from('lessons').select('*, course_sections!lessons_section_id_fkey(title, course_id, courses!course_sections_course_id_fkey(title))').order('created_at', { ascending: false });
      if (courseFilter === 'independent') {
        q = q.is('section_id', null);
      } else if (courseFilter !== 'all') {
        const sectionIds = sections.map((s: any) => s.id);
        if (sectionIds.length === 0) return [];
        q = q.in('section_id', sectionIds);
      }
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      if (search) q = q.ilike('title', `%${search}%`);
      const { data } = await q.limit(5000);
      return data ?? [];
    },
    enabled: courseFilter === 'all' || courseFilter === 'independent' || sections.length > 0,
  });

  const lessonIds = lessons.map((l: any) => l.id);
  const { data: lessonMaterials = [] } = useQuery({
    queryKey: ['lesson-materials', lessonIds],
    enabled: lessonIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('lesson_materials').select('*').in('lesson_id', lessonIds);
      return data ?? [];
    },
  });

  const { data: allQuizzes = [] } = useQuery({
    queryKey: ['all-quizzes-picker'],
    queryFn: async () => {
      const { data } = await supabase.from('quizzes').select('id, title, status, course_id, courses!quizzes_course_id_fkey(title)').order('title');
      return data ?? [];
    },
  });

  const { data: allAssignments = [] } = useQuery({
    queryKey: ['all-assignments-picker'],
    queryFn: async () => {
      const { data } = await supabase.from('assignments').select('id, title, is_published, course_id, courses!assignments_course_id_fkey(title)').order('title');
      return data ?? [];
    },
  });

  const saveLesson = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from('lessons').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('lessons').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-all-lessons'] });
      setEditDialog({ open: false });
      toast.success('Lesson saved');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteLesson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lessons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-all-lessons'] }); toast.success('Lesson deleted'); },
  });

  const linkMaterial = useMutation({
    mutationFn: async ({ lessonId, type, materialId }: { lessonId: string; type: string; materialId: string }) => {
      const { error } = await supabase.from('lesson_materials').insert({ lesson_id: lessonId, material_type: type, material_id: materialId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lesson-materials'] });
      setMaterialPicker({ open: false, lessonId: '', type: 'quiz' });
      toast.success('Material linked');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unlinkMaterial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lesson_materials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lesson-materials'] }); toast.success('Material removed'); },
  });

  const openEdit = (lesson?: any) => {
    if (lesson) {
      setForm({
        title: lesson.title, description: lesson.description || '',
        video_url: lesson.video_url || '', video_platform: lesson.video_platform || 'youtube',
        lesson_type: lesson.lesson_type || 'video', duration_minutes: String(lesson.duration_minutes || 0),
        is_preview: lesson.is_preview ?? false, section_id: lesson.section_id || '',
        live_class_url: lesson.live_class_url || '', live_class_platform: lesson.live_class_platform || 'zoom',
        status: lesson.status || 'draft',
        scheduled_unlock_at: lesson.scheduled_unlock_at || '',
        resources: Array.isArray(lesson.resources) ? lesson.resources : [],
      });
    } else {
      setForm({ ...defaultForm });
    }
    setDriveLinkStatus('idle');
    setDriveLinkError('');
    setEditDialog({ open: true, lesson });
  };

  const handleSave = () => {
    if (!form.title.trim()) return toast.error('Title is required');
    if (form.video_platform === 'drive' && form.video_url.trim() && driveLinkStatus === 'invalid') {
      return toast.error(driveLinkError || 'Fix the Drive link before saving');
    }
    const payload: any = {
      title: form.title,
      description: form.description,
      video_url: form.video_url || null,
      video_platform: form.video_platform,
      lesson_type: form.lesson_type,
      duration_minutes: parseInt(form.duration_minutes) || 0,
      is_preview: form.is_preview,
      section_id: form.section_id || null,
      live_class_url: form.live_class_url || null,
      live_class_platform: form.live_class_platform,
      status: form.status,
      scheduled_unlock_at: form.scheduled_unlock_at || null,
      resources: form.resources,
    };
    if (editDialog.lesson) payload.id = editDialog.lesson.id;
    saveLesson.mutate(payload);
  };

  const addResource = () => {
    if (!resourceForm.name.trim() || !resourceForm.url.trim()) return toast.error('Name and URL required');
    setForm(f => ({ ...f, resources: [...f.resources, { ...resourceForm }] }));
    setResourceForm({ name: '', url: '', type: 'pdf' });
  };

  const removeResource = (idx: number) => {
    setForm(f => ({ ...f, resources: f.resources.filter((_, i) => i !== idx) }));
  };

  const getMaterialsForLesson = (lessonId: string) => lessonMaterials.filter((m: any) => m.lesson_id === lessonId);
  const getQuizTitle = (id: string) => allQuizzes.find((q: any) => q.id === id)?.title || 'Quiz';
  const getAssignmentTitle = (id: string) => allAssignments.find((a: any) => a.id === id)?.title || 'Assignment';

  const filteredPickerItems = materialPicker.type === 'quiz'
    ? allQuizzes.filter((q: any) => !materialSearch || q.title.toLowerCase().includes(materialSearch.toLowerCase()))
    : allAssignments.filter((a: any) => !materialSearch || a.title.toLowerCase().includes(materialSearch.toLowerCase()));

  const alreadyLinked = new Set(
    lessonMaterials
      .filter((m: any) => m.lesson_id === materialPicker.lessonId && m.material_type === materialPicker.type)
      .map((m: any) => m.material_id)
  );

  const typeIcons: Record<string, any> = { video: Video, text: FileText, pdf: FileText, live_class: Monitor };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search lessons..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All Courses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Lessons</SelectItem>
            <SelectItem value="independent">Independent Only</SelectItem>
            {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="locked">Locked</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1 bg-accent hover:bg-accent-hover text-accent-foreground" onClick={() => openEdit()}>
          <Plus className="h-4 w-4" /> New Lesson
        </Button>
      </div>

      {/* Lesson cards grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading lessons...</div>
      ) : lessons.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No lessons found. Create your first lesson!</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {lessons.map((l: any) => {
            const mats = getMaterialsForLesson(l.id);
            const TypeIcon = typeIcons[l.lesson_type] || FileText;
            const courseName = l.course_sections?.courses?.title;
            return (
              <Card key={l.id} className="group hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                        <TypeIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold truncate">{l.title}</h4>
                        <p className="text-xs text-muted-foreground truncate">{courseName || 'Unassigned'}</p>
                      </div>
                    </div>
                    <Badge className={`text-[10px] shrink-0 ${statusColors[l.status || 'draft']}`}>
                      {l.status || 'draft'}
                    </Badge>
                  </div>

                  {/* Meta */}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {l.duration_minutes > 0 && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{l.duration_minutes}m</span>
                    )}
                    {l.is_preview && (
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />Preview</span>
                    )}
                    {l.live_class_url && (
                      <span className="flex items-center gap-1"><Monitor className="h-3 w-3" />Live</span>
                    )}
                    {l.scheduled_unlock_at && (
                      <span className="flex items-center gap-1"><Lock className="h-3 w-3" />Scheduled</span>
                    )}
                    {Array.isArray(l.resources) && l.resources.length > 0 && (
                      <span className="flex items-center gap-1"><Download className="h-3 w-3" />{l.resources.length} files</span>
                    )}
                  </div>

                  {/* Materials */}
                  {mats.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {mats.map((m: any) => (
                        <Badge key={m.id} variant="secondary" className="text-[10px] gap-1 pr-1">
                          {m.material_type === 'quiz' ? <BookOpen className="h-3 w-3" /> : <ClipboardList className="h-3 w-3" />}
                          {m.material_type === 'quiz' ? getQuizTitle(m.material_id) : getAssignmentTitle(m.material_id)}
                          <button onClick={() => unlinkMaterial.mutate(m.id)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 pt-1 border-t">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openEdit(l)}>
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setPreviewLesson(l)}>
                      <Eye className="h-3 w-3" /> Preview
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setMaterialSearch(''); setMaterialPicker({ open: true, lessonId: l.id, type: 'quiz' }); }}>
                      <Plus className="h-3 w-3" /> Add
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto text-destructive" onClick={() => deleteLesson.mutate(l.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Lesson Dialog — Tabbed */}
      <Dialog open={editDialog.open} onOpenChange={o => setEditDialog({ ...editDialog, open: o })}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDialog.lesson ? 'Edit Lesson' : 'New Lesson'}</DialogTitle>
            <DialogDescription>Configure all lesson details across the tabs below.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic" className="text-xs">Basic</TabsTrigger>
              <TabsTrigger value="content" className="text-xs">Content</TabsTrigger>
              <TabsTrigger value="access" className="text-xs">Access</TabsTrigger>
              <TabsTrigger value="resources" className="text-xs">Resources</TabsTrigger>
              <TabsTrigger value="materials" className="text-xs">Materials</TabsTrigger>
            </TabsList>

            {/* Basic Info */}
            <TabsContent value="basic" className="space-y-3 mt-3">
              <div>
                <Label className="text-xs">Title *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <RichTextEditor value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} minHeight="120px" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Lesson Type</Label>
                  <Select value={form.lesson_type} onValueChange={v => setForm(f => ({ ...f, lesson_type: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="live_class">Live Class</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Duration (min)</Label>
                  <Input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} className="h-9" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Section (optional — leave empty for independent)</Label>
                <Select value={form.section_id || '_none'} onValueChange={v => setForm(f => ({ ...f, section_id: v === '_none' ? '' : v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Independent (No Course)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Independent (No Course)</SelectItem>
                    {sections.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.courses?.title ? `${s.courses.title} → ` : ''}{s.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* Content */}
            <TabsContent value="content" className="space-y-3 mt-3">
              <div>
                <Label className="text-xs">Video URL</Label>
                <div className="relative">
                  <Input
                    value={form.video_url}
                    onChange={e => { setForm(f => ({ ...f, video_url: e.target.value })); setDriveLinkStatus('idle'); }}
                    onBlur={checkDriveLink}
                    className={`h-9 ${form.video_platform === 'drive' ? 'pr-8' : ''}`}
                    placeholder={form.video_platform === 'drive' ? 'Paste Google Drive share link (any format)' : 'https://youtube.com/watch?v=...'}
                  />
                  {form.video_platform === 'drive' && driveLinkStatus !== 'idle' && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2">
                      {driveLinkStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      {driveLinkStatus === 'valid' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      {driveLinkStatus === 'invalid' && <AlertCircle className="h-4 w-4 text-destructive" />}
                    </span>
                  )}
                </div>
                {form.video_platform === 'drive' && driveLinkStatus === 'invalid' && (
                  <p className="text-xs text-destructive mt-1">{driveLinkError}</p>
                )}
              </div>
              <div>
                <Label className="text-xs">Video Platform</Label>
                <Select value={form.video_platform} onValueChange={v => setForm(f => ({ ...f, video_platform: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="vimeo">Vimeo</SelectItem>
                    <SelectItem value="drive">Google Drive</SelectItem>
                    <SelectItem value="upload">Custom / Upload</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="border-t pt-3">
                <Label className="text-xs font-semibold">Live Class Settings</Label>
              </div>
              <div>
                <Label className="text-xs">Live Class URL</Label>
                <Input value={form.live_class_url} onChange={e => setForm(f => ({ ...f, live_class_url: e.target.value }))} className="h-9" placeholder="https://meet.google.com/..." />
              </div>
              <div>
                <Label className="text-xs">Platform</Label>
                <Select value={form.live_class_platform} onValueChange={v => setForm(f => ({ ...f, live_class_platform: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zoom">Zoom</SelectItem>
                    <SelectItem value="google_meet">Google Meet</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* Access Control */}
            <TabsContent value="access" className="space-y-3 mt-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="locked">Locked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_preview} onCheckedChange={v => setForm(f => ({ ...f, is_preview: v }))} />
                <Label className="text-xs">Free Preview (students can view without enrollment)</Label>
              </div>
              <div>
                <Label className="text-xs">Scheduled Unlock (Drip Content)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left h-9 text-sm font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.scheduled_unlock_at ? format(new Date(form.scheduled_unlock_at), 'PPP p') : 'No schedule set'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.scheduled_unlock_at ? new Date(form.scheduled_unlock_at) : undefined}
                      onSelect={d => setForm(f => ({ ...f, scheduled_unlock_at: d ? d.toISOString() : '' }))}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {form.scheduled_unlock_at && (
                  <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={() => setForm(f => ({ ...f, scheduled_unlock_at: '' }))}>
                    Clear schedule
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* Resources */}
            <TabsContent value="resources" className="space-y-3 mt-3">
              <p className="text-xs text-muted-foreground">Add multiple downloadable files or external links for students.</p>
              <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input value={resourceForm.name} onChange={e => setResourceForm(f => ({ ...f, name: e.target.value }))} className="h-9" placeholder="Lecture Slides" />
                </div>
                <div>
                  <Label className="text-xs">URL</Label>
                  <Input value={resourceForm.url} onChange={e => setResourceForm(f => ({ ...f, url: e.target.value }))} className="h-9" placeholder="https://..." />
                </div>
                <Select value={resourceForm.type} onValueChange={v => setResourceForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="doc">Doc</SelectItem>
                    <SelectItem value="slides">Slides</SelectItem>
                    <SelectItem value="link">Link</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" className="h-9" onClick={addResource}><Plus className="h-4 w-4" /></Button>
              </div>
              {form.resources.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No resources added yet.</p>
              ) : (
                <div className="space-y-1">
                  {form.resources.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 border rounded-md text-sm">
                      <Download className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate flex-1">{r.name}</span>
                      <Badge variant="outline" className="text-[10px]">{r.type}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeResource(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Materials — Quick attach */}
            <TabsContent value="materials" className="space-y-3 mt-3">
              {!editDialog.lesson ? (
                <p className="text-xs text-muted-foreground text-center py-4">Save the lesson first, then attach quizzes and assignments here.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Linked quizzes and assignments for this lesson:</p>
                  <div className="flex flex-wrap gap-1">
                    {getMaterialsForLesson(editDialog.lesson.id).map((m: any) => (
                      <Badge key={m.id} variant="secondary" className="text-xs gap-1 pr-1">
                        {m.material_type === 'quiz' ? <BookOpen className="h-3 w-3" /> : <ClipboardList className="h-3 w-3" />}
                        {m.material_type === 'quiz' ? getQuizTitle(m.material_id) : getAssignmentTitle(m.material_id)}
                        <button onClick={() => unlinkMaterial.mutate(m.id)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => { setMaterialSearch(''); setMaterialPicker({ open: true, lessonId: editDialog.lesson.id, type: 'quiz' }); }}>
                      <BookOpen className="h-3.5 w-3.5" /> Add Quiz
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => { setMaterialSearch(''); setMaterialPicker({ open: true, lessonId: editDialog.lesson.id, type: 'assignment' }); }}>
                      <ClipboardList className="h-3.5 w-3.5" /> Add Assignment
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          <Button onClick={handleSave} className="w-full bg-accent hover:bg-accent-hover text-accent-foreground mt-2" disabled={saveLesson.isPending}>
            {saveLesson.isPending ? 'Saving...' : 'Save Lesson'}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Material Picker Dialog */}
      <Dialog open={materialPicker.open} onOpenChange={o => setMaterialPicker({ ...materialPicker, open: o })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attach {materialPicker.type === 'quiz' ? 'Quiz' : 'Assignment'}</DialogTitle>
            <DialogDescription>Search and select a {materialPicker.type} to link to this lesson.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button variant={materialPicker.type === 'quiz' ? 'default' : 'outline'} size="sm" onClick={() => setMaterialPicker(p => ({ ...p, type: 'quiz' }))}>Quizzes</Button>
              <Button variant={materialPicker.type === 'assignment' ? 'default' : 'outline'} size="sm" onClick={() => setMaterialPicker(p => ({ ...p, type: 'assignment' }))}>Assignments</Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={`Search ${materialPicker.type}s...`} value={materialSearch} onChange={e => setMaterialSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {filteredPickerItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No {materialPicker.type}s found.</p>
              ) : filteredPickerItems.map((item: any) => {
                const linked = alreadyLinked.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-2 rounded-md border text-sm ${linked ? 'opacity-50 bg-muted' : 'hover:bg-muted cursor-pointer'}`}
                    onClick={() => !linked && linkMaterial.mutate({ lessonId: materialPicker.lessonId, type: materialPicker.type, materialId: item.id })}
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.courses?.title || 'Independent'}</p>
                    </div>
                    {linked ? (
                      <Badge variant="secondary" className="text-[10px] shrink-0">Linked</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] shrink-0">{materialPicker.type === 'quiz' ? (item.status || 'draft') : (item.is_published ? 'Published' : 'Draft')}</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      {previewLesson && (
        <LessonPreviewModal
          lesson={previewLesson}
          materials={getMaterialsForLesson(previewLesson.id)}
          quizzes={allQuizzes}
          assignments={allAssignments}
          onClose={() => setPreviewLesson(null)}
        />
      )}
    </div>
  );
};

export default LessonMakerTab;
