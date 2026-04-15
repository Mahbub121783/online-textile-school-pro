import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CountdownTimer } from '@/components/workshop/CountdownTimer';
import { Calendar, Users, Clock, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import SEOHead from '@/components/SEOHead';

const statusConfig: Record<string, { label: string; className: string }> = {
  published: { label: 'Upcoming', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  ongoing: { label: 'Live Now', className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' },
  completed: { label: 'Completed', className: 'bg-muted text-muted-foreground border-border' },
  cancelled: { label: 'Cancelled', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export default function WorkshopsPage() {
  const navigate = useNavigate();

  const { data: workshops = [], isLoading } = useQuery({
    queryKey: ['workshops-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshops')
        .select('*, instructor:user_profiles!workshops_instructor_id_fkey(id, full_name, avatar_url)')
        .neq('status', 'draft')
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

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
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse overflow-hidden">
                  <div className="h-48 bg-muted" />
                  <CardContent className="p-5 space-y-3">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-10 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : workshops.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">No workshops available right now. Check back soon!</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {workshops.map((ws: any) => {
                const startDt = new Date(`${ws.start_date}T${ws.start_time || '00:00'}`);
                const count = regCounts[ws.id] || 0;
                const slotsLeft = ws.max_participants ? ws.max_participants - count : null;
                const isFull = slotsLeft !== null && slotsLeft <= 0;
                const instructor = ws.instructor;
                const status = statusConfig[ws.status] || statusConfig.published;
                const isLive = ws.status === 'ongoing';

                return (
                  <Card
                    key={ws.id}
                    className="group overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-border/60 hover:border-primary/30 flex flex-col"
                    onClick={() => {
                      if (ws.slug) navigate(`/workshops/${ws.slug}`);
                      else navigate(`/workshops/${ws.id}`);
                    }}
                  >
                    {/* Image Container — square ratio */}
                    <div className="relative aspect-square overflow-hidden bg-muted">
                      {ws.thumbnail_url ? (
                        <img
                          src={ws.thumbnail_url}
                          alt={ws.title}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                          <Sparkles className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                      )}
                      {/* Overlay gradient for text readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                      {/* Status & type badges - top */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                        <Badge className={`${status.className} border backdrop-blur-sm text-xs font-medium`}>
                          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mr-1.5" />}
                          {status.label}
                        </Badge>
                        <Badge variant="secondary" className="backdrop-blur-sm bg-black/40 text-white border-none text-xs">
                          {ws.workshop_type === 'multi_day' ? 'Multi-Day' : 'One Day'}
                        </Badge>
                      </div>

                      {/* Countdown overlay - bottom of image */}
                      {ws.status !== 'completed' && ws.status !== 'cancelled' && startDt > new Date() && (
                        <div className="absolute bottom-3 left-3 right-3">
                          <CountdownTimer targetDate={startDt} compact className="text-white/90 text-xs" />
                        </div>
                      )}
                    </div>

                    {/* Card Body */}
                    <CardContent className="p-4 flex-1 flex flex-col gap-3">
                      <h3 className="font-heading font-semibold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {ws.title}
                      </h3>

                      {instructor && (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 ring-1 ring-border">
                            <AvatarImage src={instructor.avatar_url || ''} />
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {instructor.full_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground truncate">{instructor.full_name}</span>
                        </div>
                      )}

                      {/* Meta row */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          {format(new Date(ws.start_date), 'MMM dd, yyyy')}
                        </span>
                        {ws.start_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            {ws.start_time.slice(0, 5)}
                          </span>
                        )}
                      </div>

                      {/* Slots info */}
                      <div className="flex items-center gap-2 text-xs mt-auto">
                        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{count}</span>
                        <span className="text-muted-foreground">registered</span>
                        {slotsLeft !== null && (
                          <span className={`ml-auto font-medium ${isFull ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
                            {isFull ? 'Full' : `${slotsLeft} slots left`}
                          </span>
                        )}
                      </div>

                      {/* CTA */}
                      <Button
                        className="w-full gap-2 mt-1"
                        size="sm"
                        variant={isFull ? 'secondary' : 'default'}
                        disabled={isFull && ws.status === 'published'}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (ws.slug) navigate(`/workshops/${ws.slug}`);
                          else navigate(`/workshops/${ws.id}`);
                        }}
                      >
                        {isFull ? 'Fully Booked' : 'View & Register'}
                        {!isFull && <ArrowRight className="h-3.5 w-3.5" />}
                      </Button>
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
