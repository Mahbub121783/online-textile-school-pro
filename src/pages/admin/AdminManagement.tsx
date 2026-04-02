import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Shield, ShieldAlert, UserPlus, Trash2, Search, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const AdminManagement = () => {
  const { isSuperAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showGrantDialog, setShowGrantDialog] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantRole, setGrantRole] = useState<string>('admin');
  const [revokeTarget, setRevokeTarget] = useState<{ userId: string; role: string; name: string } | null>(null);

  const { data: adminUsers, isLoading } = useQuery({
    queryKey: ['admin-management-users'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['admin', 'super_admin']);
      if (!roles || roles.length === 0) return [];

      const userIds = [...new Set(roles.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url, created_at')
        .in('id', userIds);

      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

      const { data: activityCounts } = await supabase
        .from('admin_activity_log' as any)
        .select('admin_id');

      const activityMap: Record<string, number> = {};
      (activityCounts || []).forEach((a: any) => {
        activityMap[a.admin_id] = (activityMap[a.admin_id] || 0) + 1;
      });

      const grouped: Record<string, { profile: any; roles: string[]; activityCount: number }> = {};
      roles.forEach(r => {
        if (!grouped[r.user_id]) {
          grouped[r.user_id] = {
            profile: profileMap[r.user_id] || { id: r.user_id, full_name: 'Unknown' },
            roles: [],
            activityCount: activityMap[r.user_id] || 0,
          };
        }
        grouped[r.user_id].roles.push(r.role);
      });

      return Object.values(grouped);
    },
    enabled: isSuperAdmin,
  });

  const grantMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .ilike('full_name', `%${email}%`)
        .limit(1)
        .single();

      if (!profile) {
        const { data: allProfiles } = await supabase
          .from('user_profiles')
          .select('id')
          .limit(1000);
        
        const match = (allProfiles as any[])?.find((p: any) => p.id === email);
        if (!match) throw new Error('User not found. Try searching by name or user ID.');
        
        const { error } = await supabase.from('user_roles').insert({ user_id: match.id, role } as any);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('user_roles').insert({ user_id: profile.id, role });
      if (error) {
        if (error.code === '23505') throw new Error('User already has this role');
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Role granted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-management-users'] });
      setShowGrantDialog(false);
      setGrantEmail('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revokeMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      if (role === 'super_admin' && userId === user?.id) {
        throw new Error('Cannot revoke your own super_admin role');
      }
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Role revoked');
      queryClient.invalidateQueries({ queryKey: ['admin-management-users'] });
      setRevokeTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isSuperAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="font-heading text-xl font-bold mb-2">Super Admin Only</h2>
            <p className="text-muted-foreground">This page is restricted to super administrators.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filtered = adminUsers?.filter(a =>
    !search || a.profile.full_name?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Admin Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Manage administrator roles and permissions</p>
        </div>
        <Button onClick={() => setShowGrantDialog(true)} className="gap-2">
          <UserPlus className="h-4 w-4" /> Grant Admin Role
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Administrators ({filtered.length})</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Activity Count</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(admin => (
                  <TableRow key={admin.profile.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {admin.profile.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium">{admin.profile.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{admin.profile.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {admin.roles.map(role => (
                          <Badge key={role} variant={role === 'super_admin' ? 'default' : 'secondary'} className={role === 'super_admin' ? 'bg-amber-500 hover:bg-amber-600' : ''}>
                            {role === 'super_admin' && <Crown className="h-3 w-3 mr-1" />}
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{admin.activityCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {admin.profile.created_at ? format(new Date(admin.profile.created_at), 'MMM d, yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {admin.roles.map(role => (
                          <Button
                            key={role}
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={role === 'super_admin' && admin.profile.id === user?.id}
                            onClick={() => setRevokeTarget({ userId: admin.profile.id, role, name: admin.profile.full_name })}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Revoke {role}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Grant Dialog */}
      <Dialog open={showGrantDialog} onOpenChange={setShowGrantDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Grant Admin Role</DialogTitle>
            <DialogDescription>Search by user name to grant an admin role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input placeholder="User name or ID..." value={grantEmail} onChange={e => setGrantEmail(e.target.value)} />
            <Select value={grantRole} onValueChange={setGrantRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGrantDialog(false)}>Cancel</Button>
            <Button onClick={() => grantMutation.mutate({ email: grantEmail, role: grantRole })} disabled={!grantEmail || grantMutation.isPending}>
              {grantMutation.isPending ? 'Granting...' : 'Grant Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <Dialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke Role</DialogTitle>
            <DialogDescription>
              Remove <strong>{revokeTarget?.role}</strong> from <strong>{revokeTarget?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => revokeTarget && revokeMutation.mutate(revokeTarget)} disabled={revokeMutation.isPending}>
              {revokeMutation.isPending ? 'Revoking...' : 'Revoke'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminManagement;
