import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CountdownTimer } from '@/components/workshop/CountdownTimer';
import { Calendar, Download, Video } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export default function MyWorkshopsPage() {
  const { user } = useAuth();

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ['my-workshop-registrations', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshop_registrations')
        .select('*, workshops(*, instructor:user_profiles!workshops_instructor_id_fkey(id, full_name, avatar_url))')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  if (isLoading) return <div className="p-6"><div className="animate-pulse h-32 bg-muted rounded-lg" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">My Workshops</h1>
        <p className="text-sm text-muted-foreground">Workshops you've registered for</p>
      </div>

      {registrations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <p>You haven't registered for any workshops yet.</p>
            <Link to="/workshops"><Button variant="outline" className="mt-3">Browse Workshops</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {registrations.map((reg: any) => {
            const ws = reg.workshops;
            if (!ws) return null;
            const startDt = new Date(`${ws.start_date}T${ws.start_time || '00:00'}`);
            const isUpcoming = startDt > new Date();
            const isOngoing = ws.status === 'ongoing';
            const materials = (ws.materials as any[]) || [];

            return (
              <Card key={reg.id}>
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {ws.thumbnail_url && (
                      <img src={ws.thumbnail_url} alt={ws.title} className="w-full md:w-32 h-20 rounded-lg object-cover" />
                    )}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-heading font-semibold">{ws.title}</h3>
                        <Badge variant="outline">{ws.status}</Badge>
                        <Badge variant="secondary" className="text-[10px]">#{reg.registration_number}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(ws.start_date), 'MMM dd, yyyy')}</span>
                        {ws.instructor?.full_name && <span>by {ws.instructor.full_name}</span>}
                      </div>
                      {isUpcoming && <CountdownTimer targetDate={startDt} compact className="text-xs" />}

                      <div className="flex flex-wrap gap-2 mt-2">
                        <Link to={`/workshops/${ws.slug}`}>
                          <Button size="sm" variant="outline">View Details</Button>
                        </Link>
                        {(isOngoing || !isUpcoming) && ws.meet_link && (
                          <a href={ws.meet_link} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" className="gap-1"><Video className="h-3.5 w-3.5" />Join</Button>
                          </a>
                        )}
                        {materials.length > 0 && (
                          <Badge variant="outline" className="gap-1"><Download className="h-3 w-3" />{materials.length} materials</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
