import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ImageCropUpload from '@/components/shared/ImageCropUpload';
import FabricLibrarySection from '@/components/campus/FabricLibrarySection';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Shirt, Loader2, Plus, Pencil, PackagePlus, Send, Building2, MapPin } from 'lucide-react';

const statusColors: Record<string, string> = {
  'not started': 'bg-muted text-muted-foreground',
  ongoing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

const AdminFabricLibrary = () => {
  const queryClient = useQueryClient();

  // ---------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------
  const { data: hangers = [], isLoading: hangersLoading } = useQuery({
    queryKey: ['fabric-hangers-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fabric_hangers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ['fabric-ledger-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fabric_hanger_stock_transactions').select('type, quantity');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: approvedCampuses = [] } = useQuery({
    queryKey: ['fabric-approved-campuses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('campus_onboard_requests').select('id, campus_name, logo_url').eq('status', 'approved').order('campus_name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: libraries = [], isLoading: librariesLoading } = useQuery({
    queryKey: ['fabric-libraries-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campus_fabric_libraries')
        .select('*, campus:campus_onboard_requests(campus_name, logo_url)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const totalReceived = ledger.filter((t: any) => t.type === 'received' || t.type === 'returned').reduce((s: number, t: any) => s + t.quantity, 0);
  const totalDistributed = ledger.filter((t: any) => t.type === 'distributed').reduce((s: number, t: any) => s + t.quantity, 0);
  const totalRemaining = hangers.reduce((s: number, h: any) => s + (h.current_stock || 0), 0);

  const librariesByCampus = new Map(libraries.map((l: any) => [l.campus_id, l]));

  // ---------------------------------------------------------------
  // Hanger catalog (create/edit)
  // ---------------------------------------------------------------
  const [hangerDialogOpen, setHangerDialogOpen] = useState(false);
  const [hangerForm, setHangerForm] = useState<any>({ id: null, name: '', fabric_type: '', code: '', description: '', image_url: null });

  const openCreateHanger = () => { setHangerForm({ id: null, name: '', fabric_type: '', code: '', description: '', image_url: null }); setHangerDialogOpen(true); };
  const openEditHanger = (h: any) => { setHangerForm({ id: h.id, name: h.name, fabric_type: h.fabric_type || '', code: h.code || '', description: h.description || '', image_url: h.image_url }); setHangerDialogOpen(true); };

  const saveHangerMutation = useMutation({
    mutationFn: async () => {
      const action = hangerForm.id ? 'fabric-hanger-update' : 'fabric-hanger-create';
      const body = hangerForm.id
        ? { id: hangerForm.id, name: hangerForm.name, fabric_type: hangerForm.fabric_type, code: hangerForm.code, description: hangerForm.description, image_url: hangerForm.image_url }
        : { name: hangerForm.name, fabric_type: hangerForm.fabric_type, code: hangerForm.code, description: hangerForm.description, image_url: hangerForm.image_url };
      const { error } = await supabase.functions.invoke(action, { body });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fabric-hangers-admin'] });
      toast.success(hangerForm.id ? 'Hanger updated' : 'Hanger added to catalog');
      setHangerDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ---------------------------------------------------------------
  // Receive stock
  // ---------------------------------------------------------------
  const [receiveTarget, setReceiveTarget] = useState<any | null>(null);
  const [receiveQty, setReceiveQty] = useState('');
  const [receiveNote, setReceiveNote] = useState('');

  const receiveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('fabric-stock-receive', {
        body: { hanger_id: receiveTarget.id, quantity: parseInt(receiveQty, 10), note: receiveNote || undefined },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fabric-hangers-admin'] });
      queryClient.invalidateQueries({ queryKey: ['fabric-ledger-admin'] });
      toast.success('Stock received');
      setReceiveTarget(null); setReceiveQty(''); setReceiveNote('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ---------------------------------------------------------------
  // Distribute
  // ---------------------------------------------------------------
  const [distCampusId, setDistCampusId] = useState('');
  const [distHangerId, setDistHangerId] = useState('');
  const [distQty, setDistQty] = useState('');
  const [distNote, setDistNote] = useState('');

  const distributeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('fabric-distribute', {
        body: { campus_id: distCampusId, hanger_id: distHangerId, quantity: parseInt(distQty, 10), note: distNote || undefined },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fabric-hangers-admin'] });
      queryClient.invalidateQueries({ queryKey: ['fabric-ledger-admin'] });
      queryClient.invalidateQueries({ queryKey: ['fabric-distributions', distCampusId] });
      toast.success('Hangers distributed');
      setDistCampusId(''); setDistHangerId(''); setDistQty(''); setDistNote('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ---------------------------------------------------------------
  // Campuses -- start a library
  // ---------------------------------------------------------------
  const [manageLibraryCampusId, setManageLibraryCampusId] = useState<string | null>(null);

  const startLibraryMutation = useMutation({
    mutationFn: async (campus_id: string) => {
      const { error } = await supabase.functions.invoke('fabric-library-start', { body: { campus_id } });
      if (error) throw error;
    },
    onSuccess: (_d, campus_id) => {
      queryClient.invalidateQueries({ queryKey: ['fabric-libraries-admin'] });
      toast.success('Fabric Library started');
      setManageLibraryCampusId(campus_id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><Shirt className="h-6 w-6" /> Fabric Library</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage the central fabric hanger catalog and stock, distribute hangers to campuses, and track each campus's library progress.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-2xl font-heading font-black tabular-nums">{totalReceived}</p>
          <p className="text-sm text-muted-foreground">Total Received</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-2xl font-heading font-black tabular-nums">{totalDistributed}</p>
          <p className="text-sm text-muted-foreground">Total Distributed</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-2xl font-heading font-black tabular-nums">{totalRemaining}</p>
          <p className="text-sm text-muted-foreground">Remaining in Stock</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="distribute">Distribute</TabsTrigger>
          <TabsTrigger value="campuses">Campuses</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="pt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={openCreateHanger}><Plus className="h-3.5 w-3.5 mr-1.5" /> Add Hanger Type</Button>
          </div>
          {hangersLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : hangers.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No fabric hangers in the catalog yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {hangers.map((h: any) => (
                <Card key={h.id}>
                  <CardContent className="pt-6 space-y-2">
                    <div className="flex items-start gap-3">
                      {h.image_url ? (
                        <img src={h.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0"><Shirt className="h-5 w-5 text-muted-foreground" /></div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{h.name}</p>
                        <p className="text-xs text-muted-foreground">{[h.fabric_type, h.code].filter(Boolean).join(' · ') || '—'}</p>
                      </div>
                    </div>
                    <p className="text-sm"><span className="font-semibold tabular-nums">{h.current_stock}</span> <span className="text-muted-foreground">in stock</span></p>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => { setReceiveTarget(h); setReceiveQty(''); setReceiveNote(''); }}>
                        <PackagePlus className="h-3.5 w-3.5 mr-1.5" /> Receive Stock
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEditHanger(h)}><Pencil className="h-3.5 w-3.5" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="distribute" className="pt-4">
          <Card className="max-w-lg">
            <CardHeader><CardTitle className="text-base">Send Hangers to a Campus</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Campus</Label>
                <Select value={distCampusId} onValueChange={setDistCampusId}>
                  <SelectTrigger><SelectValue placeholder="Select an approved campus" /></SelectTrigger>
                  <SelectContent>{approvedCampuses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.campus_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Hanger</Label>
                <Select value={distHangerId} onValueChange={setDistHangerId}>
                  <SelectTrigger><SelectValue placeholder="Select a hanger type" /></SelectTrigger>
                  <SelectContent>{hangers.map((h: any) => <SelectItem key={h.id} value={h.id}>{h.name} ({h.current_stock} in stock)</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" min={1} value={distQty} onChange={(e) => setDistQty(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Note (optional)</Label><Textarea rows={2} value={distNote} onChange={(e) => setDistNote(e.target.value)} /></div>
              <Button
                className="w-full"
                onClick={() => distributeMutation.mutate()}
                disabled={distributeMutation.isPending || !distCampusId || !distHangerId || !distQty || parseInt(distQty, 10) <= 0}
              >
                {distributeMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                Distribute
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campuses" className="pt-4 space-y-4">
          {librariesLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : approvedCampuses.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No approved campuses yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {approvedCampuses.map((c: any) => {
                const lib = librariesByCampus.get(c.id) as any;
                const status = lib ? lib.status : 'not started';
                return (
                  <Card key={c.id}>
                    <CardContent className="pt-6 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {c.logo_url ? (
                            <img src={c.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><Building2 className="h-4 w-4 text-muted-foreground" /></div>
                          )}
                          <p className="font-semibold truncate">{c.campus_name}</p>
                        </div>
                        <Badge className={`${statusColors[status]} capitalize shrink-0`}>{status}</Badge>
                      </div>
                      {lib ? (
                        <>
                          <p className="text-xs text-muted-foreground">Started {format(new Date(lib.started_at), 'dd MMM yyyy')}</p>
                          <Button size="sm" variant="outline" className="w-full" onClick={() => setManageLibraryCampusId(c.id)}>Manage</Button>
                        </>
                      ) : (
                        <Button size="sm" className="w-full" onClick={() => startLibraryMutation.mutate(c.id)} disabled={startLibraryMutation.isPending}>
                          {startLibraryMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                          Start Fabric Library
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add / edit hanger */}
      <Dialog open={hangerDialogOpen} onOpenChange={setHangerDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{hangerForm.id ? 'Edit Hanger' : 'Add Hanger Type'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <ImageCropUpload value={hangerForm.image_url} onChange={(url) => setHangerForm((p: any) => ({ ...p, image_url: url }))} aspect={1} shape="square" folder="fabric-hangers" label="Photo" />
            <div className="space-y-1.5"><Label>Name</Label><Input value={hangerForm.name} onChange={(e) => setHangerForm((p: any) => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Fabric Type</Label><Input value={hangerForm.fabric_type} onChange={(e) => setHangerForm((p: any) => ({ ...p, fabric_type: e.target.value }))} placeholder="e.g. Cotton, Denim, Silk" /></div>
            <div className="space-y-1.5"><Label>Code</Label><Input value={hangerForm.code} onChange={(e) => setHangerForm((p: any) => ({ ...p, code: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={3} value={hangerForm.description} onChange={(e) => setHangerForm((p: any) => ({ ...p, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHangerDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveHangerMutation.mutate()} disabled={saveHangerMutation.isPending || !hangerForm.name.trim()}>
              {saveHangerMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive stock */}
      <Dialog open={!!receiveTarget} onOpenChange={(o) => !o && setReceiveTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Receive Stock — {receiveTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" min={1} value={receiveQty} onChange={(e) => setReceiveQty(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Note (optional)</Label><Textarea rows={2} value={receiveNote} onChange={(e) => setReceiveNote(e.target.value)} placeholder="e.g. supplier / batch reference" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveTarget(null)}>Cancel</Button>
            <Button onClick={() => receiveMutation.mutate()} disabled={receiveMutation.isPending || !receiveQty || parseInt(receiveQty, 10) <= 0}>
              {receiveMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Add to Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage a campus's fabric library */}
      <Dialog open={!!manageLibraryCampusId} onOpenChange={(o) => !o && setManageLibraryCampusId(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> {approvedCampuses.find((c: any) => c.id === manageLibraryCampusId)?.campus_name}
            </DialogTitle>
          </DialogHeader>
          {manageLibraryCampusId && <FabricLibrarySection campusId={manageLibraryCampusId} mode="manage" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFabricLibrary;
