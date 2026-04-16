import { FormSkeleton } from '@/components/ui/loading-skeletons';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BlockRenderer, { ContentBlock } from '@/components/cms/BlockRenderer';
import { toast } from 'sonner';
import { Save, Plus, Trash2, Eye, ArrowLeft, ChevronUp, ChevronDown, Type, Image, Video, MousePointer, Columns, Space, Code } from 'lucide-react';

const BLOCK_TYPES = [
  { type: 'text', label: 'Text Block', icon: Type },
  { type: 'image', label: 'Image', icon: Image },
  { type: 'video', label: 'Video Embed', icon: Video },
  { type: 'button', label: 'Button', icon: MousePointer },
  { type: 'columns', label: 'Columns', icon: Columns },
  { type: 'spacer', label: 'Spacer', icon: Space },
  { type: 'html', label: 'HTML', icon: Code },
];

const PageEditor = () => {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ContentBlock | null>(null);
  const [activeTab, setActiveTab] = useState('editor');

  const { data: page, isLoading } = useQuery({
    queryKey: ['admin-page', pageId],
    enabled: !!pageId,
    queryFn: async () => {
      const { data } = await supabase.from('pages').select('*').eq('id', pageId).single();
      return data;
    },
  });

  useEffect(() => {
    if (page?.content) {
      setBlocks(Array.isArray(page.content) ? (page.content as unknown as ContentBlock[]) : []);
    }
  }, [page]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('pages').update({ content: blocks as any } as any).eq('id', pageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-page', pageId] });
      toast.success('Page content saved');
    },
    onError: () => toast.error('Failed to save'),
  });

  const addBlock = (type: string) => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type: type as ContentBlock['type'],
      content: type === 'text' ? '<p>Enter your text here...</p>' : undefined,
      url: type === 'image' || type === 'video' ? '' : undefined,
      buttonText: type === 'button' ? 'Click Me' : undefined,
      buttonUrl: type === 'button' ? '/' : undefined,
      height: type === 'spacer' ? 40 : undefined,
      html: type === 'html' ? '<div></div>' : undefined,
      columns: type === 'columns' ? [[], []] : undefined,
    };
    setBlocks([...blocks, newBlock]);
    setEditingBlock(newBlock);
    setAddDialogOpen(false);
  };

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
    if (editingBlock?.id === id) setEditingBlock({ ...editingBlock, ...updates });
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
    if (editingBlock?.id === id) setEditingBlock(null);
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...blocks];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newBlocks.length) return;
    [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
    setBlocks(newBlocks);
  };

  if (isLoading) return <FormSkeleton fields={6} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/pages')}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h2 className="font-heading text-xl font-bold">{page?.title || 'Page Editor'}</h2>
            <p className="text-sm text-muted-foreground">/{page?.slug}</p>
          </div>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" /> Save Content
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="preview"><Eye className="h-4 w-4 mr-1" /> Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-3">
          {blocks.map((block, index) => (
            <Card key={block.id} className={`${editingBlock?.id === block.id ? 'ring-2 ring-primary' : ''}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded">{block.type}</span>
                  <div className="flex-1" />
                  <Button variant="ghost" size="icon" onClick={() => moveBlock(index, 'up')} disabled={index === 0}><ChevronUp className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => moveBlock(index, 'down')} disabled={index === blocks.length - 1}><ChevronDown className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setEditingBlock(editingBlock?.id === block.id ? null : block)}>
                    <Type className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeBlock(block.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                {editingBlock?.id === block.id && (
                  <div className="space-y-3 border-t pt-3">
                    {block.type === 'text' && (
                      <Textarea value={block.content} onChange={(e) => updateBlock(block.id, { content: e.target.value })} rows={4} placeholder="HTML content..." />
                    )}
                    {block.type === 'image' && (
                      <>
                        <div><Label>Image URL</Label><Input value={block.url} onChange={(e) => updateBlock(block.id, { url: e.target.value })} /></div>
                        <div><Label>Alt Text</Label><Input value={block.alt} onChange={(e) => updateBlock(block.id, { alt: e.target.value })} /></div>
                      </>
                    )}
                    {block.type === 'video' && (
                      <div><Label>Video URL (YouTube/Vimeo)</Label><Input value={block.url} onChange={(e) => updateBlock(block.id, { url: e.target.value })} /></div>
                    )}
                    {block.type === 'button' && (
                      <>
                        <div><Label>Button Text</Label><Input value={block.buttonText} onChange={(e) => updateBlock(block.id, { buttonText: e.target.value })} /></div>
                        <div><Label>Button URL</Label><Input value={block.buttonUrl} onChange={(e) => updateBlock(block.id, { buttonUrl: e.target.value })} /></div>
                        <div><Label>Variant</Label>
                          <Select value={block.buttonVariant || 'default'} onValueChange={(v) => updateBlock(block.id, { buttonVariant: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Primary</SelectItem>
                              <SelectItem value="outline">Outline</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                    {block.type === 'spacer' && (
                      <div><Label>Height (px)</Label><Input type="number" value={block.height} onChange={(e) => updateBlock(block.id, { height: parseInt(e.target.value) || 40 })} /></div>
                    )}
                    {block.type === 'html' && (
                      <Textarea value={block.html} onChange={(e) => updateBlock(block.id, { html: e.target.value })} rows={6} className="font-mono text-sm" placeholder="Raw HTML..." />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" className="w-full border-dashed" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Block
          </Button>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardContent className="p-6">
              {blocks.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No content blocks yet. Switch to Editor to add some.</p>
              ) : (
                <BlockRenderer blocks={blocks} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Content Block</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {BLOCK_TYPES.map(({ type, label, icon: Icon }) => (
              <Button key={type} variant="outline" className="h-20 flex-col gap-2" onClick={() => addBlock(type)}>
                <Icon className="h-5 w-5" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PageEditor;
