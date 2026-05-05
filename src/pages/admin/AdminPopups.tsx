import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, BarChart3, Pencil, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PopupBuilder } from './popups/PopupBuilder';

interface PopupListItem {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  layout: string;
  start_date: string | null;
  end_date: string | null;
  priority: number;
  created_at: string;
}

export default function AdminPopups() {
  const [popups, setPopups] = useState<PopupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, { views: number; conversions: number }>>({});
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('popups').select('id, name, type, is_active, layout, start_date, end_date, priority, created_at').order('created_at', { ascending: false });
    setPopups(data || []);
    if (data?.length) {
      const ids = data.map(p => p.id);
      const { data: an } = await supabase.from('popup_analytics').select('popup_id, event_type').in('popup_id', ids);
      const map: Record<string, { views: number; conversions: number }> = {};
      an?.forEach(row => {
        if (!map[row.popup_id]) map[row.popup_id] = { views: 0, conversions: 0 };
        if (row.event_type === 'view') map[row.popup_id].views++;
        if (row.event_type === 'submit' || row.event_type === 'click_primary') map[row.popup_id].conversions++;
      });
      setStats(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Invalidate the public popup engine cache so admin changes show up immediately.
  const clearPopupCache = () => { try { delete (window as any).__popupCache; } catch {} };

  const toggleActive = async (id: string, value: boolean) => {
    await supabase.from('popups').update({ is_active: value }).eq('id', id);
    setPopups(p => p.map(x => x.id === id ? { ...x, is_active: value } : x));
    clearPopupCache();
    toast.success(value ? 'Popup activated' : 'Popup deactivated');
  };

  const remove = async (id: string) => {
    await supabase.from('popups').delete().eq('id', id);
    setPopups(p => p.filter(x => x.id !== id));
    clearPopupCache();
    toast.success('Deleted');
  };

  const duplicate = async (id: string) => {
    const { data } = await supabase.from('popups').select('*').eq('id', id).single();
    if (!data) return;
    const { id: _, created_at: __, updated_at: ___, ...rest } = data;
    await supabase.from('popups').insert({ ...rest, name: `${rest.name} (Copy)`, is_active: false });
    clearPopupCache();
    toast.success('Duplicated');
    load();
  };

  const openNew = () => { setEditingId(null); setBuilderOpen(true); };
  const openEdit = (id: string) => { setEditingId(id); setBuilderOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold">Popup Management</h1>
          <p className="text-sm text-muted-foreground">Build dynamic popups with full control over content, design, triggers and targeting.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New Popup</Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Layout</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Conversions</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : popups.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No popups yet. Create your first one.</TableCell></TableRow>
            ) : popups.map(p => {
              const s = stats[p.id] || { views: 0, conversions: 0 };
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell><Badge variant="secondary">{p.type}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.layout}</TableCell>
                  <TableCell>{p.priority}</TableCell>
                  <TableCell>{s.views}</TableCell>
                  <TableCell>{s.conversions}</TableCell>
                  <TableCell><Switch checked={p.is_active} onCheckedChange={v => toggleActive(p.id, v)} /></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button asChild size="icon" variant="ghost"><Link to={`/admin/popups/${p.id}/analytics`}><BarChart3 className="h-4 w-4" /></Link></Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p.id)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => duplicate(p.id)}><Copy className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this popup?</AlertDialogTitle>
                          <AlertDialogDescription>This will also remove all its analytics and submissions. This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(p.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <PopupBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} popupId={editingId} onSaved={() => { setBuilderOpen(false); load(); }} />
    </div>
  );
}
