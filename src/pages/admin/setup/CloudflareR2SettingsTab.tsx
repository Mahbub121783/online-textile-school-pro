import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  HardDrive, Plus, Pencil, Trash2, Loader2, CheckCircle2, AlertCircle, Wifi, Shield, UploadCloud,
} from 'lucide-react';

interface R2Account {
  id: string;
  nickname: string;
  access_key_id: string;
  endpoint_url: string;
  bucket_name: string;
  public_domain_url: string;
  status: string;
  upload_count: number;
  last_used_at: string | null;
  created_at: string;
}

const emptyForm = {
  nickname: '',
  access_key_id: '',
  secret_access_key: '',
  endpoint_url: '',
  bucket_name: '',
  public_domain_url: '',
  is_active: true,
};

const CloudflareR2SettingsTab = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['r2-accounts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('cloudflare_r2_accounts')
        .select('id, nickname, access_key_id, endpoint_url, bucket_name, public_domain_url, status, upload_count, last_used_at, created_at')
        .order('created_at', { ascending: true });
      return (data ?? []) as R2Account[];
    },
  });

  const totalUploads = accounts.reduce((sum, a) => sum + (a.upload_count || 0), 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        nickname: form.nickname.trim(),
        access_key_id: form.access_key_id.trim(),
        endpoint_url: form.endpoint_url.trim(),
        bucket_name: form.bucket_name.trim(),
        public_domain_url: form.public_domain_url.trim(),
        status: form.is_active ? 'active' : 'inactive',
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        if (form.secret_access_key.trim()) {
          payload.secret_access_key = form.secret_access_key.trim();
        }
        const { error } = await supabase
          .from('cloudflare_r2_accounts')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        payload.secret_access_key = form.secret_access_key.trim();
        payload.upload_count = 0;
        const { error } = await supabase
          .from('cloudflare_r2_accounts')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-accounts'] });
      toast.success(editingId ? 'Account updated' : 'Account added');
      closeModal();
    },
    onError: () => toast.error('Failed to save account'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cloudflare_r2_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-accounts'] });
      toast.success('Account deleted');
    },
    onError: () => toast.error('Failed to delete'),
  });

  const handleTest = async (account: R2Account) => {
    setTestingId(account.id);
    try {
      const { data, error } = await supabase.functions.invoke('r2-presign', {
        body: { action: 'test', account_id: account.id },
      });
      if (error) {
        // Try to read the response body for details
        let msg = 'Edge function error';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            msg = body?.error || msg;
          } else {
            msg = error.message || msg;
          }
        } catch { msg = error.message || msg; }
        throw new Error(msg);
      }
      if (!data?.success) throw new Error(data?.error || 'Test failed');
      queryClient.invalidateQueries({ queryKey: ['r2-accounts'] });
      toast.success('Connection Verified — R2 bucket is accessible.');
    } catch (err: any) {
      queryClient.invalidateQueries({ queryKey: ['r2-accounts'] });
      toast.error(`Connection failed: ${err.message || 'Check credentials.'}`);
    } finally {
      setTestingId(null);
    }
  };

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };

  const openEdit = (account: R2Account) => {
    setEditingId(account.id);
    setForm({
      nickname: account.nickname,
      access_key_id: account.access_key_id,
      secret_access_key: '',
      endpoint_url: account.endpoint_url,
      bucket_name: account.bucket_name,
      public_domain_url: account.public_domain_url,
      is_active: account.status === 'active',
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditingId(null); setForm(emptyForm); };

  const statusBadge = (status: string) => {
    if (status === 'active')
      return <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/20">Active</Badge>;
    if (status === 'inactive')
      return <Badge variant="secondary">Inactive</Badge>;
    return <Badge variant="destructive">Error</Badge>;
  };

  if (isLoading) return <p className="text-muted-foreground py-8 text-center">Loading accounts...</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <Card className="bg-secondary/30 border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HardDrive className="h-5 w-5 text-primary" />
              Cloudflare R2 Accounts
            </CardTitle>
            <CardDescription>Manage R2 storage accounts for heavy files (PDFs, videos, documents, archives). Round-robin distribution across accounts.</CardDescription>
          </div>
          <Button onClick={openAdd} className="bg-accent hover:bg-accent-hover text-accent-foreground">
            <Plus className="h-4 w-4 mr-2" /> Add Account
          </Button>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No R2 accounts connected</p>
              <p className="text-sm mt-1">Add your first Cloudflare R2 account to enable heavy file uploads</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Nickname</TableHead>
                    <TableHead>Bucket</TableHead>
                    <TableHead>Uploads</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{account.nickname}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {account.bucket_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          <UploadCloud className="h-3 w-3 mr-1" /> {account.upload_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>{statusBadge(account.status)}</TableCell>
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
                <UploadCloud className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalUploads}</p>
                <p className="text-xs text-muted-foreground">Total Uploads</p>
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
              <p className="font-medium text-foreground">Round-Robin Upload Distribution</p>
              <p>
                Heavy files (PDFs, videos, documents, archives) are automatically distributed across active R2 accounts
                in a round-robin pattern. Each upload goes to the next account in sequence, ensuring even load distribution
                across free-tier accounts. Images continue to use Cloudinary.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit R2 Account' : 'Add Cloudflare R2 Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Account Nickname *</Label>
              <Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder='e.g. "R2 Storage 1"' />
            </div>
            <div className="space-y-2">
              <Label>Access Key ID *</Label>
              <Input value={form.access_key_id} onChange={(e) => setForm({ ...form, access_key_id: e.target.value })} placeholder="e.g. abc123def456..." type="password" />
            </div>
            <div className="space-y-2">
              <Label>Secret Access Key *{editingId ? ' (leave blank to keep current)' : ''}</Label>
              <Input value={form.secret_access_key} onChange={(e) => setForm({ ...form, secret_access_key: e.target.value })} placeholder={editingId ? 'Leave blank to keep current' : '••••••••••••••••••••'} type="password" />
            </div>
            <div className="space-y-2">
              <Label>Endpoint URL *</Label>
              <Input value={form.endpoint_url} onChange={(e) => setForm({ ...form, endpoint_url: e.target.value })} placeholder="https://<account-id>.r2.cloudflarestorage.com" />
            </div>
            <div className="space-y-2">
              <Label>Bucket Name *</Label>
              <Input value={form.bucket_name} onChange={(e) => setForm({ ...form, bucket_name: e.target.value })} placeholder="my-bucket" />
            </div>
            <div className="space-y-2">
              <Label>Public Domain URL *</Label>
              <Input value={form.public_domain_url} onChange={(e) => setForm({ ...form, public_domain_url: e.target.value })} placeholder="https://files.mydomain.com" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Include in round-robin rotation</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
            </div>
            <Button
              className="w-full bg-primary hover:bg-primary-light text-primary-foreground"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.nickname || !form.access_key_id || !form.endpoint_url || !form.bucket_name || !form.public_domain_url || (!editingId && !form.secret_access_key)}
            >
              {saveMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Shield className="h-4 w-4 mr-2" /> Save Account</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CloudflareR2SettingsTab;
