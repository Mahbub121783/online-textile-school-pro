import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, Clock, Users, ArrowRight, Sparkles, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CountdownTimer } from '@/components/workshop/CountdownTimer';

const isPreviewOrEmbedded = (() => {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.self !== window.top ||
      window.location.hostname.includes('id-preview--') ||
      window.location.hostname.includes('lovable.app') ||
      window.location.hostname.includes('lovableproject.com')
    );
  } catch {
    return true;
  }
})();

const statusConfig: Record<string, { label: string; className: string }> = {
  published: { label: 'Upcoming', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  ongoing: { label: 'Live Now', className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' },
};

export default function FeaturedWorkshops() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const { data: workshops = [], isLoading } = useQuery({
    queryKey: ['featured-workshops', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshops')
        .select('*, instructor:user_profiles!workshops_instructor_id_fkey(id, full_name, avatar_url)')
        .in('status', ['published', 'ongoing'])
        .gte('start_date', today)
        .order('start_date', { ascending: true })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
    retry: 0,
    refetchOnMount: false,
    refetchOnReconnect: false,
    enabled: !isPreviewOrEmbedded,
  });

  const { data: regCounts = {} } = useQuery({
    queryKey: ['featured-workshops-counts', workshops.map((w: any) => w.id).join(',')],
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
    staleTime: 10 * 60 * 1000,
    retry: 0,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  if (isLoading) {
    return (
      <section className="py-16 container mx-auto px-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <div className="aspect-square bg-muted" />
              <CardContent className="p-4 space-y-3">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
                <div className="h-10 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  // Auto-hide if no workshops
  if (!workshops.length) return null;

  return (
    <section className="py-16 bg-gradient-to-b from-background via-muted/20 to-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
              <Zap className="h-3.5 w-3.5" />
              Live & Upcoming
            </div>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-2">
              Featured Workshops
            </h2>
            <p className="text-muted-foreground max-w-xl">
              Join hands-on, instructor-led sessions and level up your textile skills with real-world projects.
            </p>
          </div>
          <Button
            variant="ghost"
            className="gap-2 self-start sm:self-end"
            onClick={() => navigate('/workshops')}
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {workshops.map((ws: any) => {
            const startDt = new Date(`${ws.start_date}T${ws.start_time || '00:00'}`);
            const count = (regCounts[ws.id] || 0) + (ws.fake_registration_count || 0);
            const slotsLeft = ws.max_participants ? ws.max_participants - count : null;
            const isFull = slotsLeft !== null && slotsLeft <= 0;
            const instructor = ws.instructor;
            const status = statusConfig[ws.status] || statusConfig.published;
            const isLive = ws.status === 'ongoing';
            const target = ws.slug ? `/workshops/${ws.slug}` : `/workshops/${ws.id}`;

            return (
              <Card
                key={ws.id}
                className="group overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-border/60 hover:border-primary/40 flex flex-col"
                onClick={() => navigate(target)}
              >
                {/* Image */}
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
                      <Sparkles className="h-12 w-12 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                  {/* Top badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <Badge className={`${status.className} border backdrop-blur-sm text-xs font-medium`}>
                      {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mr-1.5" />}
                      {status.label}
                    </Badge>
                    <Badge variant="secondary" className="backdrop-blur-sm bg-black/40 text-white border-none text-xs">
                      {ws.workshop_type === 'multi_day' ? 'Multi-Day' : 'One Day'}
                    </Badge>
                  </div>

                  {/* Countdown */}
                  {!isLive && startDt > new Date() && (
                    <div className="absolute bottom-3 left-3 right-3">
                      <CountdownTimer targetDate={startDt} compact className="text-white/95 text-xs" />
                    </div>
                  )}
                </div>

                {/* Body */}
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

                  <div className="flex items-center gap-2 text-xs mt-auto">
                    <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium">{count}</span>
                    <span className="text-muted-foreground">registered</span>
                    {slotsLeft !== null && (
                      <span className={`ml-auto font-medium ${isFull ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
                        {isFull ? 'Full' : `${slotsLeft} left`}
                      </span>
                    )}
                  </div>

                  <Button
                    className="w-full gap-2 h-10"
                    size="sm"
                    variant={isFull ? 'secondary' : 'default'}
                    disabled={isFull && ws.status === 'published'}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(target);
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
      </div>
    </section>
  );
}
