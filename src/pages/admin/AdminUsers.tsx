import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, Shield, UserCheck, UserX, UserCog, CreditCard, UserCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import PublicProfileEditor from '@/components/shared/PublicProfileEditor';
import { Constants } from '@/integrations/supabase/types';
import { Progress } from '@/components/ui/progress';
import RoleManagerDialog from '@/components/admin/RoleManagerDialog';
import { getRoleDef } from '@/lib/roleDefinitions';

const ALL_ROLES = Constants.public.Enums.app_role;

const AdminUsers = () => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [roleDialog, setRoleDialog] = useState<{ userId: string; name: string; roles: string[] } | null>(null);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // Realtime: any role change in the system refreshes the user list
  useEffect(() => {
    const ch = supabase
      .channel(`admin-users-roles-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users', search, roleFilter],
    queryFn: async () => {
      let query = supabase.from('user_profiles').select('*').order('created_at', { ascending: false }).limit(100);
      if (search) query = query.ilike('full_name', `%${search}%`);
      const { data: profiles } = await query;
      const { data: allRoles } = await supabase.from('user_roles').select('*');

      const enriched = (profiles ?? []).map((p) => ({
        ...p,
        roles: (allRoles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
      }));

      if (roleFilter !== 'all') {
        return enriched.filter((u) => u.roles.includes(roleFilter));
      }
      return enriched;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('user_profiles').update({ is_active }).eq('id', id);
      if (error) throw error;
      await supabase.from('admin_activity_log').insert({
        admin_id: currentUser!.id,
        action: is_active ? 'Activated user' : 'Deactivated user',
        target_type: 'user',
        target_id: id,
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User status updated'); },
    onError: () => toast.error('Failed to update user status'),
  });

  const roleBadgeColor = (role: string) => getRoleDef(role)?.badgeVariant ?? 'outline';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold">User Management</h2>
        <div className="flex gap-2">
          <Link to="/admin/instructors" className="text-xs text-primary hover:underline flex items-center gap-1">
            <UserCog className="h-3 w-3" /> Instructor Mgmt
          </Link>
          <Link to="/admin/payment" className="text-xs text-primary hover:underline flex items-center gap-1">
            <CreditCard className="h-3 w-3" /> Payments
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Filter role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : users?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No users found.</TableCell></TableRow>
              ) : (
                users?.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{u.full_name || 'Unnamed'}</p>
                        <p className="text-xs text-muted-foreground">{u.phone || u.id.slice(0, 8)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r: string) => (
                          <Badge key={r} variant={roleBadgeColor(r) as any} className="text-xs">{r}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const fields = [
                          !!u.avatar_url, !!u.full_name, !!u.phone, !!u.blood_group,
                          !!u.university, !!u.batch, !!u.district, !!u.professional_role, !!u.date_of_birth,
                        ];
                        const pct = Math.round((fields.filter(Boolean).length / fields.length) * 100);
                        return (
                          <div className="w-16">
                            <Progress value={pct} className="h-1.5" />
                            <span className="text-[10px] text-muted-foreground">{pct}%</span>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.is_active ? 'default' : 'destructive'} className="text-xs">
                        {u.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={u.is_active ? 'Deactivate' : 'Activate'}
                          onClick={() => toggleActive.mutate({ id: u.id, is_active: !u.is_active })}
                        >
                          {u.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Edit public profile"><UserCircle2 className="h-4 w-4" /></Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader><DialogTitle>Public Profile — {u.full_name}</DialogTitle></DialogHeader>
                            <PublicProfileEditor userId={u.id} mode="admin" />
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Manage roles"
                          onClick={() => setRoleDialog({ userId: u.id, name: u.full_name || 'User', roles: u.roles })}
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {roleDialog && (
        <RoleManagerDialog
          open={!!roleDialog}
          onOpenChange={(o) => !o && setRoleDialog(null)}
          userId={roleDialog.userId}
          userName={roleDialog.name}
          currentRoles={roleDialog.roles}
        />
      )}
    </div>
  );
};

export default AdminUsers;
