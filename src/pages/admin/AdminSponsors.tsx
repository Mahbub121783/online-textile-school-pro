import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Crown, ExternalLink, MousePointerClick, GripVertical } from 'lucide-react';
import MediaPickerModal from '@/components/shared/MediaPickerModal';

const TIERS = ['platinum', 'gold', 'silver', 'bronze'] as const;
const TIER_COLORS: Record<string, string> = {
  platinum: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  gold: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  silver: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  bronze: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

interface SponsorForm {
  name: string;
  logo_url: string;
  website_url: string;
  tier: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

const emptyForm: SponsorForm = {
  name: '', logo_url: '', website_url: '', tier: 'silver', description: '', is_active: true, sort_order: 0,
};

const AdminSponsors = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SponsorForm>(emptyForm);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: sponsors = [], isLoading } = useQuery({
    queryKey: ['admin-sponsors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sponsors').select('*').order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (f: SponsorForm) => {
      if (!f.name.trim()) throw new Error('Name is required');
      if (!f.logo_url.trim()) throw new Error('Logo is required');
      if (f.website_url && !/^https?:\/\/.+/.test(f.website_url)) throw new Error('Website URL must start with http:// or https://');

      const payload = { ...f, created_by: user?.id };
      if (editId) {
        const { error } = await supabase.from('sponsors').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sponsors').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? 'Sponsor updated' : 'Sponsor created');
      qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
      setDialogOpen(false);
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sponsors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Sponsor deleted');
      qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
      setDeleteId(null);
    },
    onError: () => toast.error('Failed to delete'),
  });

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('sponsors').update({ is_active: !current }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
  };

  const openEdit = (s: any) => {
    setForm({ name: s.name, logo_url: s.logo_url, website_url: s.website_url || '', tier: s.tier, description: s.description || '', is_active: s.is_active, sort_order: s.sort_order });
    setEditId(s.id);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditId(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" /> Sponsors & Partners
          </h1>
          <p className="text-muted-foreground text-sm">Manage sponsors displayed on the homepage</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Add Sponsor</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Logo</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-center">Clicks</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : sponsors.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No sponsors yet</TableCell></TableRow>
            ) : sponsors.map((s: any, i: number) => (
              <TableRow key={s.id}>
                <TableCell><GripVertical className="h-4 w-4 text-muted-foreground" /></TableCell>
                <TableCell>
                  <img src={s.logo_url} alt={s.name} className="h-10 w-auto object-contain max-w-[80px]" />
                </TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>
                  <Badge className={TIER_COLORS[s.tier] || ''}>{s.tier}</Badge>
                </TableCell>
                <TableCell>
                  {s.website_url ? (
                    <a href={s.website_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-sm">
                      <ExternalLink className="h-3 w-3" /> Visit
                    </a>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s.id, s.is_active)} />
                </TableCell>
                <TableCell className="text-center">
                  <span className="flex items-center justify-center gap-1 text-sm">
                    <MousePointerClick className="h-3.5 w-3.5" /> {s.click_count || 0}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Sponsor' : 'Add New Sponsor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Sponsor name" />
            </div>
            <div>
              <Label>Logo *</Label>
              {form.logo_url ? (
                <div className="mt-2 relative inline-block">
                  <img src={form.logo_url} alt="Logo" className="h-20 w-auto object-contain border rounded p-2" />
                  <Button size="sm" variant="destructive" className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full" onClick={() => setForm(f => ({ ...f, logo_url: '' }))}>×</Button>
                </div>
              ) : null}
              <Button variant="outline" className="mt-2 w-full" onClick={() => setMediaOpen(true)}>
                {form.logo_url ? 'Change Logo' : 'Select Logo'}
              </Button>
            </div>
            <div>
              <Label>Website URL</Label>
              <Input value={form.website_url} onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))} placeholder="https://example.com" />
            </div>
            <div>
              <Label>Tier</Label>
              <Select value={form.tier} onValueChange={v => setForm(f => ({ ...f, tier: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIERS.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description" rows={3} />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <Label>Sort Order</Label>
                <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} className="w-24" />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label>Active</Label>
              </div>
            </div>
            <Button className="w-full" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : editId ? 'Update Sponsor' : 'Create Sponsor'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Sponsor?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Media Picker */}
      <MediaPickerModal
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        onSelect={(url) => { setForm(f => ({ ...f, logo_url: url })); setMediaOpen(false); }}
      />
    </div>
  );
};

export default AdminSponsors;
