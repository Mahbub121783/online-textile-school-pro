import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CountdownTimer } from '@/components/workshop/CountdownTimer';
import { Calendar, Users, MapPin, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import SEOHead from '@/components/SEOHead';

const statusColors: Record<string, string> = {
  published: 'bg-blue-500',
  ongoing: 'bg-green-500',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive',
};

export default function WorkshopsPage() {
  const { data: workshops = [], isLoading } = useQuery({
    queryKey: ['workshops-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .neq('status', 'draft')
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Get registration counts
  const { data: regCounts = {} } = useQuery({
    queryKey: ['workshop-reg-counts'],
    queryFn: async () => {
      const ids = workshops.map((w: any) => w.id);
      if (!ids.length) return {};
      const { data } = await supabase
        .from('workshop_registrations')
        .select('workshop_id')
        .in('workshop_id', ids)
        .eq('status', 'registered');
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        counts[r.workshop_id] = (counts[r.workshop_id] || 0) + 1;
      });
      return counts;
    },
    enabled: workshops.length > 0,
  });

  return (
    <>
      <SEOHead title="Workshops" description="Join our hands-on workshops and skill-building sessions." />
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-heading font-bold mb-3">Workshops</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Join our hands-on workshops — one-day or multi-day sessions with live instruction, materials, and quizzes.
            </p>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse"><CardContent className="p-6 h-64" /></Card>
              ))}
            </div>
          ) : workshops.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">No workshops available right now. Check back soon!</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workshops.map((ws: any) => {
                const startDt = new Date(`${ws.start_date}T${ws.start_time || '00:00'}`);
                const count = regCounts[ws.id] || 0;
                const slotsLeft = ws.max_participants ? ws.max_participants - count : null;
                const isFull = slotsLeft !== null && slotsLeft <= 0;

                return (
                  <Card key={ws.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    {ws.thumbnail_url && (
                      <img src={ws.thumbnail_url} alt={ws.title} className="w-full h-44 object-cover" />
                    )}
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge className={statusColors[ws.status] || ''}>
                          {ws.status}
                        </Badge>
                        <Badge variant="outline">{ws.workshop_type === 'multi_day' ? 'Multi-Day' : 'One Day'}</Badge>
                      </div>
                      <h3 className="font-heading font-semibold text-lg line-clamp-2">{ws.title}</h3>
                      {ws.short_description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{ws.short_description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{format(new Date(ws.start_date), 'MMM dd, yyyy')}</span>
                        {ws.start_time && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{ws.start_time?.slice(0, 5)}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{count} registered</span>
                        {slotsLeft !== null && (
                          <span className={isFull ? 'text-destructive' : 'text-green-600'}>
                            · {isFull ? 'Full' : `${slotsLeft} slots left`}
                          </span>
                        )}
                      </div>
                      {ws.status !== 'completed' && ws.status !== 'cancelled' && startDt > new Date() && (
                        <CountdownTimer targetDate={startDt} compact className="text-muted-foreground" />
                      )}
                      <Link to={`/workshops/${ws.slug}`}>
                        <Button className="w-full mt-2" size="sm" disabled={isFull && ws.status === 'published'}>
                          {isFull ? 'Fully Booked' : 'View & Register'}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
        <Footer />
        <BottomNav />
      </div>
    </>
  );
}
