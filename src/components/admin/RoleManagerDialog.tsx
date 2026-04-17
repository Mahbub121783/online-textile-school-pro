import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ALL_ROLE_DEFS, getRoleDef, AppRole } from '@/lib/roleDefinitions';
import { Plus, Minus, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  userName: string;
  currentRoles: string[];
}

export const RoleManagerDialog = ({ open, onOpenChange, userId, userName, currentRoles }: Props) => {
  const { user: actor } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set(currentRoles));
  const [note, setNote] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(new Set(currentRoles));
      setNote('');
    }
  }, [open, currentRoles]);

  const { data: auditLog } = useQuery({
    queryKey: ['user-role-audit', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('admin_activity_log')
        .select('id, action, created_at, details, admin_id, user_profiles!admin_activity_log_admin_id_fkey(full_name)')
        .eq('target_id', userId)
        .eq('target_type', 'user')
        .ilike('action', '%role%')
        .order('created_at', { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: open,
  });

  const diff = useMemo(() => {
    const current = new Set(currentRoles);
    const toAdd = [...selected].filter(r => !current.has(r));
    const toRemove = [...current].filter(r => !selected.has(r));
    return { toAdd, toRemove, hasChanges: toAdd.length + toRemove.length > 0 };
  }, [selected, currentRoles]);

  const needsConfirm = useMemo(
    () => diff.toAdd.some(r => getRoleDef(r)?.requiresConfirm),
    [diff.toAdd]
  );

  const save = useMutation({
    mutationFn: async () => {
      const rows = diff.toAdd.map(role => ({ user_id: userId, role: role as any }));
      if (rows.length) {
        const { error } = await supabase.from('user_roles').insert(rows);
        if (error) throw error;
      }
      for (const role of diff.toRemove) {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', role as any);
        if (error) throw error;
      }

      const logs = [
        ...diff.toAdd.map(r => ({
          admin_id: actor!.id,
          action: `Assigned role: ${r}`,
          target_type: 'user',
          target_id: userId,
          details: { role: r, note: note || null } as any,
        })),
        ...diff.toRemove.map(r => ({
          admin_id: actor!.id,
          action: `Removed role: ${r}`,
          target_type: 'user',
          target_id: userId,
          details: { role: r, note: note || null } as any,
        })),
      ];
      if (logs.length) await supabase.from('admin_activity_log').insert(logs);

      // Notify the user
      const summary = [
        diff.toAdd.length ? `Granted: ${diff.toAdd.join(', ')}` : null,
        diff.toRemove.length ? `Revoked: ${diff.toRemove.join(', ')}` : null,
      ].filter(Boolean).join(' • ');
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'role_update',
        title: 'Your roles were updated',
        message: summary,
        link: '/dashboard',
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['user-role-audit', userId] });
      qc.invalidateQueries({ queryKey: ['admin-instructors'] });
      qc.invalidateQueries({ queryKey: ['instructors'] });
      toast.success(`Updated ${diff.toAdd.length + diff.toRemove.length} role(s) for ${userName}`);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to update roles'),
  });

  const toggle = (role: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(role) ? next.delete(role) : next.add(role);
      return next;
    });
  };

  const handleSaveClick = () => {
    if (!diff.hasChanges) return;
    if (needsConfirm) setConfirmOpen(true);
    else save.mutate();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Roles — {userName}</DialogTitle>
            <DialogDescription>
              Toggle roles below. Changes are saved atomically and propagate live to the user.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-2">
              {ALL_ROLE_DEFS.map(def => {
                const Icon = def.icon;
                const isOn = selected.has(def.role);
                const wasOn = currentRoles.includes(def.role);
                const changed = isOn !== wasOn;
                return (
                  <div
                    key={def.role}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                      changed ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${def.colorClass}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{def.label}</span>
                        <Badge variant={def.badgeVariant} className="text-[10px]">{def.role}</Badge>
                        {def.requiresConfirm && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" /> elevated
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{def.description}</p>
                    </div>
                    <Switch checked={isOn} onCheckedChange={() => toggle(def.role)} />
                  </div>
                );
              })}
            </div>

            {diff.hasChanges && (
              <>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Pending changes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {diff.toAdd.map(r => (
                      <Badge key={`a-${r}`} variant="default" className="gap-1">
                        <Plus className="h-3 w-3" /> {r}
                      </Badge>
                    ))}
                    {diff.toRemove.map(r => (
                      <Badge key={`r-${r}`} variant="destructive" className="gap-1">
                        <Minus className="h-3 w-3" /> {r}
                      </Badge>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Optional note (reason for change) — recorded in audit log"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </>
            )}

            {auditLog && auditLog.length > 0 && (
              <>
                <Separator className="my-4" />
                <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Recent role activity
                </p>
                <div className="space-y-1.5">
                  {auditLog.map((l: any) => (
                    <div key={l.id} className="text-xs flex items-center justify-between gap-2 rounded border border-border/50 px-2 py-1.5">
                      <span className="truncate">
                        <span className="font-medium">{l.user_profiles?.full_name ?? 'Admin'}</span>
                        {' — '}
                        <span className="text-muted-foreground">{l.action}</span>
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSaveClick} disabled={!diff.hasChanges || save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Save Changes {diff.hasChanges && `(${diff.toAdd.length + diff.toRemove.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm elevated role assignment
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to grant <strong>{userName}</strong> one or more elevated roles
              ({diff.toAdd.filter(r => getRoleDef(r)?.requiresConfirm).join(', ')}).
              This gives broad access to the platform. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmOpen(false); save.mutate(); }}>
              Yes, grant role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RoleManagerDialog;
