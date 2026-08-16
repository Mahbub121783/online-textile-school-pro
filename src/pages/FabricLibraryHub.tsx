import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { Shirt, Building2, MapPin, Package, Send, School, Image as ImageIcon, ArrowUpRight } from 'lucide-react';

const statusColors: Record<string, string> = {
  ongoing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

/**
 * Public showcase for the OTS Fabric Library initiative -- total stock
 * transparency, every participating campus with its status, and a combined
 * photo gallery of libraries being set up. Per-campus detail (distributions,
 * summary, full gallery) lives on that campus's own portfolio page under its
 * "Fabric Library" tab; this page is the cross-campus overview db/56 was
 * built for.
 */
const FabricLibraryHub = () => {
  const { data: hangers = [] } = useQuery({
    queryKey: ['fabric-hangers-public'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fabric_hangers').select('id, current_stock');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ['fabric-ledger-public'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fabric_hanger_stock_transactions').select('type, quantity');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: libraries = [], isLoading } = useQuery({
    queryKey: ['fabric-libraries-public'],
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campus_fabric_libraries')
        .select('*, campus:campus_onboard_requests(campus_name, area, logo_url, cover_image_url, subdomain_slug, subdomain_provisioned)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).filter((l: any) => l.campus);
    },
  });

  const { data: photos = [] } = useQuery({
    queryKey: ['fabric-library-photos-public'],
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campus_fabric_library_photos')
        .select('id, image_url')
        .order('created_at', { ascending: false })
        .limit(16);
      if (error) throw error;
      return data || [];
    },
  });

  const totalDistributed = ledger.filter((t: any) => t.type === 'distributed').reduce((s: number, t: any) => s + t.quantity, 0);
  const totalStock = hangers.reduce((s: number, h: any) => s + (h.current_stock || 0), 0);
  const ongoingCount = libraries.filter((l: any) => l.status === 'ongoing').length;
  const completedCount = libraries.filter((l: any) => l.status === 'completed').length;

  return (
    <div className="min-h-screen flex flex-col">
      <UtilityBar /><Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <div className="bg-secondary py-8">
          <div className="container">
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Shirt className="h-7 w-7 text-primary" /> Fabric Library Initiative
            </h1>
            <p className="text-muted-foreground mt-1">OTS-curated fabric sample libraries, set up at campuses across the network.</p>
          </div>
        </div>

        <div className="container py-8 space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6 text-center">
              <Package className="h-5 w-5 mx-auto text-primary mb-1.5" />
              <p className="text-2xl font-heading font-black tabular-nums">{totalStock}</p>
              <p className="text-sm text-muted-foreground">Hangers in Central Stock</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6 text-center">
              <Send className="h-5 w-5 mx-auto text-primary mb-1.5" />
              <p className="text-2xl font-heading font-black tabular-nums">{totalDistributed}</p>
              <p className="text-sm text-muted-foreground">Hangers Distributed</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6 text-center">
              <School className="h-5 w-5 mx-auto text-primary mb-1.5" />
              <p className="text-2xl font-heading font-black tabular-nums">{libraries.length}</p>
              <p className="text-sm text-muted-foreground">Campuses Covered</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6 text-center">
              <Building2 className="h-5 w-5 mx-auto text-primary mb-1.5" />
              <p className="text-2xl font-heading font-black tabular-nums">{ongoingCount} / {completedCount}</p>
              <p className="text-sm text-muted-foreground">Ongoing / Completed</p>
            </CardContent></Card>
          </div>

          <div>
            <h2 className="font-heading font-bold text-lg mb-4">Participating Campuses</h2>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-12">Loading...</p>
            ) : libraries.length === 0 ? (
              <div className="text-center py-12">
                <Shirt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">No campuses have a Fabric Library yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {libraries.map((l: any) => {
                  const c = l.campus;
                  const CardWrapper = c.subdomain_provisioned ? 'a' : Link;
                  const wrapperProps = c.subdomain_provisioned
                    ? { href: `https://${c.subdomain_slug}.onlinetextileschool.com`, target: '_blank', rel: 'noopener noreferrer' }
                    : { to: `/campus-onboard` };
                  return (
                    <CardWrapper key={l.id} {...(wrapperProps as any)} className="group">
                      <Card className="hover:shadow-lg hover:-translate-y-0.5 transition-all h-full overflow-hidden">
                        <div
                          className="h-20 flex items-center justify-center relative bg-cover bg-center"
                          style={c.cover_image_url
                            ? { backgroundImage: `linear-gradient(rgba(10,15,30,0.35),rgba(10,15,30,0.5)), url(${c.cover_image_url})` }
                            : undefined}
                        >
                          {!c.cover_image_url && <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-dark to-accent" />}
                          {c.logo_url ? (
                            <img src={c.logo_url} alt={c.campus_name} className="w-12 h-12 rounded-xl object-cover border-2 border-white/40 shadow-lg" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary-foreground" /></div>
                          )}
                          {c.subdomain_provisioned && <ArrowUpRight className="h-4 w-4 text-primary-foreground/80 absolute top-2 right-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />}
                        </div>
                        <CardContent className="pt-4 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-heading font-bold truncate">{c.campus_name}</h3>
                            <Badge className={`${statusColors[l.status]} capitalize shrink-0`}>{l.status}</Badge>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0" /> {c.area}
                          </div>
                        </CardContent>
                      </Card>
                    </CardWrapper>
                  );
                })}
              </div>
            )}
          </div>

          {photos.length > 0 && (
            <div>
              <h2 className="font-heading font-bold text-lg mb-4 flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Recent Photos</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {photos.map((p: any) => (
                  <div key={p.id} className="aspect-[4/3] rounded-xl overflow-hidden border bg-muted/30">
                    <img src={p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer /><BottomNav />
    </div>
  );
};

export default FabricLibraryHub;
