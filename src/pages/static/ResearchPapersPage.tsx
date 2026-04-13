import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Search, Plus, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const ResearchPapersPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitForm, setSubmitForm] = useState({ title: '', abstract: '', category: '', keywords: '', file_url: '' });

  const { data: papers = [], isLoading } = useQuery({
    queryKey: ['public-research-papers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('research_papers')
        .select('*, user_profiles:submitted_by(full_name)')
        .eq('is_approved', true)
        .order('published_date', { ascending: false });
      return data ?? [];
    },
  });

  const categories = [...new Set(papers.map((p: any) => p.category).filter(Boolean))];

  const filtered = papers.filter((p: any) => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.keywords || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'all' || p.category === category;
    return matchSearch && matchCat;
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('research_papers').insert({
        title: submitForm.title,
        abstract: submitForm.abstract || null,
        category: submitForm.category || null,
        keywords: submitForm.keywords || null,
        file_url: submitForm.file_url || null,
        submitted_by: user!.id,
        authors: [{ name: user!.user_metadata?.full_name || 'Author' }],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-research-papers'] });
      setSubmitOpen(false);
      setSubmitForm({ title: '', abstract: '', category: '', keywords: '', file_url: '' });
      toast.success('Paper submitted for review!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const downloadPaper = async (paper: any) => {
    if (paper.file_url) {
      window.open(paper.file_url, '_blank');
      // Increment download count (best effort)
      await supabase.from('research_papers').update({ download_count: (paper.download_count || 0) + 1 }).eq('id', paper.id);
    }
  };

  const generateBibTeX = (paper: any) => {
    const authors = Array.isArray(paper.authors) ? paper.authors.map((a: any) => a.name).join(' and ') : 'Unknown';
    const year = paper.published_date ? new Date(paper.published_date).getFullYear() : new Date().getFullYear();
    const key = paper.title.split(' ')[0].toLowerCase() + year;
    const bibtex = `@article{${key},
  title={${paper.title}},
  author={${authors}},
  year={${year}},
  keywords={${paper.keywords || ''}}
}`;
    navigator.clipboard.writeText(bibtex);
    toast.success('BibTeX copied to clipboard');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold mb-2">Research Papers</h1>
            <p className="text-muted-foreground">Browse academic research from our community</p>
          </div>
          {user && (
            <Button onClick={() => setSubmitOpen(true)} className="gap-1">
              <Plus className="h-4 w-4" /> Submit Paper
            </Button>
          )}
        </div>

        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search papers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-center py-12 text-muted-foreground animate-pulse">Loading papers...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted" />
            <p className="text-muted-foreground">No papers found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((p: any) => (
              <Card key={p.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-heading font-bold text-lg">{p.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {Array.isArray(p.authors) ? p.authors.map((a: any) => a.name).join(', ') : 'Unknown Author'}
                      </p>
                      {p.abstract && <p className="text-sm mt-2 line-clamp-3">{p.abstract}</p>}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {p.category && <Badge variant="outline" className="text-[10px]">{p.category}</Badge>}
                        {p.published_date && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {new Date(p.published_date).toLocaleDateString()}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          <Download className="h-3 w-3 inline mr-1" />{p.download_count} downloads
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {p.file_url && (
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => downloadPaper(p)}>
                          <Download className="h-3.5 w-3.5" /> PDF
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => generateBibTeX(p)}>
                        Cite (BibTeX)
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />

      {/* Submit Dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Submit Research Paper</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={submitForm.title} onChange={e => setSubmitForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Abstract</Label><Textarea value={submitForm.abstract} onChange={e => setSubmitForm(p => ({ ...p, abstract: e.target.value }))} rows={4} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Category</Label><Input value={submitForm.category} onChange={e => setSubmitForm(p => ({ ...p, category: e.target.value }))} placeholder="e.g., Textile Engineering" /></div>
              <div><Label>Keywords</Label><Input value={submitForm.keywords} onChange={e => setSubmitForm(p => ({ ...p, keywords: e.target.value }))} placeholder="fiber, weaving, dyeing" /></div>
            </div>
            <div><Label>Paper File URL</Label><Input value={submitForm.file_url} onChange={e => setSubmitForm(p => ({ ...p, file_url: e.target.value }))} placeholder="https://..." /></div>
            <p className="text-xs text-muted-foreground">Your paper will be reviewed by admin before publishing.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>Cancel</Button>
            <Button onClick={() => submitMutation.mutate()} disabled={!submitForm.title || submitMutation.isPending}>
              {submitMutation.isPending ? 'Submitting...' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResearchPapersPage;
