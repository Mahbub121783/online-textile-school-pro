import { TableSkeleton } from '@/components/ui/loading-skeletons';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MoreHorizontal, ShieldOff, KeyRound, BookX, Search, UserMinus } from 'lucide-react';
import { createNotification } from '@/lib/notifications';

const AccessBoardTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: instructors, isLoading } = useQuery({
    queryKey: ['access-board-instructors'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instructor');
      if (!roles?.length) return [];

      const ids = roles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, is_active')
        .in('id', ids);

      const { data: courses } = await supabase
        .from('courses')
        .select('id, instructor_id, price, enrollment_count')
        .in('instructor_id', ids);

      return (profiles || []).map(p => {
        const instructorCourses = courses?.filter(c => c.instructor_id === p.id) || [];
        const totalRevenue = instructorCourses.reduce(
          (sum, c) => sum + (Number(c.price || 0) * Number(c.enrollment_count || 0)), 0
        );
        return {
          ...p,
          activeCourses: instructorCourses.length,
          totalRevenue,
        };
      });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: !isActive })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['access-board-instructors'] });
      toast({
        title: vars.isActive ? 'Account Suspended' : 'Account Reactivated',
        description: `Instructor account has been ${vars.isActive ? 'suspended' : 'reactivated'}.`,
      });
      createNotification({
        userId: vars.userId,
        type: 'system',
        title: vars.isActive ? 'Account Suspended' : 'Account Reactivated',
        message: vars.isActive
          ? 'Your instructor account has been suspended by an administrator.'
          : 'Your instructor account has been reactivated.',
      });
    },
  });

  const revokeCourseMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('courses')
        .update({ is_published: false })
        .eq('instructor_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-board-instructors'] });
      toast({ title: 'Course Access Revoked', description: 'All courses have been unpublished.' });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Look up email from instructor_applications
      const { data: app } = await supabase
        .from('instructor_applications')
        .select('email')
        .eq('user_id', userId)
        .limit(1);
      const email = (app as any)?.[0]?.email;
      if (!email) throw new Error('Could not find instructor email. Please reset manually from Supabase Auth dashboard.');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      return email;
    },
    onSuccess: (email) => {
      toast({ title: 'Password Reset Sent', description: `A password reset link has been sent to ${email}.` });
    },
    onError: (err: any) => {
      toast({ title: 'Reset Failed', description: err.message, variant: 'destructive' });
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'instructor');
      if (error) throw error;
      return userId;
    },
    onSuccess: (userId) => {
      queryClient.invalidateQueries({ queryKey: ['access-board-instructors'] });
      toast({ title: 'Instructor Role Removed', description: 'The user has been demoted to student-only.' });
      createNotification({
        userId,
        type: 'system',
        title: 'Instructor Role Removed',
        message: 'Your instructor role has been removed by an administrator. You now have student-only access.',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    },
  });

  // Apply filters
  const filteredInstructors = (instructors || []).filter(inst => {
    const matchesSearch = !searchQuery ||
      (inst.full_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && inst.is_active) ||
      (statusFilter === 'suspended' && !inst.is_active);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by instructor name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-secondary/50 border-none">
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            Approved Instructors
            {searchQuery && <span className="text-sm font-normal text-muted-foreground ml-2">({filteredInstructors.length} results)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} columns={4} />
          ) : !filteredInstructors.length ? (
            <p className="text-sm text-muted-foreground">No instructors found.</p>
          ) : (
            <div className="rounded-lg overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instructor Name</TableHead>
                    <TableHead>Active Courses</TableHead>
                    <TableHead>Total Revenue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Access Controls</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInstructors.map((inst) => (
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium">{inst.full_name || 'N/A'}</TableCell>
                      <TableCell>{inst.activeCourses}</TableCell>
                      <TableCell>৳{inst.totalRevenue.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={inst.is_active
                            ? 'bg-success/10 text-success border-success/30'
                            : 'bg-destructive/10 text-destructive border-destructive/30'}
                        >
                          {inst.is_active ? 'Active' : 'Suspended'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => suspendMutation.mutate({ userId: inst.id, isActive: inst.is_active ?? true })}
                            >
                              <ShieldOff className="h-4 w-4 mr-2" />
                              {inst.is_active ? 'Suspend Account' : 'Reactivate Account'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => resetPasswordMutation.mutate(inst.id)}
                              disabled={resetPasswordMutation.isPending}
                            >
                              <KeyRound className="h-4 w-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => revokeCourseMutation.mutate(inst.id)}
                            >
                              <BookX className="h-4 w-4 mr-2" />
                              Revoke Course Access
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                if (confirm('Remove instructor role? This will demote them to student-only.')) {
                                  removeRoleMutation.mutate(inst.id);
                                }
                              }}
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Remove Instructor Role
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessBoardTab;
