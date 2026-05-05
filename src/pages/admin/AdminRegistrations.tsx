import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Settings, Palette, Database, Plus, Trash2, Edit, Download, Eye, Users, Search, X, Image as ImageIcon } from 'lucide-react';
import MediaPickerModal from '@/components/shared/MediaPickerModal';
import CustomFieldsBuilder, { CustomField } from '@/components/admin/CustomFieldsBuilder';
import * as XLSX from 'xlsx';

interface Purpose {
  id: string; name: string; slug: string; is_active: boolean; max_entries: number | null;
  photo_required: boolean; starts_at: string | null; ends_at: string | null;
  sort_order: number; custom_fields: any[]; created_at: string;
}

interface FormConfig {
  id: string; fields_order: string[]; page_title: string; page_subtitle: string | null;
  banner_url: string | null; event_details: string | null; countdown_target: string | null;
  custom_css: string | null; updated_at: string;
}

interface Registration {
  id: string; purpose_id: string | null; full_name: string; email: string; mobile: string;
  blood_group: string | null; university: string | null; batch: string | null;
  business_name: string | null; job_area: string | null; experience_years: number | null;
  photo_url: string | null; extra_fields: any; created_at: string;
}

// ─── Form Settings Tab ───
function FormSettingsTab() {
  const { toast } = useToast();
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  const [editing, setEditing] = useState<Purpose | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', is_active: true, max_entries: '', photo_required: false, starts_at: '', ends_at: '', custom_fields: '[]' });

  const load = useCallback(async () => {
    const { data } = await supabase.from('registration_purposes' as any).select('*').order('sort_order');
    setPurposes((data || []) as any);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm({ name: '', slug: '', is_active: true, max_entries: '', photo_required: false, starts_at: '', ends_at: '', custom_fields: '[]' }); setShowForm(true); };
  const openEdit = (p: Purpose) => {
    setEditing(p);
    setForm({
      name: p.name, slug: p.slug, is_active: p.is_active,
      max_entries: p.max_entries?.toString() || '', photo_required: p.photo_required,
      starts_at: p.starts_at ? p.starts_at.slice(0, 16) : '', ends_at: p.ends_at ? p.ends_at.slice(0, 16) : '',
      custom_fields: JSON.stringify(p.custom_fields || [], null, 2),
    });
    setShowForm(true);
  };

  const save = async () => {
    let customFields: any[];
    try { customFields = JSON.parse(form.custom_fields); } catch { toast({ title: 'Invalid JSON in custom fields', variant: 'destructive' }); return; }
    const payload: any = {
      name: form.name, slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-'),
      is_active: form.is_active, max_entries: form.max_entries ? parseInt(form.max_entries) : null,
      photo_required: form.photo_required, starts_at: form.starts_at || null, ends_at: form.ends_at || null,
      custom_fields: customFields,
    };
    if (editing) {
      await supabase.from('registration_purposes' as any).update(payload).eq('id', editing.id);
    } else {
      await supabase.from('registration_purposes' as any).insert(payload);
    }
    toast({ title: editing ? 'Purpose updated' : 'Purpose created' });
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from('registration_purposes' as any).delete().eq('id', id);
    toast({ title: 'Purpose deleted' });
    load();
  };

  const toggleActive = async (p: Purpose) => {
    await supabase.from('registration_purposes' as any).update({ is_active: !p.is_active } as any).eq('id', p.id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-heading font-semibold text-lg">Registration Purposes</h3>
        <Button onClick={openNew} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Purpose</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Slug</TableHead><TableHead>Active</TableHead>
              <TableHead>Limit</TableHead><TableHead>Photo</TableHead><TableHead>Dates</TableHead><TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purposes.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{p.slug}</code></TableCell>
                <TableCell><Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} /></TableCell>
                <TableCell>{p.max_entries || '∞'}</TableCell>
                <TableCell>{p.photo_required ? <Badge>Required</Badge> : <span className="text-muted-foreground text-sm">No</span>}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {p.starts_at ? new Date(p.starts_at).toLocaleDateString() : '—'} → {p.ends_at ? new Date(p.ends_at).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {purposes.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No purposes yet. Add one to get started.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Purpose' : 'New Purpose'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Slug *</Label><Input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} placeholder="auto-generated" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Max Entries</Label><Input type="number" value={form.max_entries} onChange={e => setForm(p => ({ ...p, max_entries: e.target.value }))} placeholder="Unlimited" /></div>
              <div className="flex items-center gap-2 pt-5"><Switch checked={form.photo_required} onCheckedChange={v => setForm(p => ({ ...p, photo_required: v }))} /><Label>Photo Required</Label></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Starts At</Label><Input type="datetime-local" value={form.starts_at} onChange={e => setForm(p => ({ ...p, starts_at: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Ends At</Label><Input type="datetime-local" value={form.ends_at} onChange={e => setForm(p => ({ ...p, ends_at: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} /><Label>Active</Label></div>
            <div className="space-y-1">
              <Label>Custom Fields (JSON)</Label>
              <Textarea rows={5} value={form.custom_fields} onChange={e => setForm(p => ({ ...p, custom_fields: e.target.value }))} className="font-mono text-xs"
                placeholder='[{"key":"tshirt_size","label":"T-Shirt Size","type":"select","required":true,"options":["S","M","L","XL"]}]' />
              <p className="text-xs text-muted-foreground">Array of objects: key, label, type (text/select/number/date), required, options[]</p>
            </div>
            <Button onClick={save} className="w-full">{editing ? 'Update' : 'Create'} Purpose</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Page Customization Tab ───
function PageCustomizationTab() {
  const { toast } = useToast();
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [showMedia, setShowMedia] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('registration_form_config' as any).select('*').limit(1).single().then(({ data }) => {
      if (data) setConfig(data as any);
    });
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    const { id, updated_at, ...rest } = config;
    await supabase.from('registration_form_config' as any).update(rest as any).eq('id', id);
    setSaving(false);
    toast({ title: 'Page settings saved' });
  };

  if (!config) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Page Title</Label>
          <Input value={config.page_title} onChange={e => setConfig(c => c ? { ...c, page_title: e.target.value } : c)} />
        </div>
        <div className="space-y-2">
          <Label>Subtitle</Label>
          <Input value={config.page_subtitle || ''} onChange={e => setConfig(c => c ? { ...c, page_subtitle: e.target.value } : c)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Countdown Target</Label>
        <Input type="datetime-local" value={config.countdown_target ? config.countdown_target.slice(0, 16) : ''} onChange={e => setConfig(c => c ? { ...c, countdown_target: e.target.value ? new Date(e.target.value).toISOString() : null } : c)} />
        <p className="text-xs text-muted-foreground">Set a countdown timer shown at the top of the registration page</p>
      </div>

      <div className="space-y-2">
        <Label>Banner Image</Label>
        <div className="flex items-center gap-3">
          {config.banner_url ? (
            <div className="relative">
              <img src={config.banner_url} alt="Banner" className="h-24 rounded-lg border object-cover" />
              <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={() => setConfig(c => c ? { ...c, banner_url: null } : c)}><X className="w-3 h-3" /></Button>
            </div>
          ) : null}
          <Button variant="outline" onClick={() => setShowMedia(true)}><ImageIcon className="w-4 h-4 mr-2" /> {config.banner_url ? 'Change' : 'Select'} Banner</Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Event Details (HTML)</Label>
        <Textarea rows={5} value={config.event_details || ''} onChange={e => setConfig(c => c ? { ...c, event_details: e.target.value } : c)} placeholder="<p>Event info...</p>" />
      </div>

      <div className="space-y-2">
        <Label>Custom CSS</Label>
        <Textarea rows={3} value={config.custom_css || ''} onChange={e => setConfig(c => c ? { ...c, custom_css: e.target.value } : c)} className="font-mono text-xs" placeholder=".registration-form { }" />
      </div>

      <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Page Settings'}</Button>

      <MediaPickerModal open={showMedia} onClose={() => setShowMedia(false)} onSelect={(url) => { setConfig(c => c ? { ...c, banner_url: url } : c); setShowMedia(false); }} />
    </div>
  );
}

// ─── Submissions Tab ───
function SubmissionsTab() {
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [regRes, purpRes] = await Promise.all([
        supabase.from('registrations' as any).select('*').order('created_at', { ascending: false }),
        supabase.from('registration_purposes' as any).select('*').order('sort_order'),
      ]);
      setRegistrations((regRes.data || []) as any);
      setPurposes((purpRes.data || []) as any);
      setLoading(false);
    };
    load();
  }, []);

  const purposeMap = Object.fromEntries(purposes.map(p => [p.id, p.name]));

  const filtered = registrations.filter(r => {
    if (filter !== 'all' && r.purpose_id !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.full_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.mobile.includes(q);
    }
    return true;
  });

  const stats = purposes.map(p => ({
    name: p.name,
    count: registrations.filter(r => r.purpose_id === p.id).length,
  }));

  const exportExcel = () => {
    const rows = filtered.map(r => ({
      'Name': r.full_name, 'Email': r.email, 'Mobile': r.mobile,
      'Purpose': r.purpose_id ? purposeMap[r.purpose_id] || '' : '',
      'Blood Group': r.blood_group || '', 'University': r.university || '', 'Batch': r.batch || '',
      'Business': r.business_name || '', 'Job Area': r.job_area || '',
      'Experience': r.experience_years ?? '', 'Date': new Date(r.created_at).toLocaleDateString(),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registrations');
    XLSX.writeFile(wb, `registrations_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: `Exported ${rows.length} records` });
  };

  if (loading) return <div className="text-muted-foreground py-8 text-center">Loading submissions...</div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold font-heading">{registrations.length}</div><div className="text-xs text-muted-foreground">Total</div></CardContent></Card>
        {stats.map(s => (
          <Card key={s.name}><CardContent className="pt-4 text-center"><div className="text-2xl font-bold font-heading">{s.count}</div><div className="text-xs text-muted-foreground">{s.name}</div></CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Purposes</SelectItem>
            {purposes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, mobile..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" onClick={exportExcel}><Download className="w-4 h-4 mr-2" /> Export Excel</Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Mobile</TableHead>
              <TableHead>Purpose</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.full_name}</TableCell>
                <TableCell className="text-sm">{r.email}</TableCell>
                <TableCell className="text-sm">{r.mobile}</TableCell>
                <TableCell><Badge variant="secondary">{r.purpose_id ? purposeMap[r.purpose_id] || '—' : '—'}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => setSelected(r)}><Eye className="w-4 h-4" /></Button></TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No registrations found</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Showing {filtered.length} of {registrations.length} registrations</p>

      {/* Detail Modal */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registration Details</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3">
              {selected.photo_url && <img src={selected.photo_url} alt="Photo" className="w-24 h-24 rounded-lg object-cover border mx-auto" />}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Name:</span><p className="font-medium">{selected.full_name}</p></div>
                <div><span className="text-muted-foreground">Email:</span><p className="font-medium">{selected.email}</p></div>
                <div><span className="text-muted-foreground">Mobile:</span><p className="font-medium">{selected.mobile}</p></div>
                <div><span className="text-muted-foreground">Purpose:</span><p className="font-medium">{selected.purpose_id ? purposeMap[selected.purpose_id] : '—'}</p></div>
                {selected.blood_group && <div><span className="text-muted-foreground">Blood Group:</span><p className="font-medium">{selected.blood_group}</p></div>}
                {selected.university && <div><span className="text-muted-foreground">University:</span><p className="font-medium">{selected.university}</p></div>}
                {selected.batch && <div><span className="text-muted-foreground">Batch:</span><p className="font-medium">{selected.batch}</p></div>}
                {selected.business_name && <div><span className="text-muted-foreground">Business:</span><p className="font-medium">{selected.business_name}</p></div>}
                {selected.job_area && <div><span className="text-muted-foreground">Job Area:</span><p className="font-medium">{selected.job_area}</p></div>}
                {selected.experience_years != null && <div><span className="text-muted-foreground">Experience:</span><p className="font-medium">{selected.experience_years} yrs</p></div>}
                <div className="col-span-2"><span className="text-muted-foreground">Registered:</span><p className="font-medium">{new Date(selected.created_at).toLocaleString()}</p></div>
              </div>
              {selected.extra_fields && Object.keys(selected.extra_fields).length > 0 && (
                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold mb-2">Extra Fields</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(selected.extra_fields).map(([k, v]) => (
                      <div key={k}><span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}:</span><p className="font-medium">{String(v)}</p></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Component ───
export default function AdminRegistrations() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-heading font-bold">Universal Registration</h1>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings" className="gap-1.5"><Settings className="w-4 h-4" /> Form Settings</TabsTrigger>
          <TabsTrigger value="page" className="gap-1.5"><Palette className="w-4 h-4" /> Page Customization</TabsTrigger>
          <TabsTrigger value="submissions" className="gap-1.5"><Database className="w-4 h-4" /> Submissions</TabsTrigger>
        </TabsList>
        <TabsContent value="settings"><FormSettingsTab /></TabsContent>
        <TabsContent value="page"><PageCustomizationTab /></TabsContent>
        <TabsContent value="submissions"><SubmissionsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
