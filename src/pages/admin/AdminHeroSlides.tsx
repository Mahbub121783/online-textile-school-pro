import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Image, Copy, GripVertical, Eye, AlignLeft, AlignCenter, AlignRight, Check, ChevronsUpDown, Calendar } from 'lucide-react';
import MediaPickerModal from '@/components/shared/MediaPickerModal';

// Live countdown for admin previews
const useAdminCountdown = (target: string | null | undefined) => {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!target) { setText(''); return; }
    const end = new Date(target).getTime();
    if (isNaN(end)) { setText(''); return; }
    const tick = () => {
      const diff = end - Date.now();
      if (diff <= 0) { setText('Expired'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setText(d > 0 ? `${d}d ${h}h ${m}m ${s}s` : `${h}h ${m}m ${s}s`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [target]);
  return text;
};

// Small badge showing live countdown on slide cards
const SlideCountdownBadge = ({ target }: { target: string }) => {
  const text = useAdminCountdown(target);
  if (!text) return null;
  return (
    <Badge variant="destructive" className="text-[10px] animate-pulse shrink-0">
      ⏰ {text}
    </Badge>
  );
};

const GRADIENT_DIRECTIONS = [
  { value: 'br', label: '↘ Bottom Right' },
  { value: 'r', label: '→ Right' },
  { value: 'b', label: '↓ Bottom' },
  { value: 'bl', label: '↙ Bottom Left' },
  { value: 'tr', label: '↗ Top Right' },
  { value: 't', label: '↑ Top' },
  { value: 'tl', label: '↖ Top Left' },
  { value: 'l', label: '← Left' },
];

const GRADIENT_COLORS = [
  { value: 'primary', label: 'Primary' },
  { value: 'primary-dark', label: 'Primary Dark' },
  { value: 'accent', label: 'Accent' },
  { value: 'accent-hover', label: 'Accent Hover' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'muted', label: 'Muted' },
];

const STATIC_ROUTES = [
  { label: 'Home', value: '/' },
  { label: 'All Courses', value: '/courses' },
  { label: 'All Ebooks', value: '/ebooks' },
  { label: 'Register', value: '/auth/register' },
  { label: 'Login', value: '/auth/login' },
  { label: 'Become Instructor', value: '/become-instructor' },
  { label: 'About', value: '/about' },
  { label: 'Contact', value: '/contact' },
  { label: 'Forum', value: '/forum' },
  { label: 'Blog', value: '/blog' },
  { label: 'Events', value: '/events' },
  { label: 'Departments', value: '/departments' },
  { label: 'Alumni', value: '/alumni' },
  { label: 'Learning Paths', value: '/learning-paths' },
];

const emptySlide = {
  title: '', subtitle: '', image_url: '', cta_text: '', cta_link: '', secondary_cta_text: '', secondary_cta_link: '',
  is_active: true, sort_order: 0, gradient_from: 'primary', gradient_to: 'primary-dark', gradient_direction: 'br',
  overlay_opacity: 5, text_alignment: 'left', title_color: '', subtitle_color: '', countdown_target: '',
};

// --- Searchable Link Picker ---
const LinkPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [open, setOpen] = useState(false);

  const { data: dynamicRoutes } = useQuery({
    queryKey: ['link-picker-routes'],
    queryFn: async () => {
      const [{ data: courses }, { data: pages }] = await Promise.all([
        supabase.from('courses').select('id, title, slug').eq('is_published', true).limit(100),
        supabase.from('pages').select('id, title, slug').eq('status', 'published').limit(100),
      ]);
      const courseRoutes = (courses ?? []).map(c => ({ label: `Course: ${c.title}`, value: `/courses/${c.slug}` }));
      const pageRoutes = (pages ?? []).map(p => ({ label: `Page: ${p.title}`, value: `/${p.slug}` }));
      return [...STATIC_ROUTES, ...courseRoutes, ...pageRoutes];
    },
    staleTime: 60000,
  });

  const allRoutes = dynamicRoutes ?? STATIC_ROUTES;
  const selectedLabel = allRoutes.find(r => r.value === value)?.label || value || 'Select link...';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between text-left font-normal h-9 text-sm">
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search or type URL..." onValueChange={(v) => {
            if (v.startsWith('/') || v.startsWith('http')) onChange(v);
          }} />
          <CommandList>
            <CommandEmpty>
              <p className="text-xs text-muted-foreground p-2">Type a custom URL starting with / or http</p>
            </CommandEmpty>
            <CommandGroup heading="Pages & Routes">
              {allRoutes.map(r => (
                <CommandItem key={r.value} value={r.label} onSelect={() => { onChange(r.value); setOpen(false); }}>
                  <Check className={`mr-2 h-3 w-3 ${value === r.value ? 'opacity-100' : 'opacity-0'}`} />
                  <span className="text-sm">{r.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{r.value}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="border-t p-2">
          <Input placeholder="Or paste external URL..." value={value} onChange={e => onChange(e.target.value)} className="h-8 text-xs" />
        </div>
      </PopoverContent>
    </Popover>
  );
};

// --- Live Preview with countdown ---
const SlidePreview = ({ slide }: { slide: any }) => {
  const dir = slide.gradient_direction || 'br';
  const from = slide.gradient_from || 'primary';
  const to = slide.gradient_to || 'primary-dark';
  const align = slide.text_alignment || 'left';
  const opacity = slide.overlay_opacity ?? 5;
  const countdownText = useAdminCountdown(slide.countdown_target);

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden border bg-muted">
      {slide.image_url && (
        <img src={slide.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className={`absolute inset-0 bg-gradient-to-${dir} from-${from} to-${to} ${slide.image_url ? 'opacity-80' : ''}`} />
      <div className="absolute inset-0" style={{ opacity: opacity / 100, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)' }} />
      <div className={`relative h-full flex items-center p-4 ${align === 'center' ? 'justify-center text-center' : align === 'right' ? 'justify-end text-right' : 'justify-start text-left'}`}>
        <div className="max-w-[70%]">
          {countdownText && countdownText !== 'Expired' && (
            <div className={`mb-1.5 ${align === 'center' ? 'flex justify-center' : align === 'right' ? 'flex justify-end' : ''}`}>
              <span className="inline-flex items-center gap-1 bg-destructive text-destructive-foreground text-[7px] px-1.5 py-0.5 rounded-full animate-pulse font-semibold">
                ⏰ {countdownText}
              </span>
            </div>
          )}
          <p className="font-bold text-sm text-primary-foreground leading-tight" style={{ color: slide.title_color || undefined }}>
            {slide.title || 'Slide Title'}
          </p>
          <p className="text-xs text-primary-foreground/80 mt-1" style={{ color: slide.subtitle_color || undefined }}>
            {slide.subtitle || 'Subtitle text here...'}
          </p>
          <div className="flex gap-1 mt-2 flex-wrap" style={{ justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' }}>
            {slide.cta_text && <span className="bg-accent text-accent-foreground text-[8px] px-2 py-0.5 rounded font-semibold">{slide.cta_text}</span>}
            {slide.secondary_cta_text && <span className="border border-primary-foreground/30 text-primary-foreground text-[8px] px-2 py-0.5 rounded">{slide.secondary_cta_text}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminHeroSlides = () => {
  const [editSlide, setEditSlide] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mediaPicker, setMediaPicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: slides, isLoading } = useQuery({
    queryKey: ['admin-hero-slides'],
    queryFn: async () => {
      const { data } = await supabase.from('hero_slides').select('*').order('sort_order', { ascending: true });
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (slide: any) => {
      const { id, created_at, ...rest } = slide;
      // Clean empty strings to null for optional fields
      if (rest.title_color === '') rest.title_color = null;
      if (rest.subtitle_color === '') rest.subtitle_color = null;
      if (rest.countdown_target === '') rest.countdown_target = null;
      if (id) {
        const { error } = await supabase.from('hero_slides').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('hero_slides').insert(rest);
        if (error) throw error;
      }
      await supabase.from('admin_activity_log').insert({ admin_id: user!.id, action: id ? 'Updated hero slide' : 'Created hero slide', target_type: 'hero_slide', target_id: id || 'new' });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-hero-slides'] }); setDialogOpen(false); setEditSlide(null); toast.success('Slide saved'); },
    onError: () => toast.error('Failed to save slide'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('hero_slides').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-hero-slides'] }); toast.success('Slide deleted'); },
  });

  const bulkMutation = useMutation({
    mutationFn: async (action: 'activate' | 'deactivate' | 'delete') => {
      if (action === 'delete') {
        for (const id of selectedIds) await supabase.from('hero_slides').delete().eq('id', id);
      } else {
        for (const id of selectedIds) await supabase.from('hero_slides').update({ is_active: action === 'activate' }).eq('id', id);
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-hero-slides'] }); setSelectedIds([]); toast.success('Bulk action applied'); },
  });

  const reorderMutation = useMutation({
    mutationFn: async (reordered: any[]) => {
      for (let i = 0; i < reordered.length; i++) {
        await supabase.from('hero_slides').update({ sort_order: i }).eq('id', reordered[i].id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-hero-slides'] }),
  });

  const openCreate = () => { setEditSlide({ ...emptySlide, sort_order: (slides?.length ?? 0) }); setDialogOpen(true); };
  const openEdit = (slide: any) => { setEditSlide({ ...slide, countdown_target: slide.countdown_target || '', title_color: slide.title_color || '', subtitle_color: slide.subtitle_color || '' }); setDialogOpen(true); };
  const duplicate = (slide: any) => {
    const { id, created_at, ...rest } = slide;
    setEditSlide({ ...rest, title: `${rest.title} (Copy)`, sort_order: (slides?.length ?? 0) });
    setDialogOpen(true);
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const allSelected = slides && slides.length > 0 && selectedIds.length === slides.length;

  // Drag and drop
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (targetIdx: number) => {
    if (dragIdx === null || !slides) return;
    const reordered = [...slides];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    setDragIdx(null);
    reorderMutation.mutate(reordered);
  };

  const set = (key: string, val: any) => setEditSlide((s: any) => ({ ...s, [key]: val }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-heading text-2xl font-bold">Hero Slides</h2>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => bulkMutation.mutate('activate')}>Activate ({selectedIds.length})</Button>
              <Button variant="outline" size="sm" onClick={() => bulkMutation.mutate('deactivate')}>Deactivate</Button>
              <Button variant="destructive" size="sm" onClick={() => bulkMutation.mutate('delete')}>Delete</Button>
            </>
          )}
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Add Slide</Button>
        </div>
      </div>

      {/* Select all */}
      {slides && slides.length > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox checked={allSelected} onCheckedChange={() => setSelectedIds(allSelected ? [] : slides.map((s: any) => s.id))} />
          <span className="text-xs text-muted-foreground">Select all</span>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : slides?.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No slides yet. Create one!</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {slides?.map((s: any, idx: number) => (
            <Card key={s.id} draggable onDragStart={() => handleDragStart(idx)} onDragOver={handleDragOver} onDrop={() => handleDrop(idx)}
              className={`transition-all ${dragIdx === idx ? 'opacity-50' : ''} ${selectedIds.includes(s.id) ? 'ring-2 ring-primary' : ''}`}>
              <CardContent className="p-3 flex items-center gap-3">
                <Checkbox checked={selectedIds.includes(s.id)} onCheckedChange={() => toggleSelect(s.id)} />
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                <div className="w-20 h-12 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {s.image_url ? <img src={s.image_url} alt="" className="w-full h-full object-cover" /> : <Image className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{s.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.subtitle}</p>
                </div>
                {s.countdown_target && new Date(s.countdown_target) > new Date() && (
                  <SlideCountdownBadge target={s.countdown_target} />
                )}
                <Badge variant={s.is_active ? 'default' : 'outline'} className="text-xs">{s.is_active ? 'Active' : 'Inactive'}</Badge>
                <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicate(s)}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit / Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditSlide(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editSlide?.id ? 'Edit Slide' : 'New Slide'}</DialogTitle></DialogHeader>
          {editSlide && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Form */}
              <div className="space-y-4">
                <div><Label>Title *</Label><Input value={editSlide.title} onChange={e => set('title', e.target.value)} /></div>
                <div><Label>Subtitle</Label><Input value={editSlide.subtitle ?? ''} onChange={e => set('subtitle', e.target.value)} /></div>

                {/* Hero Banner Image */}
                <div>
                  <Label>Hero Banner Image</Label>
                  <div className="flex gap-2 mt-1">
                    <div className="flex-1 relative">
                      {editSlide.image_url ? (
                        <div className="w-full h-20 rounded border overflow-hidden relative group">
                          <img src={editSlide.image_url} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => set('image_url', '')} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <Button variant="outline" className="w-full h-20" onClick={() => setMediaPicker(true)}>
                          <Image className="h-5 w-5 mr-2" /> Select Banner Image
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Recommended: 1920×800px hero banner</p>
                </div>

                {/* CTA Links */}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>CTA Text</Label><Input value={editSlide.cta_text ?? ''} onChange={e => set('cta_text', e.target.value)} placeholder="e.g. Explore Courses" /></div>
                  <div><Label>CTA Link</Label><LinkPicker value={editSlide.cta_link ?? ''} onChange={v => set('cta_link', v)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Secondary CTA</Label><Input value={editSlide.secondary_cta_text ?? ''} onChange={e => set('secondary_cta_text', e.target.value)} /></div>
                  <div><Label>Secondary Link</Label><LinkPicker value={editSlide.secondary_cta_link ?? ''} onChange={v => set('secondary_cta_link', v)} /></div>
                </div>

                {/* Gradient */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Gradient From</Label>
                    <Select value={editSlide.gradient_from || 'primary'} onValueChange={v => set('gradient_from', v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{GRADIENT_COLORS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Gradient To</Label>
                    <Select value={editSlide.gradient_to || 'primary-dark'} onValueChange={v => set('gradient_to', v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{GRADIENT_COLORS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Direction</Label>
                    <Select value={editSlide.gradient_direction || 'br'} onValueChange={v => set('gradient_direction', v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{GRADIENT_DIRECTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Text Alignment */}
                <div>
                  <Label>Text Alignment</Label>
                  <div className="flex gap-1 mt-1">
                    {[{ v: 'left', icon: AlignLeft }, { v: 'center', icon: AlignCenter }, { v: 'right', icon: AlignRight }].map(({ v, icon: Icon }) => (
                      <Button key={v} variant={editSlide.text_alignment === v ? 'default' : 'outline'} size="sm" onClick={() => set('text_alignment', v)}>
                        <Icon className="h-4 w-4" />
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Overlay Opacity */}
                <div>
                  <Label>Pattern Overlay: {editSlide.overlay_opacity ?? 5}%</Label>
                  <Slider value={[editSlide.overlay_opacity ?? 5]} min={0} max={20} step={1} onValueChange={([v]) => set('overlay_opacity', v)} className="mt-2" />
                </div>

                {/* Custom Colors */}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Title Color (optional)</Label><Input type="color" value={editSlide.title_color || '#ffffff'} onChange={e => set('title_color', e.target.value)} className="h-9" /></div>
                  <div><Label>Subtitle Color (optional)</Label><Input type="color" value={editSlide.subtitle_color || '#ffffff'} onChange={e => set('subtitle_color', e.target.value)} className="h-9" /></div>
                </div>

                {/* Countdown */}
                <div>
                  <Label className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Countdown Target</Label>
                  <Input type="datetime-local" value={editSlide.countdown_target ?? ''} onChange={e => set('countdown_target', e.target.value)} className="h-9" />
                </div>

                {/* Active / Sort */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={editSlide.is_active} onCheckedChange={v => set('is_active', v)} />
                    <Label>Active</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>Order:</Label>
                    <Input type="number" className="w-16 h-8" value={editSlide.sort_order ?? 0} onChange={e => set('sort_order', parseInt(e.target.value) || 0)} />
                  </div>
                </div>

                <Button className="w-full" onClick={() => saveMutation.mutate(editSlide)} disabled={!editSlide.title.trim() || saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : editSlide.id ? 'Update Slide' : 'Create Slide'}
                </Button>
              </div>

              {/* Right: Live Preview */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Eye className="h-4 w-4" /> Live Preview
                </div>
                <SlidePreview slide={editSlide} />
                <p className="text-xs text-muted-foreground">This preview shows how your slide will appear on the homepage hero section.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Media Picker */}
      <MediaPickerModal
        open={mediaPicker}
        onClose={() => setMediaPicker(false)}
        onSelect={(url) => { set('image_url', url); setMediaPicker(false); }}
        accept="image/*"
      />
    </div>
  );
};

export default AdminHeroSlides;
