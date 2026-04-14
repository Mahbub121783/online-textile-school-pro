import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/SEOHead';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Search, Plus, Calendar, Eye, BookOpen, ArrowUpDown } from 'lucide-react';

const ResearchPapersPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'newest' | 'downloads' | 'views' | 'citations'>('newest');
  const [accessFilter, setAccessFilter] = useState('all');

  const { data: papers = [], isLoading } = useQuery({
    queryKey: ['public-research-papers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('research_papers')
        .select('*, submitter:user_profiles!research_papers_submitted_by_fkey(full_name)')
        .eq('status', 'approved')
        .order('published_date', { ascending: false });
      return data ?? [];
    },
  });

  const categories = [...new Set(papers.map((p: any) => p.category).filter(Boolean))];

  const filtered = papers
    .filter((p: any) => {
      const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.keywords || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.abstract || '').toLowerCase().includes(search.toLowerCase());
      const matchCat = category === 'all' || p.category === category;
      const matchAccess = accessFilter === 'all' || p.access_type === accessFilter;
      return matchSearch && matchCat && matchAccess;
    })
    .sort((a: any, b: any) => {
      if (sort === 'downloads') return (b.download_count || 0) - (a.download_count || 0);
      if (sort === 'views') return (b.view_count || 0) - (a.view_count || 0);
      if (sort === 'citations') return (b.citation_count || 0) - (a.citation_count || 0);
      return 0; // already ordered by newest from query
    });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold mb-2">Research Journal</h1>
            <p className="text-muted-foreground">Browse academic research from our community</p>
          </div>
          {user && (
            <Button onClick={() => navigate('/research/submit')} className="gap-1">
              <Plus className="h-4 w-4" /> Submit Paper
            </Button>
          )}
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{papers.length}</p>
            <p className="text-xs text-muted-foreground">Published Papers</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{papers.reduce((s: number, p: any) => s + (p.download_count || 0), 0)}</p>
            <p className="text-xs text-muted-foreground">Total Downloads</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{categories.length}</p>
            <p className="text-xs text-muted-foreground">Research Areas</p>
          </CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search papers, keywords, abstracts..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={accessFilter} onValueChange={setAccessFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Access</SelectItem>
              <SelectItem value="free">Open Access</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={v => setSort(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="downloads">Most Downloaded</SelectItem>
              <SelectItem value="views">Most Viewed</SelectItem>
              <SelectItem value="citations">Most Cited</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
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
              <Card key={p.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {p.category && <Badge variant="outline" className="text-[10px]">{p.category}</Badge>}
                        <Badge variant={p.access_type === 'free' ? 'default' : 'secondary'} className="text-[10px]">
                          {p.access_type === 'free' ? 'Open Access' : `৳${p.price}`}
                        </Badge>
                        {p.doi && <Badge variant="outline" className="text-[10px]">DOI</Badge>}
                      </div>
                      <Link to={`/research/${p.id}`} className="hover:underline">
                        <h3 className="font-heading font-bold text-lg">{p.title}</h3>
                      </Link>
                      <p className="text-sm text-muted-foreground mt-1">
                        {Array.isArray(p.authors) ? p.authors.map((a: any) => a.name).join(', ') : (p as any).submitter?.full_name || 'Unknown'}
                      </p>
                      {p.abstract && <p className="text-sm mt-2 line-clamp-2">{p.abstract}</p>}
                      <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                        {p.published_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {new Date(p.published_date).toLocaleDateString()}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {p.view_count} views
                        </span>
                        <span className="flex items-center gap-1">
                          <Download className="h-3 w-3" /> {p.download_count} downloads
                        </span>
                        {p.volume && <span>Vol. {p.volume}{p.issue ? `, No. ${p.issue}` : ''}</span>}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1 shrink-0"
                      onClick={() => navigate(`/research/${p.id}`)}>
                      <BookOpen className="h-3.5 w-3.5" /> View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default ResearchPapersPage;
