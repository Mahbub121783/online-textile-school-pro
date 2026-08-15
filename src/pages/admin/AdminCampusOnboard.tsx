import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Loader2, Globe, MapPin, Users, Eye, EyeOff, Pencil, Building2, ImagePlus, Unlink, Trash2 } from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const AdminCampusOnboard = () => {
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveTarget, setApproveTarget] = useState<any | null>(null);
  const [approveSlug, setApproveSlug] = useState('');
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const { upload: uploadLogo, uploading: logoUploading } = useFileUpload();
  const { upload: uploadCover, uploading: coverUploading } = useFileUpload();

  const { data: campuses = [], isLoading } = useQuery({
    queryKey: ['admin-campus-onboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('campus_onboard_requests').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
  });

  // This hosting account has no live subdomain-delete API (confirmed by
  // enumerating every uapi call it exposes -- only addsubdomain/changedocroot
  // exist), so an admin removing one directly via cPanel's own UI leaves our
  // tracking stale with no way to find out on its own. Self-heal on every
  // page load by HEAD-checking each "live" subdomain.
  useEffect(() => {
    supabase.functions.invoke('campus-verify-subdomains', { body: {} }).then(({ data }: any) => {
      if (data?.results?.some((r: any) => !r.reachable)) {
        queryClient.invalidateQueries({ queryKey: ['admin-campus-onboard'] });
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeSubdomainMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('campus-remove-subdomain', { body: { id } });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-campus-onboard'] });
      toast.success(data?.liveRemoveOk ? 'Subdomain removed' : 'Tracking reset (removal isn\'t API-possible on this hosting tier — verify it\'s gone in cPanel too)');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, subdomainSlug }: { id: string; subdomainSlug: string }) => {
      const { data, error } = await supabase.functions.invoke('campus-approve', { body: { id, subdomainSlug } });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-campus-onboard'] });
      if (data?.subdomainError) {
        toast.warning(`Approved, but subdomain setup failed: ${data.subdomainError}. Retry from the card.`);
      } else {
        toast.success(`Approved — live at ${data?.subdomain}`);
      }
      setApproveTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.functions.invoke('campus-reject', { body: { id, reason } });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campus-onboard'] });
      toast.success('Campus rejected');
      setRejectTarget(null); setRejectReason('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const provisionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('campus-provision-subdomain', { body: { id } });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-campus-onboard'] });
      toast.success(`Subdomain live: ${data?.subdomain}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const visibilityMutation = useMutation({
    mutationFn: async ({ id, is_visible }: { id: string; is_visible: boolean }) => {
      const { error } = await supabase.from('campus_onboard_requests').update({ is_visible }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-campus-onboard'] });
      toast.success(vars.is_visible ? 'Campus is now visible on the public list' : 'Campus hidden from the public list');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campus_onboard_requests').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campus-onboard'] });
      toast.success('Campus request deleted');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (fields: any) => {
      const { error } = await supabase.functions.invoke('campus-update', { body: { id: editTarget.id, ...fields } });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campus-onboard'] });
      toast.success('Campus details updated');
      setEditTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openApprove = (c: any) => { setApproveTarget(c); setApproveSlug(c.subdomain_slug); };
  const openEdit = (c: any) => {
    setEditTarget(c);
    setEditForm({
      campus_name: c.campus_name, area: c.area, facilities: c.facilities || '',
      description: c.description || '', student_count: c.student_count ?? '',
      departments: (c.departments || []).join(', '),
      contact_name: c.contact_name, contact_email: c.contact_email, contact_phone: c.contact_phone || '',
      logo_url: c.logo_url || null,
      cover_image_url: c.cover_image_url || null,
    });
  };
  const saveEdit = () => {
    updateMutation.mutate({
      ...editForm,
      student_count: editForm.student_count === '' ? null : parseInt(editForm.student_count, 10),
      departments: String(editForm.departments || '').split(',').map((d: string) => d.trim()).filter(Boolean),
    });
  };
  const handleEditLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadLogo(file, { folder: 'campus-logos' });
      setEditForm((p: any) => ({ ...p, logo_url: result.url }));
    } catch (err: any) {
      toast.error(err.message || 'Logo upload failed');
    }
  };
  const handleEditCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadCover(file, { folder: 'campus-covers' });
      setEditForm((p: any) => ({ ...p, cover_image_url: result.url }));
    } catch (err: any) {
      toast.error(err.message || 'Cover photo upload failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Campus Onboarding</h1>
        <p className="text-sm text-muted-foreground mt-1">Review campus partner requests. Approving auto-creates the subdomain — its full portfolio lives there, not on the main site. Removal isn't possible on this hosting tier, so double-check the slug before approving.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : campuses.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No campus onboarding requests yet.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {campuses.map((c: any) => (
            <Card key={c.id} className="overflow-hidden">
              {c.cover_image_url && (
                <div className="h-20 -mb-2 bg-cover bg-center" style={{ backgroundImage: `url(${c.cover_image_url})` }} />
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {c.logo_url ? (
                      <img src={c.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><Building2 className="h-4 w-4 text-muted-foreground" /></div>
                    )}
                    <CardTitle className="text-base truncate">{c.campus_name}</CardTitle>
                  </div>
                  <Badge className={`${statusColors[c.status]} capitalize shrink-0`}>{c.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {c.area}</p>
                {c.student_count != null && <p className="flex items-center gap-1.5 text-muted-foreground"><Users className="h-3.5 w-3.5" /> {c.student_count} students</p>}
                {c.departments?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {c.departments.map((d: string) => <Badge key={d} variant="secondary" className="text-[10px]">{d}</Badge>)}
                  </div>
                )}
                {c.facilities && <p className="text-foreground/80">{c.facilities}</p>}
                <div className="border-t pt-2 mt-2 space-y-0.5 text-xs text-muted-foreground">
                  <p>Contact: {c.contact_name} · {c.contact_email} {c.contact_phone && `· ${c.contact_phone}`}</p>
                  <p>Subdomain: <span className="font-mono">{c.subdomain_slug}.onlinetextileschool.com</span></p>
                  <p>Submitted {format(new Date(c.created_at), 'dd MMM yyyy')}</p>
                  {c.rejection_reason && <p className="text-destructive">Rejected: {c.rejection_reason}</p>}
                  {c.subdomain_error && <p className="text-destructive">Subdomain error: {c.subdomain_error}</p>}
                </div>

                {c.status === 'pending' && (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="flex-1" onClick={() => openApprove(c)} disabled={approveMutation.isPending}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => setRejectTarget(c.id)}>
                      <XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject
                    </Button>
                  </div>
                )}
                {c.status === 'approved' && !c.subdomain_provisioned && (
                  <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => provisionMutation.mutate(c.id)} disabled={provisionMutation.isPending}>
                    {provisionMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Globe className="h-3.5 w-3.5 mr-1.5" />}
                    Retry Subdomain Setup
                  </Button>
                )}
                {c.subdomain_provisioned && (
                  <div className="flex items-center justify-between gap-2 pt-2">
                    <a href={`https://${c.subdomain_slug}.onlinetextileschool.com`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary text-sm hover:underline min-w-0 truncate">
                      <Globe className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{c.subdomain_slug}.onlinetextileschool.com (live)</span>
                    </a>
                    <Button
                      size="sm" variant="ghost" className="text-destructive hover:text-destructive shrink-0 h-7 px-2"
                      onClick={() => {
                        if (confirm(`Remove ${c.subdomain_slug}.onlinetextileschool.com? This resets tracking; if it still exists in cPanel you'll need to delete it there too.`)) {
                          removeSubdomainMutation.mutate(c.id);
                        }
                      }}
                      disabled={removeSubdomainMutation.isPending}
                    >
                      {removeSubdomainMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(c)}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Details
                  </Button>
                  {c.status === 'approved' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => visibilityMutation.mutate({ id: c.id, is_visible: !c.is_visible })}
                      disabled={visibilityMutation.isPending}
                    >
                      {c.is_visible === false ? (
                        <><Eye className="h-3.5 w-3.5 mr-1.5" /> Unhide</>
                      ) : (
                        <><EyeOff className="h-3.5 w-3.5 mr-1.5" /> Hide</>
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm" variant="outline" className="text-destructive hover:text-destructive px-2"
                    onClick={() => {
                      if (confirm(`Delete the campus request "${c.campus_name}"? This only removes the request/portfolio record, not any provisioned subdomain.`)) {
                        deleteMutation.mutate(c.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {c.is_visible === false && (
                  <Badge variant="outline" className="text-xs">Hidden from public</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approve + confirm/edit subdomain */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve {approveTarget?.campus_name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Subdomain</Label>
            <div className="flex items-center gap-1.5">
              <Input value={approveSlug} onChange={(e) => setApproveSlug(slugify(e.target.value))} />
              <span className="text-sm text-muted-foreground whitespace-nowrap">.onlinetextileschool.com</span>
            </div>
            <p className="text-xs text-muted-foreground">This subdomain is created automatically on approval and can't be removed afterward on this hosting plan — double-check it.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>Cancel</Button>
            <Button
              onClick={() => approveTarget && approveMutation.mutate({ id: approveTarget.id, subdomainSlug: approveSlug })}
              disabled={approveMutation.isPending || !approveSlug}
            >
              {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Approve & Create Subdomain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Campus Request</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason (optional)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectTarget && rejectMutation.mutate({ id: rejectTarget, reason: rejectReason })} disabled={rejectMutation.isPending}>
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deep edit */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit {editTarget?.campus_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Cover Photo</Label>
              <div className="w-full h-24 rounded-lg border overflow-hidden bg-muted/30 flex items-center justify-center">
                {editForm.cover_image_url ? <img src={editForm.cover_image_url} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
              </div>
              <Input type="file" accept="image/*" onChange={handleEditCoverUpload} disabled={coverUploading} className="text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-lg border overflow-hidden bg-muted/30 flex items-center justify-center shrink-0">
                  {editForm.logo_url ? <img src={editForm.logo_url} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
                </div>
                <Input type="file" accept="image/*" onChange={handleEditLogoUpload} disabled={logoUploading} className="text-xs" />
              </div>
            </div>
            <div className="space-y-1.5"><Label>Campus Name</Label><Input value={editForm.campus_name || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, campus_name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Area</Label><Input value={editForm.area || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, area: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Student Count</Label><Input type="number" value={editForm.student_count} onChange={(e) => setEditForm((p: any) => ({ ...p, student_count: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Departments (comma-separated)</Label><Input value={editForm.departments || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, departments: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Facilities</Label><Textarea rows={3} value={editForm.facilities || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, facilities: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={3} value={editForm.description || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, description: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Contact Name</Label><Input value={editForm.contact_name || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, contact_name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Contact Email</Label><Input value={editForm.contact_email || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, contact_email: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Contact Phone</Label><Input value={editForm.contact_phone || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, contact_phone: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCampusOnboard;
