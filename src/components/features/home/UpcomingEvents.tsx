import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Calendar, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const UpcomingEvents = () => {
  const { data: events = [] } = useQuery({
    queryKey: ['upcoming-events-home'],
    queryFn: async () => {
      const { data } = await supabase
        .from('events')
        .select('id, title, description, event_date, event_type, image_url, link, is_featured')
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(3);
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
    retry: 0,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  if (events.length === 0) return null;

  return (
    <section className="py-12 bg-secondary/30">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-heading text-2xl md:text-3xl font-bold">Upcoming Events</h2>
            <p className="text-muted-foreground mt-1">Don't miss out on our latest events</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/events">View All <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {events.map((event) => (
            <div key={event.id} className="bg-card border rounded-xl p-5 hover:shadow-md transition-shadow">
              {event.image_url && (
                <img src={event.image_url} alt={event.title} className="w-full h-36 object-cover rounded-lg mb-3" />
              )}
              <div className="flex items-center gap-2 text-xs text-primary mb-2">
                <Calendar className="h-3.5 w-3.5" />
                <span>{format(new Date(event.event_date), 'dd MMM yyyy, hh:mm a')}</span>
              </div>
              <h3 className="font-heading font-bold text-lg line-clamp-2">{event.title}</h3>
              {event.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default UpcomingEvents;
