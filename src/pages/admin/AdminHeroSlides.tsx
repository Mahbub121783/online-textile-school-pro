import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Image } from 'lucide-react';

const emptySlide = { title: '', subtitle: '', image_url: '', cta_text: '', cta_link: '', secondary_cta_text: '', secondary_cta_link: '', is_active: true, sort_order: 0 };

const AdminHeroSlides = () => {
  const [editSlide, setEditSlide] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
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
      if (id) {
        const { error } = await supabase.from('hero_slides').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('hero_slides').insert(rest);
        if (error) throw error;
      }
      await supabase.from('admin_activity_log' as any).insert({ admin_id: user!.id, action: id ? 'Updated hero slide' : 'Created hero slide', target_type: 'hero_slide', target_id: id || 'new' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-hero-slides'] });
      setDialogOpen(false);
      setEditSlide(null);
      toast.success('Slide saved');
    },
    onError: () => toast.error('Failed to save slide'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('hero_slides').delete().eq('id', id);
      if (error) throw error;
      await supabase.from('admin_activity_log' as any).insert({ admin_id: user!.id, action: 'Deleted hero slide', target_type: 'hero_slide', target_id: id });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-hero-slides'] }); toast.success('Slide deleted'); },
  });

  const openCreate = () => { setEditSlide({ ...emptySlide }); setDialogOpen(true); };
  const openEdit = (slide: any) => { setEditSlide({ ...slide }); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold">Hero Slides</h2>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Add Slide</Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : slides?.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No slides yet. Create one!</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {slides?.map((s: any) => (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-24 h-14 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {s.image_url ? <img src={s.image_url} alt="" className="w-full h-full object-cover" /> : <Image className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.subtitle}</p>
                </div>
                <Badge variant={s.is_active ? 'default' : 'outline'}>{s.is_active ? 'Active' : 'Inactive'}</Badge>
                <span className="text-xs text-muted-foreground">Order: {s.sort_order}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditSlide(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editSlide?.id ? 'Edit Slide' : 'New Slide'}</DialogTitle></DialogHeader>
          {editSlide && (
            <div className="space-y-4">
              <div><Label>Title</Label><Input value={editSlide.title} onChange={(e) => setEditSlide({ ...editSlide, title: e.target.value })} /></div>
              <div><Label>Subtitle</Label><Input value={editSlide.subtitle ?? ''} onChange={(e) => setEditSlide({ ...editSlide, subtitle: e.target.value })} /></div>
              <div><Label>Image URL</Label><Input value={editSlide.image_url ?? ''} onChange={(e) => setEditSlide({ ...editSlide, image_url: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>CTA Text</Label><Input value={editSlide.cta_text ?? ''} onChange={(e) => setEditSlide({ ...editSlide, cta_text: e.target.value })} /></div>
                <div><Label>CTA Link</Label><Input value={editSlide.cta_link ?? ''} onChange={(e) => setEditSlide({ ...editSlide, cta_link: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Secondary CTA</Label><Input value={editSlide.secondary_cta_text ?? ''} onChange={(e) => setEditSlide({ ...editSlide, secondary_cta_text: e.target.value })} /></div>
                <div><Label>Secondary Link</Label><Input value={editSlide.secondary_cta_link ?? ''} onChange={(e) => setEditSlide({ ...editSlide, secondary_cta_link: e.target.value })} /></div>
              </div>
              <div><Label>Sort Order</Label><Input type="number" value={editSlide.sort_order ?? 0} onChange={(e) => setEditSlide({ ...editSlide, sort_order: parseInt(e.target.value) || 0 })} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={editSlide.is_active} onCheckedChange={(v) => setEditSlide({ ...editSlide, is_active: v })} />
                <Label>Active</Label>
              </div>
              <Button className="w-full" onClick={() => saveMutation.mutate(editSlide)} disabled={!editSlide.title.trim()}>
                {editSlide.id ? 'Update Slide' : 'Create Slide'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminHeroSlides;
