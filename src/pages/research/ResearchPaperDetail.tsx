import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/SEOHead';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  ArrowLeft, BookOpen, Download, Eye, Quote, Bookmark, BookmarkCheck,
  Calendar, Users, FileText, ExternalLink, ShoppingCart, Copy
} from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';

const ResearchPaperDetail = () => {
  const { paperId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const addItem = useCartStore(s => s.addItem);
  const [citationFormat, setCitationFormat] = useState<'bibtex' | 'apa' | 'mla'>('apa');

  const { data: paper, isLoading } = useQuery({
    queryKey: ['research-paper-detail', paperId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('research_papers')
        .select('*, submitter:user_profiles!research_papers_submitted_by_fkey(full_name, avatar_url)')
        .eq('id', paperId!)
        .single();
      if (error) throw error;
      // Increment view
      supabase.rpc('increment_research_paper_view', { _paper_id: paperId! });
      return data;
    },
    enabled: !!paperId,
  });

  const { data: hasAccess } = useQuery({
    queryKey: ['research-paper-access', paperId, user?.id],
    queryFn: async () => {
      if (!user) return false;
      if (paper?.access_type === 'free' || paper?.submitted_by === user.id) return true;
      const { data } = await supabase
        .from('research_paper_access')
        .select('id')
        .eq('paper_id', paperId!)
        .eq('user_id', user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!paperId && !!paper,
  });

  const { data: isBookmarked } = useQuery({
    queryKey: ['research-bookmark', paperId, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from('research_paper_bookmarks')
        .select('id')
        .eq('paper_id', paperId!)
        .eq('user_id', user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!paperId,
  });

  const bookmarkMutation = useMutation({
    mutationFn: async () => {
      if (isBookmarked) {
        await supabase.from('research_paper_bookmarks').delete().eq('paper_id', paperId!).eq('user_id', user!.id);
      } else {
        await supabase.from('research_paper_bookmarks').insert({ paper_id: paperId!, user_id: user!.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research-bookmark', paperId] });
      toast.success(isBookmarked ? 'Removed from library' : 'Added to library');
    },
  });

  const { data: relatedPapers = [] } = useQuery({
    queryKey: ['related-papers', paper?.category],
    queryFn: async () => {
      const { data } = await supabase
        .from('research_papers')
        .select('id, title, authors, category')
        .eq('status', 'approved')
        .eq('category', paper!.category!)
        .neq('id', paperId!)
        .limit(4);
      return data ?? [];
    },
    enabled: !!paper?.category,
  });

  const canRead = paper?.access_type === 'free' || hasAccess || paper?.submitted_by === user?.id;

  const generateCitation = () => {
    if (!paper) return '';
    const authors = Array.isArray(paper.authors) ? paper.authors.map((a: any) => a.name).join(', ') : 'Unknown';
    const year = paper.published_date ? new Date(paper.published_date).getFullYear() : new Date().getFullYear();
    const doi = paper.doi ? ` doi:${paper.doi}` : '';

    if (citationFormat === 'bibtex') {
      const key = (paper.title?.split(' ')[0]?.toLowerCase() || 'paper') + year;
      return `@article{${key},\n  title={${paper.title}},\n  author={${authors}},\n  year={${year}},\n  volume={${paper.volume || ''}},\n  number={${paper.issue || ''}},\n  pages={${paper.page_range || ''}},\n  keywords={${paper.keywords || ''}}\n}`;
    }
    if (citationFormat === 'mla') {
      return `${authors}. "${paper.title}." ${paper.volume ? `Vol. ${paper.volume}` : ''} ${paper.issue ? `No. ${paper.issue}` : ''} (${year}): ${paper.page_range || 'n.p.'}.${doi}`;
    }
    // APA
    return `${authors} (${year}). ${paper.title}. ${paper.volume ? `${paper.volume}` : ''}${paper.issue ? `(${paper.issue})` : ''}, ${paper.page_range || ''}.${doi}`;
  };

  const copyCitation = () => {
    navigator.clipboard.writeText(generateCitation());
    toast.success(`${citationFormat.toUpperCase()} citation copied!`);
  };

  const handlePurchase = () => {
    if (!user) { navigate('/auth/login'); return; }
    addItem({ id: paper!.id, title: paper!.title, price: Number(paper!.price) || 0, type: 'research_paper' } as any);
    navigate('/cart');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-40 bg-muted rounded" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-16 text-center">
          <FileText className="h-16 w-16 mx-auto mb-4 text-muted" />
          <h1 className="text-2xl font-heading font-bold mb-2">Paper Not Found</h1>
          <Button onClick={() => navigate('/research')}>Browse Papers</Button>
        </main>
        <Footer />
      </div>
    );
  }

  const authors = Array.isArray(paper.authors) ? paper.authors : [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title={paper.title}
        description={paper.abstract?.slice(0, 160) || undefined}
        ogType="article"
      />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/research')} className="mb-4 gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to Papers
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                {paper.category && <Badge variant="outline">{paper.category}</Badge>}
                <Badge variant={paper.access_type === 'free' ? 'default' : 'secondary'}>
                  {paper.access_type === 'free' ? 'Open Access' : paper.access_type === 'paid' ? `৳${paper.price}` : 'Enrolled Only'}
                </Badge>
                {paper.doi && <Badge variant="outline" className="text-[10px]">DOI: {paper.doi}</Badge>}
              </div>
              <h1 className="font-heading text-2xl md:text-3xl font-bold leading-tight">{paper.title}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {authors.map((a: any) => a.name).join(', ') || (paper as any).submitter?.full_name || 'Unknown'}
                </span>
                {paper.published_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(paper.published_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            <Separator />

            {/* Abstract */}
            <div>
              <h2 className="font-heading font-semibold text-lg mb-2">Abstract</h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{paper.abstract || 'No abstract provided.'}</p>
            </div>

            {/* Keywords */}
            {paper.keywords && (
              <div>
                <h2 className="font-heading font-semibold text-lg mb-2">Keywords</h2>
                <div className="flex flex-wrap gap-2">
                  {paper.keywords.split(',').map((k: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">{k.trim()}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Journal Metadata */}
            {(paper.volume || paper.issue || paper.page_range) && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-heading font-semibold mb-2">Journal Information</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {paper.volume && <div><span className="text-muted-foreground">Volume:</span> {paper.volume}</div>}
                    {paper.issue && <div><span className="text-muted-foreground">Issue:</span> {paper.issue}</div>}
                    {paper.page_range && <div><span className="text-muted-foreground">Pages:</span> {paper.page_range}</div>}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Citation Generator */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-heading font-semibold flex items-center gap-2"><Quote className="h-4 w-4" /> Cite This Paper</h3>
                  <div className="flex gap-1">
                    {(['apa', 'bibtex', 'mla'] as const).map(fmt => (
                      <Button key={fmt} size="sm" variant={citationFormat === fmt ? 'default' : 'outline'} className="text-xs h-7"
                        onClick={() => setCitationFormat(fmt)}>{fmt.toUpperCase()}</Button>
                    ))}
                  </div>
                </div>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap font-mono">{generateCitation()}</pre>
                <Button size="sm" variant="ghost" className="mt-2 gap-1 text-xs" onClick={copyCitation}>
                  <Copy className="h-3 w-3" /> Copy Citation
                </Button>
              </CardContent>
            </Card>

            {/* Related Papers */}
            {relatedPapers.length > 0 && (
              <div>
                <h2 className="font-heading font-semibold text-lg mb-3">Related Papers</h2>
                <div className="space-y-2">
                  {relatedPapers.map((rp: any) => (
                    <Link key={rp.id} to={`/research/${rp.id}`}
                      className="block p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <p className="font-medium text-sm">{rp.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {Array.isArray(rp.authors) ? rp.authors.map((a: any) => a.name).join(', ') : ''}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                {canRead ? (
                  <Button className="w-full gap-2" onClick={() => navigate(`/research/${paperId}/read`)}>
                    <BookOpen className="h-4 w-4" /> Read Paper
                  </Button>
                ) : paper.access_type === 'paid' ? (
                  <Button className="w-full gap-2" onClick={handlePurchase}>
                    <ShoppingCart className="h-4 w-4" /> Purchase — ৳{paper.price}
                  </Button>
                ) : (
                  <Button className="w-full" disabled>Access Restricted</Button>
                )}

                {canRead && paper.file_url && (
                  <Button variant="outline" className="w-full gap-2" onClick={() => {
                    window.open(paper.file_url!, '_blank');
                    supabase.rpc('increment_research_paper_download', { _paper_id: paper.id });
                  }}>
                    <Download className="h-4 w-4" /> Download PDF
                  </Button>
                )}

                {user && (
                  <Button variant="outline" className="w-full gap-2" onClick={() => bookmarkMutation.mutate()}>
                    {isBookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                    {isBookmarked ? 'In Library' : 'Add to Library'}
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="font-heading font-semibold text-sm mb-3">Paper Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Views</span><span className="font-medium">{paper.view_count}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Downloads</span><span className="font-medium">{paper.download_count}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Citations</span><span className="font-medium">{paper.citation_count}</span></div>
                </div>
              </CardContent>
            </Card>

            {/* Authors Card */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-heading font-semibold text-sm mb-3">Authors</h3>
                <div className="space-y-2">
                  {authors.length > 0 ? authors.map((a: any, i: number) => (
                    <div key={i} className="text-sm">
                      <p className="font-medium">{a.name}</p>
                      {a.affiliation && <p className="text-xs text-muted-foreground">{a.affiliation}</p>}
                    </div>
                  )) : (
                    <p className="text-sm">{(paper as any).submitter?.full_name || 'Unknown'}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ResearchPaperDetail;
