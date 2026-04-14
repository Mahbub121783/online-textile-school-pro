import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PenSquare, Plus, Trash2, Check } from 'lucide-react';
import MailRichTextEditor from './MailRichTextEditor';
import { toast } from 'sonner';

export default function SignatureManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [name, setName] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const { data: signatures = [] } = useQuery({
    queryKey: ['edumail-signatures'],
    queryFn: async () => {
      const { data } = await supabase.from('edumail_signatures').select('*').order('is_default', { ascending: false });
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not logged in');
      if (isDefault) {
        await supabase.from('edumail_signatures').update({ is_default: false }).eq('user_id', user.id);
      }
      if (editing?.id) {
        const { error } = await supabase.from('edumail_signatures').update({ name, body_html: bodyHtml, is_default: isDefault }).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('edumail_signatures').insert({ user_id: user.id, name, body_html: bodyHtml, is_default: isDefault });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edumail-signatures'] });
      setShowDialog(false);
      toast.success('Signature saved');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('edumail_signatures').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edumail-signatures'] });
      toast.success('Signature deleted');
    },
  });

  const openNew = () => {
    setEditing(null);
    setName('');
    setBodyHtml('');
    setIsDefault(signatures.length === 0);
    setShowDialog(true);
  };

  const openEdit = (sig: any) => {
    setEditing(sig);
    setName(sig.name);
    setBodyHtml(sig.body_html);
    setIsDefault(sig.is_default);
    setShowDialog(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            Email Signatures
            <Button size="sm" variant="outline" onClick={openNew}><Plus className="h-3 w-3 mr-1" /> New</Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {signatures.length === 0 ? (
            <p className="text-sm text-muted-foreground">No signatures yet. Create one to auto-append to your emails.</p>
          ) : (
            <div className="space-y-2">
              {signatures.map((sig: any) => (
                <div key={sig.id} className="flex items-center gap-2 p-2 border rounded-md">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{sig.name}</span>
                      {sig.is_default && <Check className="h-3 w-3 text-primary" />}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(sig)}><PenSquare className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(sig.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Signature' : 'New Signature'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Professional" />
            </div>
            <MailRichTextEditor content={bodyHtml} onChange={setBodyHtml} placeholder="Your signature..." minHeight="120px" />
            <div className="flex items-center gap-2">
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              <Label>Set as default signature</Label>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name.trim()}>
              {saveMutation.isPending ? 'Saving...' : 'Save Signature'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
