import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, ExternalLink, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isPast, isFuture } from 'date-fns';
import SEOHead from '@/components/SEOHead';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';

const eventTypeColors: Record<string, string> = {
  webinar: 'bg-primary/10 text-primary',
  workshop: 'bg-accent/10 text-accent-foreground',
  exam_schedule: 'bg-destructive/10 text-destructive',
  deadline: 'bg-secondary text-secondary-foreground',
  general: 'bg-muted text-muted-foreground',
};

const EventsPage = () => {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events-public'],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('id, title, description, event_date, image_url, location').order('event_date', { ascending: true }).limit(100);
      return data ?? [];
    },
  });

  const upcoming = events.filter((e: any) => isFuture(new Date(e.event_date)));
  const past = events.filter((e: any) => isPast(new Date(e.event_date)));

  const EventCard = ({ event }: { event: any }) => (
    <Card className={`overflow-hidden transition-all hover:shadow-lg ${isPast(new Date(event.event_date)) ? 'opacity-60' : ''}`}>
      {event.image_url && (
        <div className="aspect-video overflow-hidden">
          <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
        </div>
      )}
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={eventTypeColors[event.event_type] || eventTypeColors.general}>
            {event.event_type?.replace('_', ' ')}
          </Badge>
          {event.is_featured && <Badge variant="secondary">Featured</Badge>}
          {isPast(new Date(event.event_date)) && <Badge variant="outline">Past</Badge>}
        </div>
        <h3 className="font-heading font-bold text-lg">{event.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-3">{event.description}</p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{format(new Date(event.event_date), 'MMM dd, yyyy')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{format(new Date(event.event_date), 'hh:mm a')}</span>
          </div>
        </div>
        {event.link && (
          <Button asChild size="sm" variant="outline" className="w-full">
            <a href={event.link} target="_blank" rel="noopener noreferrer">
              Join / Details <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead
        title="Events & Academic Calendar"
        description="Stay updated with upcoming webinars, workshops, exams, and important deadlines at Online Textile School."
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Events', url: '/events' },
        ]}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Events — Online Textile School',
          url: 'https://onlinetextileschool.com/events',
        }}
      />
      <Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <section className="bg-gradient-to-br from-primary/10 to-accent/10 py-12 md:py-16">
          <div className="container text-center">
            <Calendar className="h-12 w-12 mx-auto text-primary mb-4" />
            <h1 className="text-3xl md:text-4xl font-heading font-bold mb-3">Events & Academic Calendar</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">Stay updated with upcoming webinars, workshops, exams, and important deadlines.</p>
          </div>
        </section>

        <section className="container py-12 space-y-10">
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>
          ) : events.length === 0 ? (
            <div className="text-center py-16"><Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground text-lg">No events scheduled yet.</p></div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div>
                  <h2 className="text-xl font-heading font-bold mb-4">Upcoming Events</h2>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{upcoming.map((e: any) => <EventCard key={e.id} event={e} />)}</div>
                </div>
              )}
              {past.length > 0 && (
                <div>
                  <h2 className="text-xl font-heading font-bold mb-4">Past Events</h2>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{past.map((e: any) => <EventCard key={e.id} event={e} />)}</div>
                </div>
              )}
            </>
          )}
        </section>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default EventsPage;
