import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Search, BarChart3, Edit, Trash2, BookOpen, Upload, X, Eye, EyeOff, AlertTriangle, CloudOff, Cloud, UserPlus, Users } from 'lucide-react';
import ContributorPickerModal, { type PickedContributor } from '@/components/shared/ContributorPickerModal';
import { useContributors, useAddContributor, useRemoveContributor } from '@/hooks/useContributors';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCmsScope } from '@/components/cms/CmsScopeContext';

interface EbookForm {
  id?: string;
  title: string;
  description: string;
  slug: string;
  category_id: number | null;
  tags: string[];
  age_restriction: string;
  price: number;
  discount_price: number | null;
  author: string;
  sub_writers: string[];
  cover_url: string;
  gallery_urls: string[];
  meta_keywords: string;
  seo_keywords: string;
  file_url: string;
  file_format: string;
  page_count: number | null;
  is_published: boolean;
}

const emptyForm: EbookForm = {
  title: '', description: '', slug: '', category_id: null, tags: [],
  age_restriction: 'none', price: 0, discount_price: null, author: '',
  sub_writers: [], cover_url: '', gallery_urls: [], meta_keywords: '',
  seo_keywords: '', file_url: '', file_format: 'pdf', page_count: null,
  is_published: false,
};

function isCloudinaryUrl(url: string): boolean {
  return url.includes('cloudinary.com') || url.includes('res.cloudinary');
}

function isR2Url(url: string): boolean {
  return url.includes('r2.dev') || url.includes('r2.cloudflarestorage.com') || url.includes('pub-');
}

function getStorageSource(url: string): 'r2' | 'cloudinary' | 'unknown' {
  if (!url) return 'unknown';
  if (isR2Url(url)) return 'r2';
  if (isCloudinaryUrl(url)) return 'cloudinary';
  return 'unknown';
}

const AdminEbooks = () => {
  const qc = useQueryClient();
  const { upload, uploading, progress } = useFileUpload();
  const { scope, userId } = useCmsScope();
  const isInstructor = scope === 'instructor';
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EbookForm>(emptyForm);
  const [statsEbook, setStatsEbook] = useState<any>(null);
  const [tagInput, setTagInput] = useState('');
  const [subWriterInput, setSubWriterInput] = useState('');
  const [fileUploadStatus, setFileUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [fileUploadError, setFileUploadError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: linkedContributors = [] } = useContributors('ebook', form.id);
  const addContributor = useAddContributor();
  const removeContributor = useRemoveContributor();

  const { data: ebooks = [], isLoading } = useQuery({
    queryKey: ['admin-ebooks', scope, userId],
    queryFn: async () => {
      let q = supabase.from('ebooks').select('*, categories(name)').order('created_at', { ascending: false });
      if (isInstructor && userId) q = q.eq('created_by', userId);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*').order('name');
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: EbookForm) => {
      // Block save if file_url points to Cloudinary
      if (data.file_url && isCloudinaryUrl(data.file_url)) {
        throw new Error('Ebook files must be stored on Cloudflare R2, not Cloudinary. Please re-upload the ebook file.');
      }
      // Block publishing without a file — students get a 404 in the reader otherwise
      if (data.is_published && (!data.file_url || data.file_url.trim().length === 0)) {
        throw new Error('Cannot publish an eBook without a PDF file. Please upload the file to Cloudflare R2 first, or save as Draft.');
      }
      // Block save while an upload is still in progress
      if (uploading) {
        throw new Error('A file upload is still in progress. Please wait for it to finish.');
      }
      const { id, ...rest } = data;
      const payload: any = {
        ...rest,
        slug: rest.slug || rest.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      };
      if (id) {
        const { error } = await supabase.from('ebooks').update(payload).eq('id', id);
        if (error) throw error;
        return id;
      } else {
        // Instructor mode: stamp ownership; admin mode: optional
        if (isInstructor && userId) payload.created_by = userId;
        const { data: inserted, error } = await supabase.from('ebooks').insert(payload).select('id').single();
        if (error) throw error;
        // Auto-link instructor as lead author contributor
        if (isInstructor && userId && inserted?.id) {
          await supabase.from('content_contributors').insert({
            content_type: 'ebook', content_id: inserted.id, user_id: userId, role: 'author', sort_order: 0,
          });
        }
        return inserted?.id;
      }
    },
    onSuccess: () => {
      toast.success('E-Book saved');
      qc.invalidateQueries({ queryKey: ['admin-ebooks'] });
      setShowForm(false);
      setForm(emptyForm);
      setFileUploadStatus('idle');
      setFileUploadError('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ebooks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['admin-ebooks'] });
    },
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await supabase.from('ebooks').update({ is_published: val }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-ebooks'] }),
  });

  const { data: stats } = useQuery({
    queryKey: ['ebook-stats', statsEbook?.id],
    enabled: !!statsEbook,
    queryFn: async () => {
      const { data: orders } = await supabase
        .from('order_items')
        .select('price, orders!inner(status, user_id)')
        .eq('item_type', 'ebook')
        .eq('item_id', statsEbook.id)
        .eq('orders.status', 'completed');
      const revenue = (orders || []).reduce((s: number, o: any) => s + (o.price || 0), 0);
      const uniqueBuyers = new Set((orders || []).map((o: any) => o.orders?.user_id)).size;
      const { count: viewCount } = await supabase
        .from('ebook_access_tokens')
        .select('id', { count: 'exact', head: true })
        .eq('ebook_id', statsEbook.id);
      return { revenue, uniqueBuyers, downloads: statsEbook.download_count || 0, views: viewCount || 0 };
    },
  });

  const openEdit = (ebook: any) => {
    setForm({
      id: ebook.id, title: ebook.title, description: ebook.description || '',
      slug: ebook.slug, category_id: ebook.category_id, tags: ebook.tags || [],
      age_restriction: ebook.age_restriction || 'none', price: ebook.price || 0,
      discount_price: ebook.discount_price, author: ebook.author || '',
      sub_writers: ebook.sub_writers || [], cover_url: ebook.cover_url || '',
      gallery_urls: ebook.gallery_urls || [], meta_keywords: ebook.meta_keywords || '',
      seo_keywords: ebook.seo_keywords || '', file_url: ebook.file_url || '',
      file_format: ebook.file_format || 'pdf', page_count: ebook.page_count,
      is_published: ebook.is_published || false,
    });
    setFileUploadStatus('idle');
    setFileUploadError('');
    setShowForm(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'cover_url' | 'file_url' | 'gallery') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (field === 'file_url') {
      setFileUploadStatus('uploading');
      setFileUploadError('');
    }

    try {
      // Ebook files (PDF/DOCX) MUST always go to R2
      const forceR2 = field === 'file_url';
      const result = await upload(file, { forceR2 });

      if (field === 'cover_url') {
        setForm(p => ({ ...p, cover_url: result.url }));
      } else if (field === 'file_url') {
        // Verify the result is actually on R2
        if (result.source !== 'r2') {
          setFileUploadStatus('error');
          setFileUploadError('File was not stored on Cloudflare R2. Please check R2 configuration.');
          toast.error('Upload went to wrong storage. Ebook files must be on Cloudflare R2.');
          return;
        }
        const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
        setForm(p => ({ ...p, file_url: result.url, file_format: ext }));
        setFileUploadStatus('success');
        toast.success('Ebook file uploaded to Cloudflare R2');
      } else {
        setForm(p => ({ ...p, gallery_urls: [...p.gallery_urls, result.url] }));
      }
    } catch (err: any) {
      const msg = err?.message || 'Upload failed';
      if (field === 'file_url') {
        setFileUploadStatus('error');
        setFileUploadError(msg);
      }
      toast.error(`Upload failed: ${msg}`);
    }
  };

  const filtered = ebooks.filter((e: any) =>
    e.title?.toLowerCase().includes(search.toLowerCase()) ||
    e.author?.toLowerCase().includes(search.toLowerCase())
  );

  const StorageBadge = ({ url }: { url: string }) => {
    const source = getStorageSource(url);
    if (source === 'r2') return <Badge className="bg-green-600 text-white text-xs">R2</Badge>;
    if (source === 'cloudinary') return <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" /> Cloudinary (Legacy)</Badge>;
    return <Badge variant="secondary" className="text-xs">Unknown</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">E-Book Management</h1>
          <p className="text-sm text-muted-foreground">{ebooks.length} e-books total</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setFileUploadStatus('idle'); setFileUploadError(''); setShowForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Add New E-Book
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search e-books..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ebook: any) => (
            <Card key={ebook.id} className="overflow-hidden">
              <div className="aspect-[3/4] bg-muted relative">
                <img src={ebook.cover_url || '/placeholder.svg'} alt={ebook.title} className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 flex gap-1">
                  <Badge variant={ebook.is_published ? 'default' : 'secondary'}>
                    {ebook.is_published ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                {/* Storage source badge for file_url */}
                {ebook.file_url && (
                  <div className="absolute top-2 left-2">
                    <StorageBadge url={ebook.file_url} />
                  </div>
                )}
              </div>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-heading font-semibold truncate">{ebook.title}</h3>
                <p className="text-sm text-muted-foreground">{ebook.author || 'Unknown author'}</p>
                {ebook.categories?.name && (
                  <Badge variant="outline" className="text-xs">{ebook.categories.name}</Badge>
                )}
                {/* Legacy warning */}
                {ebook.file_url && isCloudinaryUrl(ebook.file_url) && (
                  <div className="flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Legacy: Re-upload file to R2</span>
                  </div>
                )}
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-primary">৳{ebook.discount_price ?? ebook.price ?? 0}</span>
                  {ebook.discount_price != null && (
                    <span className="text-xs text-muted-foreground line-through">৳{ebook.price}</span>
                  )}
                </div>
                {(ebook.tags?.length > 0) && (
                  <div className="flex flex-wrap gap-1">
                    {ebook.tags.slice(0, 3).map((t: string) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-1 pt-2 border-t">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(ebook)}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setStatsEbook(ebook)}><BarChart3 className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => togglePublish.mutate({ id: ebook.id, val: !ebook.is_published })}>
                    {ebook.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm('Delete this e-book?')) deleteMutation.mutate(ebook.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Stats Dialog */}
      <Dialog open={!!statsEbook} onOpenChange={() => setStatsEbook(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Statistics: {statsEbook?.title}</DialogTitle>
            <DialogDescription>Real-time engagement and revenue data</DialogDescription>
          </DialogHeader>
          {stats && (
            <div className="grid grid-cols-2 gap-4">
              <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{stats.views}</p><p className="text-xs text-muted-foreground">Total Views</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{stats.downloads}</p><p className="text-xs text-muted-foreground">Downloads</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">৳{stats.revenue}</p><p className="text-xs text-muted-foreground">Revenue</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{stats.uniqueBuyers}</p><p className="text-xs text-muted-foreground">Unique Buyers</p></CardContent></Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit E-Book' : 'Add New E-Book'}</DialogTitle>
            <DialogDescription>Fill in the details below</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="primary" className="space-y-4">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="primary">Primary</TabsTrigger>
              <TabsTrigger value="classify">Classification</TabsTrigger>
              <TabsTrigger value="media">Media & File</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
            </TabsList>

            <TabsContent value="primary" className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} placeholder="auto-generated from title" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea rows={5} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary Writer (display name)</Label>
                  <Input value={form.author} onChange={e => setForm(p => ({ ...p, author: e.target.value }))} placeholder="e.g. John Smith" />
                  <p className="text-[11px] text-muted-foreground">Shown publicly. Use linked contributors below for clickable profiles.</p>
                </div>
                <div className="space-y-2">
                  <Label>Sub-Writers (free text fallback)</Label>
                  <Input value={subWriterInput} onChange={e => setSubWriterInput(e.target.value)} placeholder="Press Enter to add" onKeyDown={e => {
                    if (e.key === 'Enter' && subWriterInput.trim()) {
                      e.preventDefault();
                      setForm(p => ({ ...p, sub_writers: [...p.sub_writers, subWriterInput.trim()] }));
                      setSubWriterInput('');
                    }
                  }} />
                  <div className="flex flex-wrap gap-1">
                    {form.sub_writers.map((w, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">
                        {w} <X className="h-3 w-3 cursor-pointer" onClick={() => setForm(p => ({ ...p, sub_writers: p.sub_writers.filter((_, j) => j !== i) }))} />
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Linked contributor profiles */}
              {form.id ? (
                <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Linked Writer Profiles</Label>
                    <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)} className="gap-1">
                      <UserPlus className="h-3 w-3" /> Add Writer
                    </Button>
                  </div>
                  {linkedContributors.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No linked profiles. Click "Add Writer" to search and link real user accounts.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {linkedContributors.map(c => (
                        <div key={c.id} className="flex items-center gap-2 bg-background rounded-full pl-1 pr-2 py-1 border">
                          <Avatar className="h-6 w-6"><AvatarImage src={c.user_profiles?.avatar_url || ''} /><AvatarFallback className="text-xs">{c.user_profiles?.full_name?.[0] || '?'}</AvatarFallback></Avatar>
                          <span className="text-xs font-medium">{c.user_profiles?.full_name}</span>
                          <Badge variant="secondary" className="text-[10px] capitalize">{c.role.replace('_', ' ')}</Badge>
                          <button type="button" onClick={() => removeContributor.mutate({ id: c.id, contentType: 'ebook', contentId: form.id! })} className="text-muted-foreground hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground border rounded-lg p-3 bg-muted/20">💡 Save the e-book first to link writer profiles.</p>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Age Restriction</Label>
                  <Select value={form.age_restriction} onValueChange={v => setForm(p => ({ ...p, age_restriction: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="13+">13+</SelectItem>
                      <SelectItem value="16+">16+</SelectItem>
                      <SelectItem value="18+">18+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Regular Price (৳)</Label>
                  <Input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: +e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Sale Price (৳)</Label>
                  <Input type="number" value={form.discount_price ?? ''} onChange={e => setForm(p => ({ ...p, discount_price: e.target.value ? +e.target.value : null }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Page Count</Label>
                <Input type="number" value={form.page_count ?? ''} onChange={e => setForm(p => ({ ...p, page_count: e.target.value ? +e.target.value : null }))} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_published} onCheckedChange={v => setForm(p => ({ ...p, is_published: v }))} />
                <Label>Published</Label>
              </div>
            </TabsContent>

            <TabsContent value="classify" className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category_id?.toString() || ''} onValueChange={v => setForm(p => ({ ...p, category_id: v ? +v : null }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Add tag & press Enter" onKeyDown={e => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      e.preventDefault();
                      setForm(p => ({ ...p, tags: [...p.tags, tagInput.trim()] }));
                      setTagInput('');
                    }
                  }} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {form.tags.map((t, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {t} <X className="h-3 w-3 cursor-pointer" onClick={() => setForm(p => ({ ...p, tags: p.tags.filter((_, j) => j !== i) }))} />
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="media" className="space-y-4">
              <div className="space-y-2">
                <Label>Cover Image</Label>
                {form.cover_url && <img src={form.cover_url} alt="Cover" className="w-32 h-auto rounded border" />}
                <Input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'cover_url')} disabled={uploading} />
              </div>
              <div className="space-y-2">
                <Label>Gallery Images</Label>
                <div className="flex flex-wrap gap-2">
                  {form.gallery_urls.map((url, i) => (
                    <div key={i} className="relative w-20 h-20">
                      <img src={url} alt="" className="w-full h-full object-cover rounded border" />
                      <button className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs"
                        onClick={() => setForm(p => ({ ...p, gallery_urls: p.gallery_urls.filter((_, j) => j !== i) }))}>×</button>
                    </div>
                  ))}
                </div>
                <Input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'gallery')} disabled={uploading} />
              </div>
              <div className="space-y-2">
                <Label>E-Book File (PDF / DOCX / EPUB)</Label>
                <p className="text-xs text-muted-foreground">Files are uploaded to Cloudflare R2 for reliable storage</p>
                {form.file_url && (
                  <div className="flex items-center gap-2 p-2 rounded border bg-muted/50">
                    <StorageBadge url={form.file_url} />
                    <Badge variant="outline">{form.file_format.toUpperCase()}</Badge>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">{form.file_url}</span>
                    {isCloudinaryUrl(form.file_url) && (
                      <span className="text-xs text-destructive font-medium ml-auto">⚠ Re-upload required</span>
                    )}
                  </div>
                )}
                <Input type="file" accept=".pdf,.docx,.doc,.epub" onChange={e => handleFileUpload(e, 'file_url')} disabled={uploading} />
                
                {/* Upload status */}
                {fileUploadStatus === 'uploading' && (
                  <div className="space-y-1">
                    <p className="text-sm text-blue-600 animate-pulse flex items-center gap-2">
                      <Cloud className="h-4 w-4" /> Uploading to Cloudflare R2... {progress}%
                    </p>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}
                {fileUploadStatus === 'success' && (
                  <p className="text-sm text-green-600 flex items-center gap-1">✓ File uploaded to Cloudflare R2</p>
                )}
                {fileUploadStatus === 'error' && (
                  <div className="p-2 rounded border border-destructive bg-destructive/10">
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <CloudOff className="h-4 w-4" /> Upload failed
                    </p>
                    <p className="text-xs text-destructive/80 mt-1">{fileUploadError}</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4">
              <div className="space-y-2">
                <Label>Meta Keywords</Label>
                <Textarea rows={3} value={form.meta_keywords} onChange={e => setForm(p => ({ ...p, meta_keywords: e.target.value }))} placeholder="Comma-separated keywords" />
              </div>
              <div className="space-y-2">
                <Label>SEO Keywords</Label>
                <Textarea rows={3} value={form.seo_keywords} onChange={e => setForm(p => ({ ...p, seo_keywords: e.target.value }))} placeholder="SEO-optimized keywords" />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button 
              onClick={() => saveMutation.mutate(form)} 
              disabled={!form.title || saveMutation.isPending || (fileUploadStatus === 'uploading')}
            >
              {saveMutation.isPending ? 'Saving...' : form.id ? 'Update' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ContributorPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Link Writer Profiles"
        allowedRoles={['author', 'co_author', 'reviewer']}
        excludeUserIds={linkedContributors.map(c => c.user_id)}
        onConfirm={async (picks: PickedContributor[]) => {
          if (!form.id) return;
          for (const p of picks) {
            await addContributor.mutateAsync({
              contentType: 'ebook',
              contentId: form.id,
              userId: p.user_id,
              role: p.role,
            });
          }
        }}
      />
    </div>
  );
};

export default AdminEbooks;
