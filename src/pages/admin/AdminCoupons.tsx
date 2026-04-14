import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Tag, Search } from 'lucide-react';
import { format } from 'date-fns';

const emptyCoupon = {
  code: '', description: '', discount_type: 'percentage', discount_value: 0,
  min_order_amount: 0, max_discount_amount: null as number | null, usage_limit: null as number | null,
  per_user_limit: null as number | null,
  valid_until: '', is_active: true, applicable_to: 'all',
  applicable_type: 'all', applicable_ids: null as string[] | null,
};

const AdminCoupons = () => {
  const [editCoupon, setEditCoupon] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: coupons, isLoading } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => {
      const { data } = await supabase.from('coupons' as any).select('*').order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['coupon-courses'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').order('title');
      return data ?? [];
    },
  });

  const { data: ebooks = [] } = useQuery({
    queryKey: ['coupon-ebooks'],
    queryFn: async () => {
      const { data } = await supabase.from('ebooks').select('id, title').order('title');
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (coupon: any) => {
      const { id, created_at, used_count, ...rest } = coupon;
      if (!rest.valid_until) rest.valid_until = null;
      if (!rest.max_discount_amount) rest.max_discount_amount = null;
      if (!rest.usage_limit) rest.usage_limit = null;
      if (!rest.per_user_limit) rest.per_user_limit = null;
      if (rest.applicable_type === 'all') rest.applicable_ids = null;
      if (rest.applicable_ids && rest.applicable_ids.length === 0) rest.applicable_ids = null;

      if (id) {
        const { error } = await supabase.from('coupons' as any).update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('coupons' as any).insert(rest);
        if (error) throw error;
      }
      await supabase.from('admin_activity_log').insert({ admin_id: user!.id, action: id ? 'Updated coupon' : 'Created coupon', target_type: 'coupon', target_id: id || rest.code });
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

  const getItemsForType = () => {
    if (!editCoupon) return [];
    if (editCoupon.applicable_type === 'course') return courses;
    if (editCoupon.applicable_type === 'ebook') return ebooks;
    return [];
  };

  const filteredItems = getItemsForType().filter((item: any) =>
    item.title.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const toggleItemId = (itemId: string) => {
    const current = editCoupon.applicable_ids || [];
    const updated = current.includes(itemId)
      ? current.filter((id: string) => id !== itemId)
      : [...current, itemId];
    setEditCoupon({ ...editCoupon, applicable_ids: updated });
  };

  const applicableLabel = (type: string, ids: string[] | null) => {
    if (type === 'all') return 'All';
    const label = type === 'course' ? 'Courses' : type === 'ebook' ? 'Ebooks' : type;
    if (ids && ids.length > 0) return `${ids.length} ${label}`;
    return `All ${label}`;
  };

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
                <TableHead>Per User</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : coupons?.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No coupons yet.</TableCell></TableRow>
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
                    <TableCell>{c.per_user_limit ? `${c.per_user_limit}x` : '∞'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {applicableLabel(c.applicable_type || 'all', c.applicable_ids)}
                      </Badge>
                    </TableCell>
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

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditCoupon(null); setItemSearch(''); } }}>
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
                <div><Label>Global Usage Limit</Label><Input type="number" value={editCoupon.usage_limit ?? ''} onChange={(e) => setEditCoupon({ ...editCoupon, usage_limit: e.target.value ? parseInt(e.target.value) : null })} placeholder="Unlimited" /></div>
                <div><Label>Per-User Limit</Label><Input type="number" value={editCoupon.per_user_limit ?? ''} onChange={(e) => setEditCoupon({ ...editCoupon, per_user_limit: e.target.value ? parseInt(e.target.value) : null })} placeholder="Unlimited" /></div>
              </div>
              <div><Label>Valid Until</Label><Input type="date" value={editCoupon.valid_until ? editCoupon.valid_until.slice(0, 10) : ''} onChange={(e) => setEditCoupon({ ...editCoupon, valid_until: e.target.value })} /></div>

              {/* Applicable Scope */}
              <div className="space-y-2">
                <Label>Applies To</Label>
                <Select value={editCoupon.applicable_type || 'all'} onValueChange={(v) => setEditCoupon({ ...editCoupon, applicable_type: v, applicable_ids: null })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    <SelectItem value="course">Courses Only</SelectItem>
                    <SelectItem value="ebook">Ebooks Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Item picker when course or ebook selected */}
              {(editCoupon.applicable_type === 'course' || editCoupon.applicable_type === 'ebook') && (
                <div className="space-y-2">
                  <Label>
                    Specific {editCoupon.applicable_type === 'course' ? 'Courses' : 'Ebooks'} (optional — leave empty for all)
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder={`Search ${editCoupon.applicable_type}s...`}
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-40 border rounded-md p-2">
                    {filteredItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No items found</p>
                    ) : (
                      filteredItems.map((item: any) => (
                        <label key={item.id} className="flex items-center gap-2 py-1.5 px-1 hover:bg-muted/50 rounded cursor-pointer">
                          <Checkbox
                            checked={(editCoupon.applicable_ids || []).includes(item.id)}
                            onCheckedChange={() => toggleItemId(item.id)}
                          />
                          <span className="text-sm truncate">{item.title}</span>
                        </label>
                      ))
                    )}
                  </ScrollArea>
                  {editCoupon.applicable_ids?.length > 0 && (
                    <p className="text-xs text-muted-foreground">{editCoupon.applicable_ids.length} item(s) selected</p>
                  )}
                </div>
              )}

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
