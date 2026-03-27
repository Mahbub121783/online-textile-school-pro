import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Cloud, Plus, Pencil, Trash2, Loader2, CheckCircle2, AlertCircle, Wifi, Shield, HardDrive,
  Image as ImageIcon, FileText, Video, AlertTriangle,
} from 'lucide-react';

interface CloudinaryAccount {
  id: string;
  nickname: string;
  cloud_name: string;
  api_key: string;
  api_secret: string;
  is_primary: boolean;
  status: string;
  usage_pct: number;
  created_at: string;
  file_category: string;
}

const CATEGORIES = [
  { value: 'images', label: 'Images', icon: ImageIcon, desc: 'SVG, WebP, JPG, PNG, GIF, TIFF' },
  { value: 'documents', label: 'Documents & Graphics', icon: FileText, desc: 'PDF, PPTX, DOC, AI' },
  { value: 'video', label: 'Video', icon: Video, desc: 'MP4, AVI, MOV, MKV, WebM' },
];

const emptyForm = {
  nickname: '',
  cloud_name: '',
  api_key: '',
  api_secret: '',
  is_primary: false,
  file_category: 'images',
};

const CloudinarySettingsTab = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['cloudinary-accounts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('cloudinary_accounts')
        .select('id, nickname, cloud_name, api_key, is_primary, status, usage_pct, created_at, file_category')
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });
      return (data ?? []) as CloudinaryAccount[];
    },
  });

  const primaryAccount = accounts.find((a) => a.is_primary);

  // Check category coverage
  const coveredCategories = new Set(
    accounts.filter((a) => a.status === 'active').map((a) => a.file_category)
  );
  const missingCategories = CATEGORIES.filter((c) => !coveredCategories.has(c.value));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (form.is_primary) {
        await supabase
          .from('cloudinary_accounts')
          .update({ is_primary: false } as any)
          .neq('id', editingId ?? '00000000-0000-0000-0000-000000000000');
      }

      const payload: any = {
        nickname: form.nickname.trim(),
        cloud_name: form.cloud_name.trim(),
        api_key: form.api_key.trim(),
        api_secret: form.api_secret.trim(),
        upload_preset: '_unused',
        is_primary: form.is_primary,
        file_category: form.file_category,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        if (!form.api_secret.trim()) delete payload.api_secret;
        const { error } = await supabase
          .from('cloudinary_accounts')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cloudinary_accounts')
          .insert({ ...payload, status: 'active', usage_pct: 0 });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cloudinary-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['cloudinary-accounts-active'] });
      toast.success(editingId ? 'Account updated' : 'Account added');
      closeModal();
    },
    onError: () => toast.error('Failed to save account'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cloudinary_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cloudinary-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['cloudinary-accounts-active'] });
      toast.success('Account deleted');
    },
    onError: () => toast.error('Failed to delete'),
  });

  const handleTest = async (account: CloudinaryAccount) => {
    setTestingId(account.id);
    try {
      const { data, error } = await supabase.functions.invoke('cloudinary-proxy', {
        body: { action: 'test', account_id: account.id },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Test failed');
      queryClient.invalidateQueries({ queryKey: ['cloudinary-accounts'] });
      toast.success('Connection Verified — Credentials are valid.');
    } catch (err: any) {
      queryClient.invalidateQueries({ queryKey: ['cloudinary-accounts'] });
      toast.error(`Connection failed: ${err.message || 'Check credentials.'}`);
    } finally {
      setTestingId(null);
    }
  };

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };

  const openEdit = (account: CloudinaryAccount) => {
    setEditingId(account.id);
    setForm({
      nickname: account.nickname,
      cloud_name: account.cloud_name,
      api_key: account.api_key,
      api_secret: '',
      is_primary: account.is_primary,
      file_category: account.file_category || 'images',
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditingId(null); setForm(emptyForm); };

  const statusBadge = (status: string) => {
    if (status === 'active')
      return <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/20">Active</Badge>;
    if (status === 'full')
      return <Badge className="bg-warning/15 text-warning border-warning/30 hover:bg-warning/20">Full</Badge>;
    return <Badge variant="destructive">Error</Badge>;
  };

  const categoryBadge = (cat: string) => {
    const cfg = CATEGORIES.find((c) => c.value === cat);
    if (!cfg) return null;
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className="gap-1 text-xs">
        <Icon className="h-3 w-3" /> {cfg.label}
      </Badge>
    );
  };

  if (isLoading) return <p className="text-muted-foreground py-8 text-center">Loading accounts...</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Category coverage warning */}
      {missingCategories.length > 0 && accounts.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Missing Category Coverage</p>
                <p className="text-muted-foreground mt-1">
                  No active account assigned for:{' '}
                  {missingCategories.map((c) => c.label).join(', ')}.
                  Uploads of these types will fall back to any available account.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-secondary/30 border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Cloud className="h-5 w-5 text-primary" />
              Connected Accounts
            </CardTitle>
            <CardDescription>Manage your Cloudinary CDN accounts for media delivery</CardDescription>
          </div>
          <Button onClick={openAdd} className="bg-accent hover:bg-accent-hover text-accent-foreground">
            <Plus className="h-4 w-4 mr-2" /> Add Account
          </Button>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Cloud className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No accounts connected</p>
              <p className="text-sm mt-1">Add your first Cloudinary account to enable CDN delivery</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Nickname</TableHead>
                    <TableHead>Cloud Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Primary</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{account.nickname}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {account.cloud_name}
                      </TableCell>
                      <TableCell>{categoryBadge(account.file_category)}</TableCell>
                      <TableCell>{statusBadge(account.status)}</TableCell>
                      <TableCell>
                        {account.is_primary && (
                          <Badge variant="outline" className="border-primary/40 text-primary">
                            <Shield className="h-3 w-3 mr-1" /> Primary
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleTest(account)} disabled={testingId === account.id}>
                            {testingId === account.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                            <span className="ml-1.5 hidden sm:inline">Test</span>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(account)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(account.id)} disabled={deleteMutation.isPending}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <HardDrive className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{accounts.length}</p>
                <p className="text-xs text-muted-foreground">Total Accounts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{accounts.filter((a) => a.status === 'active').length}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold truncate">{primaryAccount?.nickname || 'None'}</p>
                <p className="text-xs text-muted-foreground">Primary Destination</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-muted/20">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Category-Based Routing</p>
              <p>
                Uploads are automatically routed to the correct Cloudinary account based on file type.
                Images go to image accounts, documents to document accounts, and videos to video accounts.
                If no account is configured for a category, the system falls back to any available active account.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Account' : 'Add Cloudinary Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Account Nickname *</Label>
              <Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder='e.g. "Main Media", "Video Backup 1"' />
            </div>
            <div className="space-y-2">
              <Label>Cloud Name *</Label>
              <Input value={form.cloud_name} onChange={(e) => setForm({ ...form, cloud_name: e.target.value })} placeholder="e.g. my-cloud-name" />
            </div>
            <div className="space-y-2">
              <Label>File Category *</Label>
              <Select value={form.file_category} onValueChange={(v) => setForm({ ...form, file_category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <c.icon className="h-4 w-4" />
                        {c.label}
                        <span className="text-muted-foreground text-xs ml-1">({c.desc})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>API Key *</Label>
              <Input value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder="••••••••••••••" type="password" />
            </div>
            <div className="space-y-2">
              <Label>API Secret *{editingId ? ' (leave blank to keep current)' : ''}</Label>
              <Input value={form.api_secret} onChange={(e) => setForm({ ...form, api_secret: e.target.value })} placeholder={editingId ? 'Leave blank to keep current secret' : '••••••••••••••••••••'} type="password" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Set as Primary Destination</p>
                <p className="text-xs text-muted-foreground">All uploads will route here first</p>
              </div>
              <Switch checked={form.is_primary} onCheckedChange={(checked) => setForm({ ...form, is_primary: checked })} />
            </div>
            <Button
              className="w-full bg-primary hover:bg-primary-light text-primary-foreground"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.nickname || !form.cloud_name || !form.api_key || (!editingId && !form.api_secret)}
            >
              {saveMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Shield className="h-4 w-4 mr-2" /> Save & Authenticate</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CloudinarySettingsTab;
