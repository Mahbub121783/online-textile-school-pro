import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { format } from 'date-fns';

const emptyCoupon = {
  code: '', description: '', discount_type: 'percentage', discount_value: 0,
  min_order_amount: 0, max_discount_amount: null as number | null, usage_limit: null as number | null,
  valid_until: '', is_active: true, applicable_to: 'all',
};

const AdminCoupons = () => {
  const [editCoupon, setEditCoupon] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: coupons, isLoading } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => {
      const { data } = await supabase.from('coupons' as any).select('*').order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (coupon: any) => {
      const { id, created_at, used_count, ...rest } = coupon;
      if (!rest.valid_until) rest.valid_until = null;
      if (!rest.max_discount_amount) rest.max_discount_amount = null;
      if (!rest.usage_limit) rest.usage_limit = null;

      if (id) {
        const { error } = await supabase.from('coupons' as any).update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('coupons' as any).insert(rest);
        if (error) throw error;
      }
      await supabase.from('admin_activity_log' as any).insert({ admin_id: user!.id, action: id ? 'Updated coupon' : 'Created coupon', target_type: 'coupon', target_id: id || rest.code });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      setDialogOpen(false); setEditCoupon(null);
      toast.success('Coupon saved');
    },
    onError: (e: any) => toast.error(e.message?.includes('duplicate') ? 'Code already exists' : 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('coupons' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-coupons'] }); toast.success('Coupon deleted'); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold">Coupon Management</h2>
        <Button onClick={() => { setEditCoupon({ ...emptyCoupon }); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Create Coupon
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : coupons?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No coupons yet.</TableCell></TableRow>
              ) : (
                coupons?.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-accent" />
                        <span className="font-mono font-bold">{c.code}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.discount_type === 'percentage' ? `${c.discount_value}%` : `৳${c.discount_value}`}
                      {c.max_discount_amount && <span className="text-xs text-muted-foreground ml-1">(max ৳{c.max_discount_amount})</span>}
                    </TableCell>
                    <TableCell>{c.used_count}{c.usage_limit ? `/${c.usage_limit}` : ''}</TableCell>
                    <TableCell><Badge variant={c.is_active ? 'default' : 'outline'}>{c.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.valid_until ? format(new Date(c.valid_until), 'MMM d, yyyy') : 'No expiry'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { setEditCoupon({ ...c }); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditCoupon(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editCoupon?.id ? 'Edit Coupon' : 'New Coupon'}</DialogTitle></DialogHeader>
          {editCoupon && (
            <div className="space-y-4">
              <div><Label>Coupon Code</Label><Input value={editCoupon.code} onChange={(e) => setEditCoupon({ ...editCoupon, code: e.target.value.toUpperCase() })} placeholder="SAVE20" /></div>
              <div><Label>Description</Label><Input value={editCoupon.description ?? ''} onChange={(e) => setEditCoupon({ ...editCoupon, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={editCoupon.discount_type} onValueChange={(v) => setEditCoupon({ ...editCoupon, discount_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Value</Label><Input type="number" value={editCoupon.discount_value} onChange={(e) => setEditCoupon({ ...editCoupon, discount_value: parseFloat(e.target.value) || 0 })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Min Order (৳)</Label><Input type="number" value={editCoupon.min_order_amount ?? 0} onChange={(e) => setEditCoupon({ ...editCoupon, min_order_amount: parseFloat(e.target.value) || 0 })} /></div>
                <div><Label>Max Discount (৳)</Label><Input type="number" value={editCoupon.max_discount_amount ?? ''} onChange={(e) => setEditCoupon({ ...editCoupon, max_discount_amount: e.target.value ? parseFloat(e.target.value) : null })} placeholder="No limit" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Usage Limit</Label><Input type="number" value={editCoupon.usage_limit ?? ''} onChange={(e) => setEditCoupon({ ...editCoupon, usage_limit: e.target.value ? parseInt(e.target.value) : null })} placeholder="Unlimited" /></div>
                <div><Label>Valid Until</Label><Input type="date" value={editCoupon.valid_until ? editCoupon.valid_until.slice(0, 10) : ''} onChange={(e) => setEditCoupon({ ...editCoupon, valid_until: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editCoupon.is_active} onCheckedChange={(v) => setEditCoupon({ ...editCoupon, is_active: v })} />
                <Label>Active</Label>
              </div>
              <Button className="w-full" onClick={() => saveMutation.mutate(editCoupon)} disabled={!editCoupon.code.trim()}>
                {editCoupon.id ? 'Update Coupon' : 'Create Coupon'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCoupons;
