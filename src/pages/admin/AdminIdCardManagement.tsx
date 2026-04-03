import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CreditCard, Search, UserPlus, Shield, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminIdCardManagement() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [grantOpen, setGrantOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [validMonths, setValidMonths] = useState(12);

  // Fetch all ID cards with profiles
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['admin-id-cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_id_cards')
        .select('*, user_profiles!student_id_cards_user_id_fkey(full_name, roll_id, avatar_url)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Search students without ID cards for granting
  const { data: eligibleStudents = [] } = useQuery({
    queryKey: ['eligible-students', studentSearch],
    queryFn: async () => {
      if (!studentSearch || studentSearch.length < 2) return [];
      const { data: existingIds } = await supabase.from('student_id_cards').select('user_id');
      const existingUserIds = (existingIds || []).map(r => r.user_id);
      
      let q = supabase.from('user_profiles').select('id, full_name, roll_id, email').ilike('full_name', `%${studentSearch}%`).limit(10);
      const { data } = await q;
      return (data || []).filter(s => !existingUserIds.includes(s.id));
    },
    enabled: grantOpen && studentSearch.length >= 2,
  });

  const toggleBlock = useMutation({
    mutationFn: async ({ id, blocked }: { id: string; blocked: boolean }) => {
      const { error } = await supabase.from('student_id_cards').update({ download_blocked: blocked }).eq('id', id);
      if (error) throw error;
      // Log activity
      await supabase.from('admin_activity_log').insert({
        admin_id: user!.id,
        action: blocked ? 'block_id_card_download' : 'unblock_id_card_download',
        target_type: 'student_id_card',
        target_id: id,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-id-cards'] }); toast.success('Updated'); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('student_id_cards').update({ is_active: active }).eq('id', id);
      if (error) throw error;
      await supabase.from('admin_activity_log').insert({
        admin_id: user!.id,
        action: active ? 'activate_id_card' : 'deactivate_id_card',
        target_type: 'student_id_card',
        target_id: id,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-id-cards'] }); toast.success('Updated'); },
    onError: (e: any) => toast.error(e.message),
  });

  const grantCard = useMutation({
    mutationFn: async () => {
      if (!selectedStudent) throw new Error('Select a student');
      const now = new Date();
      const validFrom = now.toISOString();
      const validUntil = new Date(now.setMonth(now.getMonth() + validMonths)).toISOString();
      const cardNumber = `OTS-ID-${Date.now().toString(36).toUpperCase()}`;
      
      const { error } = await supabase.from('student_id_cards').insert({
        user_id: selectedStudent.id,
        card_number: cardNumber,
        valid_from: validFrom,
        valid_until: validUntil,
        is_active: true,
      });
      if (error) throw error;
      await supabase.from('admin_activity_log').insert({
        admin_id: user!.id,
        action: 'grant_id_card',
        target_type: 'student_id_card',
        target_id: selectedStudent.id,
        details: { student_name: selectedStudent.full_name, valid_months: validMonths },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-id-cards'] });
      toast.success('ID Card granted successfully');
      setGrantOpen(false);
      setSelectedStudent(null);
      setStudentSearch('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = cards.filter((c: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const p = c.user_profiles;
    return p?.full_name?.toLowerCase().includes(s) || p?.roll_id?.toLowerCase().includes(s) || c.card_number?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" /> ID Card Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage student ID cards, block downloads, or grant access</p>
        </div>
        <Button onClick={() => setGrantOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" /> Grant ID Card
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, roll, or card number..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Badge variant="secondary">{cards.length} cards</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading...</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Roll ID</TableHead>
                    <TableHead>Card Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Download</TableHead>
                    <TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No ID cards found</TableCell>
                    </TableRow>
                  ) : filtered.map((card: any) => {
                    const p = card.user_profiles;
                    const expired = new Date(card.valid_until) < new Date();
                    return (
                      <TableRow key={card.id}>
                        <TableCell className="font-medium">{p?.full_name || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{p?.roll_id || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{card.card_number}</TableCell>
                        <TableCell>
                          <Badge variant={!card.is_active ? 'destructive' : expired ? 'secondary' : 'default'}
                            className={card.is_active && !expired ? 'bg-emerald-600' : ''}>
                            {!card.is_active ? 'Inactive' : expired ? 'Expired' : 'Active'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{format(new Date(card.valid_until), 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          <Switch
                            checked={!card.download_blocked}
                            onCheckedChange={checked => toggleBlock.mutate({ id: card.id, blocked: !checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={card.is_active}
                            onCheckedChange={checked => toggleActive.mutate({ id: card.id, active: checked })}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grant ID Card Dialog */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant ID Card to Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Search Student</Label>
              <Input placeholder="Type student name..." value={studentSearch} onChange={e => { setStudentSearch(e.target.value); setSelectedStudent(null); }} />
            </div>
            {eligibleStudents.length > 0 && !selectedStudent && (
              <div className="border rounded-md max-h-40 overflow-auto">
                {eligibleStudents.map((s: any) => (
                  <button key={s.id} onClick={() => setSelectedStudent(s)}
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0">
                    <span className="font-medium">{s.full_name}</span>
                    <span className="text-muted-foreground ml-2">({s.roll_id})</span>
                  </button>
                ))}
              </div>
            )}
            {selectedStudent && (
              <div className="p-3 bg-muted rounded-md">
                <p className="font-medium">{selectedStudent.full_name}</p>
                <p className="text-xs text-muted-foreground">{selectedStudent.roll_id}</p>
              </div>
            )}
            <div>
              <Label>Validity (months)</Label>
              <Input type="number" min={1} max={60} value={validMonths} onChange={e => setValidMonths(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>Cancel</Button>
            <Button onClick={() => grantCard.mutate()} disabled={!selectedStudent || grantCard.isPending} className="gap-2">
              {grantCard.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
              Grant Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
