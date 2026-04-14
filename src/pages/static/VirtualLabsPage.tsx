import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/SEOHead';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FlaskConical, ExternalLink, Search } from 'lucide-react';

const VirtualLabsPage = () => {
  const [search, setSearch] = useState('');

  const { data: labs = [], isLoading } = useQuery({
    queryKey: ['public-virtual-labs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('virtual_labs')
        .select('*, courses(title)')
        .eq('is_published', true)
        .order('sort_order')
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const filtered = labs.filter((l: any) =>
    l.title.toLowerCase().includes(search.toLowerCase()) ||
    (l.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const [activeLab, setActiveLab] = useState<any>(null);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead title="Virtual Labs" description="Explore interactive textile engineering simulations and virtual lab environments. Practice spinning, weaving, and dyeing processes online." breadcrumbs={[{ name: 'Home', url: '/' }, { name: 'Virtual Labs', url: '/virtual-labs' }]} />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold mb-2">Virtual Labs</h1>
          <p className="text-muted-foreground">Explore interactive simulations and lab environments</p>
        </div>

        {activeLab ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-xl font-bold">{activeLab.title}</h2>
                {activeLab.courses?.title && (
                  <p className="text-sm text-muted-foreground">Course: {activeLab.courses.title}</p>
                )}
              </div>
              <Button variant="outline" onClick={() => setActiveLab(null)}>Back to Labs</Button>
            </div>
            {activeLab.instructions && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium text-sm mb-2">Instructions</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{activeLab.instructions}</p>
                </CardContent>
              </Card>
            )}
            {activeLab.type === 'iframe' ? (
              <div className="w-full aspect-video border rounded-lg overflow-hidden">
                <iframe
                  src={activeLab.simulation_url}
                  className="w-full h-full"
                  title={activeLab.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                  allowFullScreen
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <ExternalLink className="h-10 w-10 mx-auto mb-3 text-muted" />
                  <p className="mb-4 text-muted-foreground">This lab opens in a new window.</p>
                  <Button asChild>
                    <a href={activeLab.simulation_url} target="_blank" rel="noopener noreferrer" className="gap-2">
                      <ExternalLink className="h-4 w-4" /> Open Lab
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <>
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search labs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>

            {isLoading ? (
              <p className="text-center py-12 text-muted-foreground animate-pulse">Loading labs...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <FlaskConical className="h-12 w-12 mx-auto mb-3 text-muted" />
                <p className="text-muted-foreground">No virtual labs available.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((l: any) => (
                  <Card key={l.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setActiveLab(l)}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-primary" />
                        {l.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {l.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{l.description}</p>}
                      <div className="flex items-center justify-between">
                        {l.courses?.title && <Badge variant="outline" className="text-[10px]">{l.courses.title}</Badge>}
                        <Badge variant="secondary" className="text-[10px]">{l.type === 'iframe' ? 'Interactive' : 'External'}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default VirtualLabsPage;
