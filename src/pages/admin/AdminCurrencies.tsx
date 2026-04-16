import { FormSkeleton } from '@/components/ui/loading-skeletons';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, DollarSign } from 'lucide-react';

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchange_rate: number;
  is_default: boolean;
  is_active: boolean;
}

const AdminCurrencies = () => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Currency | null>(null);
  const [form, setForm] = useState({ code: '', name: '', symbol: '', exchange_rate: '1', is_default: false, is_active: true });

  useEffect(() => { fetchCurrencies(); }, []);

  const fetchCurrencies = async () => {
    setLoading(true);
    const { data } = await supabase.from('currencies').select('*').order('is_default', { ascending: false });
    if (data) setCurrencies(data as any);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', symbol: '', exchange_rate: '1', is_default: false, is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (c: Currency) => {
    setEditing(c);
    setForm({ code: c.code, name: c.name, symbol: c.symbol, exchange_rate: String(c.exchange_rate), is_default: c.is_default, is_active: c.is_active });
    setDialogOpen(true);
  };

  const save = async () => {
    const data = {
      code: form.code.toUpperCase(),
      name: form.name,
      symbol: form.symbol,
      exchange_rate: parseFloat(form.exchange_rate) || 1,
      is_default: form.is_default,
      is_active: form.is_active,
    };
    if (!data.code || !data.name) { toast.error('Code and name required'); return; }

    // If setting as default, unset others
    if (data.is_default) {
      await supabase.from('currencies').update({ is_default: false }).neq('id', editing?.id || '');
    }

    if (editing) {
      const { error } = await supabase.from('currencies').update(data).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Currency updated');
    } else {
      const { error } = await supabase.from('currencies').insert(data);
      if (error) { toast.error(error.message); return; }
      toast.success('Currency added');
    }
    setDialogOpen(false);
    fetchCurrencies();
  };

  const deleteCurrency = async (c: Currency) => {
    if (c.is_default) { toast.error('Cannot delete default currency'); return; }
    if (!confirm('Delete this currency?')) return;
    await supabase.from('currencies').delete().eq('id', c.id);
    toast.success('Currency deleted');
    fetchCurrencies();
  };

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold">Currency Management</h2>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Currencies</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Add Currency</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Currency</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Code (e.g. USD)</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} maxLength={5} /></div>
                  <div><Label>Symbol</Label><Input value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} maxLength={5} /></div>
                </div>
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label>Exchange Rate (relative to base)</Label><Input type="number" step="0.01" value={form.exchange_rate} onChange={e => setForm(f => ({ ...f, exchange_rate: e.target.value }))} /></div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2"><Switch checked={form.is_default} onCheckedChange={v => setForm(f => ({ ...f, is_default: v }))} /><Label>Default</Label></div>
                  <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label>Active</Label></div>
                </div>
                <Button onClick={save} className="w-full">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? <FormSkeleton fields={4} /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Exchange Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currencies.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-bold">{c.code}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.symbol}</TableCell>
                    <TableCell>{c.exchange_rate}</TableCell>
                    <TableCell className="flex gap-1">
                      {c.is_default && <Badge>Default</Badge>}
                      <Badge variant={c.is_active ? 'secondary' : 'outline'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Edit2 className="h-4 w-4" /></Button>
                        {!c.is_default && <Button variant="ghost" size="icon" onClick={() => deleteCurrency(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {currencies.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No currencies configured</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCurrencies;
