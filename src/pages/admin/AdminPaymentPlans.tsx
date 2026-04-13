import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, CreditCard, Calendar } from 'lucide-react';

interface PaymentPlan {
  id: string;
  course_id: string;
  total_amount: number;
  installment_count: number;
  interval_days: number;
  is_active: boolean;
  created_at: string;
  courses?: { title: string } | null;
}

interface InstallmentPayment {
  id: string;
  plan_id: string;
  user_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  paid_at: string | null;
  status: string;
  user_profiles?: { full_name: string } | null;
  payment_plans?: { courses?: { title: string } | null } | null;
}

const AdminPaymentPlans = () => {
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [installments, setInstallments] = useState<InstallmentPayment[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PaymentPlan | null>(null);
  const [tab, setTab] = useState<'plans' | 'installments'>('plans');
  const [form, setForm] = useState({ course_id: '', total_amount: '', installment_count: '3', interval_days: '30', is_active: true });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [plansRes, coursesRes, installRes] = await Promise.all([
      supabase.from('payment_plans').select('*, courses(title)').order('created_at', { ascending: false }),
      supabase.from('courses').select('id, title').eq('is_published', true).order('title'),
      supabase.from('installment_payments').select('*, user_profiles:user_id(full_name), payment_plans(courses(title))').order('due_date', { ascending: true }),
    ]);
    if (plansRes.data) setPlans(plansRes.data as any);
    if (coursesRes.data) setCourses(coursesRes.data);
    if (installRes.data) setInstallments(installRes.data as any);
    setLoading(false);
  };

  const openCreate = () => {
    setEditingPlan(null);
    setForm({ course_id: '', total_amount: '', installment_count: '3', interval_days: '30', is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (p: PaymentPlan) => {
    setEditingPlan(p);
    setForm({ course_id: p.course_id, total_amount: String(p.total_amount), installment_count: String(p.installment_count), interval_days: String(p.interval_days), is_active: p.is_active });
    setDialogOpen(true);
  };

  const savePlan = async () => {
    const data = {
      course_id: form.course_id,
      total_amount: parseFloat(form.total_amount) || 0,
      installment_count: parseInt(form.installment_count) || 2,
      interval_days: parseInt(form.interval_days) || 30,
      is_active: form.is_active,
    };
    if (!data.course_id) { toast.error('Select a course'); return; }
    if (editingPlan) {
      const { error } = await supabase.from('payment_plans').update(data).eq('id', editingPlan.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Plan updated');
    } else {
      const { error } = await supabase.from('payment_plans').insert(data);
      if (error) { toast.error(error.message); return; }
      toast.success('Plan created');
    }
    setDialogOpen(false);
    fetchData();
  };

  const deletePlan = async (id: string) => {
    if (!confirm('Delete this payment plan?')) return;
    await supabase.from('payment_plans').delete().eq('id', id);
    toast.success('Plan deleted');
    fetchData();
  };

  const updateInstallmentStatus = async (id: string, status: string) => {
    const update: any = { status };
    if (status === 'paid') update.paid_at = new Date().toISOString();
    await supabase.from('installment_payments').update(update).eq('id', id);
    toast.success('Status updated');
    fetchData();
  };

  const statusColor = (s: string) => {
    if (s === 'paid') return 'default';
    if (s === 'overdue') return 'destructive';
    return 'secondary';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold">Payment Plans & Installments</h2>
        <div className="flex gap-2">
          <Button variant={tab === 'plans' ? 'default' : 'outline'} size="sm" onClick={() => setTab('plans')}>Plans</Button>
          <Button variant={tab === 'installments' ? 'default' : 'outline'} size="sm" onClick={() => setTab('installments')}>Installments</Button>
        </div>
      </div>

      {tab === 'plans' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Payment Plans</CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Add Plan</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingPlan ? 'Edit' : 'Create'} Payment Plan</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Course</Label>
                    <Select value={form.course_id} onValueChange={v => setForm(f => ({ ...f, course_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                      <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Total Amount</Label><Input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} /></div>
                    <div><Label>Installments</Label><Input type="number" value={form.installment_count} onChange={e => setForm(f => ({ ...f, installment_count: e.target.value }))} /></div>
                    <div><Label>Interval (days)</Label><Input type="number" value={form.interval_days} onChange={e => setForm(f => ({ ...f, interval_days: e.target.value }))} /></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                    <Label>Active</Label>
                  </div>
                  <Button onClick={savePlan} className="w-full">Save</Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-muted-foreground">Loading...</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Installments</TableHead>
                    <TableHead>Interval</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{(p as any).courses?.title || 'N/A'}</TableCell>
                      <TableCell>৳{p.total_amount}</TableCell>
                      <TableCell>{p.installment_count}x</TableCell>
                      <TableCell>{p.interval_days} days</TableCell>
                      <TableCell><Badge variant={p.is_active ? 'default' : 'secondary'}>{p.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deletePlan(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {plans.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payment plans yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'installments' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> All Installment Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installments.map(i => (
                  <TableRow key={i.id}>
                    <TableCell>{(i as any).user_profiles?.full_name || 'N/A'}</TableCell>
                    <TableCell>{(i as any).payment_plans?.courses?.title || 'N/A'}</TableCell>
                    <TableCell>{i.installment_number}</TableCell>
                    <TableCell>৳{i.amount}</TableCell>
                    <TableCell>{new Date(i.due_date).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant={statusColor(i.status) as any}>{i.status}</Badge></TableCell>
                    <TableCell>
                      {i.status !== 'paid' && (
                        <Button size="sm" variant="outline" onClick={() => updateInstallmentStatus(i.id, 'paid')}>Mark Paid</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {installments.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No installments yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminPaymentPlans;
