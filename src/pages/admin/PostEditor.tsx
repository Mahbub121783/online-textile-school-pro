import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ContentBlock } from '@/components/cms/BlockRenderer';
import BlockRenderer from '@/components/cms/BlockRenderer';
import RichTextEditor from '@/components/instructor/RichTextEditor';
import MediaPickerModal from '@/components/shared/MediaPickerModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  ArrowLeft, Save, Eye, Plus, Trash2, ChevronUp, ChevronDown, Copy,
  Type, Image, Video, MousePointer, Columns, Space, Code, Heading,
  Quote, List, Table, Minus, AlertTriangle, Images, Globe, X, ImageIcon,
  GripVertical,
} from 'lucide-react';

const BLOCK_CATEGORIES = [
  {
    label: 'Text',
    blocks: [
      { type: 'text', label: 'Rich Text', icon: Type },
      { type: 'heading', label: 'Heading', icon: Heading },
      { type: 'quote', label: 'Quote', icon: Quote },
      { type: 'list', label: 'List', icon: List },
      { type: 'code', label: 'Code', icon: Code },
    ],
  },
  {
    label: 'Media',
    blocks: [
      { type: 'image', label: 'Image', icon: Image },
      { type: 'gallery', label: 'Gallery', icon: Images },
      { type: 'video', label: 'Video', icon: Video },
      { type: 'embed', label: 'Embed', icon: Globe },
    ],
  },
  {
    label: 'Layout',
    blocks: [
      { type: 'columns', label: 'Columns', icon: Columns },
      { type: 'spacer', label: 'Spacer', icon: Space },
      { type: 'divider', label: 'Divider', icon: Minus },
      { type: 'button', label: 'Button', icon: MousePointer },
    ],
  },
  {
    label: 'Advanced',
    blocks: [
      { type: 'callout', label: 'Callout', icon: AlertTriangle },
      { type: 'table', label: 'Table', icon: Table },
      { type: 'html', label: 'Raw HTML', icon: Code },
    ],
  },
];

function createDefaultBlock(type: string): ContentBlock {
  const base = { id: crypto.randomUUID(), type: type as ContentBlock['type'] };
  switch (type) {
    case 'text': return { ...base, content: '' };
    case 'heading': return { ...base, content: 'Heading', headingLevel: 2 };
    case 'quote': return { ...base, content: '', citation: '' };
    case 'list': return { ...base, listItems: ['Item 1', 'Item 2', 'Item 3'], listType: 'unordered' };
    case 'code': return { ...base, content: '', codeLanguage: '' };
    case 'image': return { ...base, url: '', alt: '' };
    case 'gallery': return { ...base, galleryUrls: [] };
    case 'video': return { ...base, url: '' };
    case 'embed': return { ...base, embedUrl: '' };
    case 'columns': return { ...base, columns: [[], []] };
    case 'spacer': return { ...base, height: 40 };
    case 'divider': return { ...base };
    case 'button': return { ...base, buttonText: 'Click Me', buttonUrl: '/', buttonVariant: 'default' };
    case 'callout': return { ...base, content: '', calloutType: 'info' };
    case 'table': return { ...base, tableData: { headers: ['Header 1', 'Header 2', 'Header 3'], rows: [['', '', ''], ['', '', '']] } };
    case 'html': return { ...base, html: '' };
    default: return { ...base };
  }
}

// ── Inline Block Editor ──
const BlockEditor = ({
  block, onUpdate, onRemove, onMoveUp, onMoveDown, onDuplicate, isFirst, isLast,
}: {
  block: ContentBlock; onUpdate: (u: Partial<ContentBlock>) => void;
  onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void;
  onDuplicate: () => void; isFirst: boolean; isLast: boolean;
}) => {
  const [mediaPicker, setMediaPicker] = useState(false);
  const [galleryPicker, setGalleryPicker] = useState(false);

  return (
    <div className="group relative border rounded-lg bg-card hover:shadow-sm transition-shadow">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-muted/30 rounded-t-lg">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        <Badge variant="outline" className="text-[10px] uppercase h-5">{block.type}</Badge>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={isFirst}><ChevronUp className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={isLast}><ChevronDown className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>

      <div className="p-3">
        {/* TEXT */}
        {block.type === 'text' && (
          <RichTextEditor value={block.content || ''} onChange={(v) => onUpdate({ content: v })} minHeight="120px" />
        )}

        {/* HEADING */}
        {block.type === 'heading' && (
          <div className="space-y-2">
            <Select value={String(block.headingLevel || 2)} onValueChange={(v) => onUpdate({ headingLevel: parseInt(v) as 2 | 3 | 4 })}>
              <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">H2</SelectItem>
                <SelectItem value="3">H3</SelectItem>
                <SelectItem value="4">H4</SelectItem>
              </SelectContent>
            </Select>
            <Input value={block.content || ''} onChange={(e) => onUpdate({ content: e.target.value })} className="text-xl font-bold border-0 border-b rounded-none px-0 focus-visible:ring-0" placeholder="Enter heading..." />
          </div>
        )}

        {/* QUOTE */}
        {block.type === 'quote' && (
          <div className="space-y-2">
            <Textarea value={block.content || ''} onChange={(e) => onUpdate({ content: e.target.value })} placeholder="Quote text..." rows={3} />
            <Input value={block.citation || ''} onChange={(e) => onUpdate({ citation: e.target.value })} placeholder="Citation (optional)" className="text-sm" />
          </div>
        )}

        {/* LIST */}
        {block.type === 'list' && (
          <div className="space-y-2">
            <Select value={block.listType || 'unordered'} onValueChange={(v) => onUpdate({ listType: v as 'ordered' | 'unordered' })}>
              <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unordered">Bullet List</SelectItem>
                <SelectItem value="ordered">Numbered List</SelectItem>
              </SelectContent>
            </Select>
            {(block.listItems || []).map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground w-5">{block.listType === 'ordered' ? `${i + 1}.` : '•'}</span>
                <Input
                  value={item}
                  onChange={(e) => {
                    const items = [...(block.listItems || [])];
                    items[i] = e.target.value;
                    onUpdate({ listItems: items });
                  }}
                  className="h-8 text-sm"
                />
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => {
                  const items = (block.listItems || []).filter((_, idx) => idx !== i);
                  onUpdate({ listItems: items });
                }}><X className="h-3 w-3" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => onUpdate({ listItems: [...(block.listItems || []), ''] })}>
              <Plus className="h-3 w-3 mr-1" /> Add Item
            </Button>
          </div>
        )}

        {/* CODE */}
        {block.type === 'code' && (
          <div className="space-y-2">
            <Input value={block.codeLanguage || ''} onChange={(e) => onUpdate({ codeLanguage: e.target.value })} placeholder="Language (e.g. javascript)" className="h-8 text-sm w-48" />
            <Textarea value={block.content || ''} onChange={(e) => onUpdate({ content: e.target.value })} rows={6} className="font-mono text-sm" placeholder="// Your code here..." />
          </div>
        )}

        {/* IMAGE */}
        {block.type === 'image' && (
          <div className="space-y-3">
            {block.url ? (
              <div className="relative">
                <img src={block.url} alt={block.alt || ''} className="w-full max-h-64 object-contain rounded-lg border" />
                <Button variant="secondary" size="sm" className="absolute top-2 right-2" onClick={() => setMediaPicker(true)}>Change</Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setMediaPicker(true)}>
                <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Click to select image</p>
              </div>
            )}
            <Input value={block.alt || ''} onChange={(e) => onUpdate({ alt: e.target.value })} placeholder="Alt text..." className="text-sm" />
            <MediaPickerModal open={mediaPicker} onClose={() => setMediaPicker(false)} onSelect={(url) => { onUpdate({ url }); setMediaPicker(false); }} accept="image/*" />
          </div>
        )}

        {/* GALLERY */}
        {block.type === 'gallery' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(block.galleryUrls || []).map((url, i) => (
                <div key={i} className="relative aspect-square">
                  <img src={url} className="w-full h-full object-cover rounded-lg" />
                  <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5" onClick={() => {
                    onUpdate({ galleryUrls: (block.galleryUrls || []).filter((_, idx) => idx !== i) });
                  }}><X className="h-3 w-3" /></Button>
                </div>
              ))}
              <div className="aspect-square border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-primary/50" onClick={() => setGalleryPicker(true)}>
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
            <MediaPickerModal open={galleryPicker} onClose={() => setGalleryPicker(false)} onSelect={(url) => { onUpdate({ galleryUrls: [...(block.galleryUrls || []), url] }); setGalleryPicker(false); }} accept="image/*" />
          </div>
        )}

        {/* VIDEO */}
        {block.type === 'video' && (
          <Input value={block.url || ''} onChange={(e) => onUpdate({ url: e.target.value })} placeholder="YouTube or Vimeo URL..." />
        )}

        {/* EMBED */}
        {block.type === 'embed' && (
          <Input value={block.embedUrl || ''} onChange={(e) => onUpdate({ embedUrl: e.target.value })} placeholder="Embed URL..." />
        )}

        {/* BUTTON */}
        {block.type === 'button' && (
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Text</Label><Input value={block.buttonText || ''} onChange={(e) => onUpdate({ buttonText: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">URL</Label><Input value={block.buttonUrl || ''} onChange={(e) => onUpdate({ buttonUrl: e.target.value })} className="h-8" /></div>
            <div><Label className="text-xs">Variant</Label>
              <Select value={block.buttonVariant || 'default'} onValueChange={(v) => onUpdate({ buttonVariant: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="default">Primary</SelectItem><SelectItem value="outline">Outline</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* SPACER */}
        {block.type === 'spacer' && (
          <div className="flex items-center gap-3">
            <Label className="text-xs shrink-0">Height (px)</Label>
            <Input type="number" value={block.height || 40} onChange={(e) => onUpdate({ height: parseInt(e.target.value) || 40 })} className="h-8 w-24" />
          </div>
        )}

        {/* DIVIDER - nothing to edit */}
        {block.type === 'divider' && (
          <hr className="border-border my-2" />
        )}

        {/* CALLOUT */}
        {block.type === 'callout' && (
          <div className="space-y-2">
            <Select value={block.calloutType || 'info'} onValueChange={(v) => onUpdate({ calloutType: v as 'info' | 'warning' | 'success' })}>
              <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">ℹ️ Info</SelectItem>
                <SelectItem value="warning">⚠️ Warning</SelectItem>
                <SelectItem value="success">✅ Success</SelectItem>
              </SelectContent>
            </Select>
            <RichTextEditor value={block.content || ''} onChange={(v) => onUpdate({ content: v })} minHeight="80px" />
          </div>
        )}

        {/* TABLE */}
        {block.type === 'table' && <TableBlockEditor tableData={block.tableData} onUpdate={(td) => onUpdate({ tableData: td })} />}

        {/* HTML */}
        {block.type === 'html' && (
          <Textarea value={block.html || ''} onChange={(e) => onUpdate({ html: e.target.value })} rows={6} className="font-mono text-sm" placeholder="Raw HTML..." />
        )}

        {/* COLUMNS */}
        {block.type === 'columns' && (
          <div className="text-sm text-muted-foreground text-center py-4">
            Column editing available in Page Editor. Content renders as {block.columns?.length || 2} columns.
          </div>
        )}
      </div>
    </div>
  );
};

// ── Table Block Editor ──
const TableBlockEditor = ({ tableData, onUpdate }: { tableData?: ContentBlock['tableData']; onUpdate: (d: ContentBlock['tableData']) => void }) => {
  const data = tableData || { headers: ['H1', 'H2', 'H3'], rows: [['', '', '']] };

  const updateHeader = (i: number, val: string) => {
    const headers = [...data.headers]; headers[i] = val;
    onUpdate({ ...data, headers });
  };
  const updateCell = (ri: number, ci: number, val: string) => {
    const rows = data.rows.map(r => [...r]); rows[ri][ci] = val;
    onUpdate({ ...data, rows });
  };
  const addRow = () => onUpdate({ ...data, rows: [...data.rows, data.headers.map(() => '')] });
  const addCol = () => onUpdate({ headers: [...data.headers, `H${data.headers.length + 1}`], rows: data.rows.map(r => [...r, '']) });
  const removeRow = (i: number) => onUpdate({ ...data, rows: data.rows.filter((_, idx) => idx !== i) });
  const removeCol = (i: number) => onUpdate({ headers: data.headers.filter((_, idx) => idx !== i), rows: data.rows.map(r => r.filter((_, idx) => idx !== i)) });

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              {data.headers.map((h, i) => (
                <th key={i} className="p-1 border-b border-r last:border-r-0">
                  <div className="flex items-center gap-1">
                    <Input value={h} onChange={(e) => updateHeader(i, e.target.value)} className="h-7 text-xs font-semibold border-0 bg-transparent focus-visible:ring-0" />
                    {data.headers.length > 1 && <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => removeCol(i)}><X className="h-3 w-3" /></Button>}
                  </div>
                </th>
              ))}
              <th className="w-8 p-1 border-b" />
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="p-1 border-b border-r last:border-r-0">
                    <Input value={cell} onChange={(e) => updateCell(ri, ci, e.target.value)} className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0" />
                  </td>
                ))}
                <td className="p-1 border-b w-8">
                  {data.rows.length > 1 && <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeRow(ri)}><X className="h-3 w-3" /></Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={addRow}><Plus className="h-3 w-3 mr-1" /> Row</Button>
        <Button variant="outline" size="sm" onClick={addCol}><Plus className="h-3 w-3 mr-1" /> Column</Button>
      </div>
    </div>
  );
};

// ── Block Inserter ──
const BlockInserter = ({ onInsert }: { onInsert: (type: string) => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex items-center justify-center py-1">
      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-primary border border-dashed border-transparent hover:border-border rounded-full px-3" onClick={() => setOpen(!open)}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add Block
      </Button>
      {open && (
        <div className="absolute top-full mt-1 z-50 bg-popover border rounded-xl shadow-xl p-3 w-[420px] max-h-[360px] overflow-y-auto">
          {BLOCK_CATEGORIES.map(cat => (
            <div key={cat.label} className="mb-3 last:mb-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 px-1">{cat.label}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {cat.blocks.map(b => (
                  <button key={b.type} onClick={() => { onInsert(b.type); setOpen(false); }} className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-accent text-left text-sm transition-colors">
                    <b.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{b.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main Post Editor ──
const PostEditor = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile, roles } = useAuth();
  const isNew = !postId || postId === 'new';
  const isInstructor = window.location.pathname.startsWith('/instructor');
  const backUrl = isInstructor ? '/instructor/posts' : '/admin/posts';

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [status, setStatus] = useState('draft');
  const [featuredImage, setFeaturedImage] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [activeTab, setActiveTab] = useState('editor');
  const [mediaPicker, setMediaPicker] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout>>();

  // Load existing post
  const { data: post, isLoading } = useQuery({
    queryKey: ['post-editor', postId],
    enabled: !isNew,
    queryFn: async () => {
      const { data } = await supabase.from('posts').select('*').eq('id', postId).single();
      return data;
    },
  });

  useEffect(() => {
    if (post) {
      setTitle(post.title || '');
      setSlug(post.slug || '');
      setExcerpt(post.excerpt || '');
      setCategory(post.category || '');
      setTags(Array.isArray(post.tags) ? post.tags : []);
      setStatus(post.status || 'draft');
      setFeaturedImage(post.featured_image_url || '');
      setBlocks(Array.isArray(post.content) ? (post.content as unknown as ContentBlock[]) : []);
    }
  }, [post]);

  // Auto-generate slug from title
  useEffect(() => {
    if (isNew && title && !slug) {
      setSlug(title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  }, [title, isNew]);

  // Auto-save every 30s
  useEffect(() => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    if (!title) return;
    autoSaveRef.current = setTimeout(() => {
      if (status === 'draft') saveMutation.mutate();
    }, 30000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [blocks, title, excerpt, category, tags]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const payload: any = {
        title, slug: finalSlug, excerpt, category, status, tags,
        featured_image_url: featuredImage || null,
        content: blocks,
      };
      if (status === 'published' && !post?.published_at) payload.published_at = new Date().toISOString();

      if (isNew) {
        const { data } = await supabase.from('posts').insert({ ...payload, author_id: user?.id }).select('id').single();
        return data;
      } else {
        await supabase.from('posts').update(payload).eq('id', postId);
        return { id: postId };
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['post-editor', postId] });
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      queryClient.invalidateQueries({ queryKey: ['instructor-posts'] });
      setSavedAt(new Date());
      toast.success('Post saved!');
      if (isNew && data?.id) {
        navigate(`${isInstructor ? '/instructor' : '/admin'}/posts/${data.id}/edit`, { replace: true });
      }
    },
    onError: () => toast.error('Failed to save'),
  });

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveMutation.mutate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [blocks, title, slug, excerpt, category, status, tags, featuredImage]);

  const addBlock = (type: string, index?: number) => {
    const newBlock = createDefaultBlock(type);
    if (index !== undefined) {
      const newBlocks = [...blocks];
      newBlocks.splice(index, 0, newBlock);
      setBlocks(newBlocks);
    } else {
      setBlocks([...blocks, newBlock]);
    }
  };

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const removeBlock = (id: string) => setBlocks(prev => prev.filter(b => b.id !== id));

  const moveBlock = (index: number, dir: 'up' | 'down') => {
    const newBlocks = [...blocks];
    const newIndex = dir === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newBlocks.length) return;
    [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
    setBlocks(newBlocks);
  };

  const duplicateBlock = (index: number) => {
    const newBlock = { ...blocks[index], id: crypto.randomUUID() };
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    setBlocks(newBlocks);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) { setTags([...tags, t]); setTagInput(''); }
  };

  if (!isNew && isLoading) return <div className="animate-pulse text-center py-12 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 sticky top-0 z-30 bg-background/95 backdrop-blur py-3 -mt-3 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(backUrl)}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h2 className="font-heading text-lg font-bold">{isNew ? 'New Post' : 'Edit Post'}</h2>
            {savedAt && <p className="text-[10px] text-muted-foreground">Last saved {savedAt.toLocaleTimeString()}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status === 'published' ? 'default' : 'secondary'}>{status}</Badge>
          <Button variant="outline" size="sm" onClick={() => setActiveTab(activeTab === 'preview' ? 'editor' : 'preview')}>
            <Eye className="h-4 w-4 mr-1" /> {activeTab === 'preview' ? 'Editor' : 'Preview'}
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !title}>
            <Save className="h-4 w-4 mr-2" /> {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left: Content Canvas */}
        <div className="flex-1 min-w-0">
          {activeTab === 'editor' ? (
            <div className="space-y-1">
              {/* Title */}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Post title..."
                className="w-full text-3xl font-heading font-bold bg-transparent border-0 outline-none placeholder:text-muted-foreground/40 mb-4"
              />

              {/* Blocks */}
              {blocks.map((block, index) => (
                <div key={block.id}>
                  <BlockInserter onInsert={(type) => addBlock(type, index)} />
                  <BlockEditor
                    block={block}
                    onUpdate={(u) => updateBlock(block.id, u)}
                    onRemove={() => removeBlock(block.id)}
                    onMoveUp={() => moveBlock(index, 'up')}
                    onMoveDown={() => moveBlock(index, 'down')}
                    onDuplicate={() => duplicateBlock(index)}
                    isFirst={index === 0}
                    isLast={index === blocks.length - 1}
                  />
                </div>
              ))}
              <BlockInserter onInsert={(type) => addBlock(type)} />

              {blocks.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Type className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg">Start building your post</p>
                  <p className="text-sm mt-1">Click "Add Block" above to add content</p>
                </div>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <h1 className="text-3xl font-heading font-bold mb-6">{title || 'Untitled'}</h1>
                {blocks.length > 0 ? <BlockRenderer blocks={blocks} /> : <p className="text-muted-foreground">No content yet.</p>}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Settings Sidebar */}
        <div className="w-72 shrink-0 space-y-4 hidden lg:block">
          {/* Publish */}
          <Card>
            <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Publish</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => saveMutation.mutate()} className="w-full" disabled={!title || saveMutation.isPending}>
                {status === 'published' ? 'Publish' : 'Save Draft'}
              </Button>
            </CardContent>
          </Card>

          {/* Post Settings */}
          <Card>
            <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Post Settings</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div><Label className="text-xs">Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 text-sm" placeholder="e.g. Textile News" /></div>
              <div><Label className="text-xs">Excerpt</Label><Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} className="text-sm" /></div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Tags</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {tags.map(t => (
                  <Badge key={t} variant="secondary" className="gap-1 text-xs">
                    {t}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setTags(tags.filter(x => x !== t))} />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-1">
                <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} className="h-7 text-xs" placeholder="Add tag..." />
                <Button variant="outline" size="sm" className="h-7 px-2" onClick={addTag}>Add</Button>
              </div>
            </CardContent>
          </Card>

          {/* Featured Image */}
          <Card>
            <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Featured Image</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4">
              {featuredImage ? (
                <div className="relative">
                  <img src={featuredImage} className="w-full aspect-video object-cover rounded-lg" />
                  <div className="flex gap-1 mt-2">
                    <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => setMediaPicker(true)}>Change</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setFeaturedImage('')}><X className="h-3 w-3" /></Button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50" onClick={() => setMediaPicker(true)}>
                  <ImageIcon className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">Select image</p>
                </div>
              )}
              <MediaPickerModal open={mediaPicker} onClose={() => setMediaPicker(false)} onSelect={(url) => { setFeaturedImage(url); setMediaPicker(false); }} accept="image/*" />
            </CardContent>
          </Card>

          {/* SEO Preview */}
          <Card>
            <CardHeader className="py-3 px-4"><CardTitle className="text-sm">SEO Preview</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">{title || 'Post Title'}</p>
                <p className="text-[10px] text-green-700 dark:text-green-400 truncate">yoursite.com/blog/{slug || 'post-slug'}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{excerpt || 'Post excerpt will appear here...'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Author */}
          <Card>
            <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Author</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold">
                  {profile?.full_name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="text-sm font-medium">{profile?.full_name || 'Unknown'}</p>
                  <p className="text-[10px] text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PostEditor;
