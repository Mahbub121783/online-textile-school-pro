import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CountdownTimer } from '@/components/workshop/CountdownTimer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Download, Video, ExternalLink, FileText, FileImage, FileArchive, File, Play, Award } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { downloadCertificatePDF, type CertificateField, type CertificateData } from '@/lib/certificateRenderer';

const fileIcon = (type: string) => {
  if (['pdf'].includes(type)) return <FileText className="h-4 w-4 text-red-500" />;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(type)) return <FileImage className="h-4 w-4 text-blue-500" />;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(type)) return <FileArchive className="h-4 w-4 text-amber-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
};

export default function MyWorkshopsPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [materialsWs, setMaterialsWs] = useState<any>(null);

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

  const { data: workshopCerts = [] } = useQuery({
    queryKey: ['my-workshop-certs', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from('certificates').select('*').eq('user_id', user!.id).not('workshop_id', 'is', null);
      return data ?? [];
    },
  });
  const certByWs = new Map(workshopCerts.map((c: any) => [c.workshop_id, c]));

  const downloadCert = async (cert: any, ws: any) => {
    const tpl: any = cert.template_snapshot;
    const fields: CertificateField[] = tpl?.fields_config || [];
    const data: CertificateData = {
      student_name: profile?.full_name || 'Student',
      course_title: ws.title,
      certificate_number: cert.certificate_number,
      completion_date: cert.issued_at ? format(new Date(cert.issued_at), 'MMMM dd, yyyy') : '',
      instructor_signature: ws.instructor?.full_name || ws.instructor_name || '',
    };
    await downloadCertificatePDF(tpl?.background_url || null, fields, data, `certificate-${cert.certificate_number}.pdf`);
    await supabase.from('certificates').update({
      download_count: (cert.download_count || 0) + 1,
      downloaded_at: new Date().toISOString(),
    } as any).eq('id', cert.id);
    toast.success('Certificate downloaded');
  };

  const claimMutation = useMutation({
    mutationFn: async (workshopId: string) => {
      const { error } = await supabase.rpc('issue_workshop_certificate', { _workshop_id: workshopId, _user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Certificate issued! Click Download.');
      queryClient.invalidateQueries({ queryKey: ['my-workshop-certs', user?.id] });
    },
    onError: (e: any) => toast.error(e.message || 'Not eligible yet'),
  });

  if (isLoading) return <div className="p-6"><div className="animate-pulse h-32 bg-muted rounded-lg" /></div>;

  const materialsList = (materialsWs?.materials as any[]) || [];

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
            // Prefer timezone-correct start_at/end_at; fall back to legacy date+time.
            const startDt = ws.start_at
              ? new Date(ws.start_at)
              : new Date(`${ws.start_date}T${ws.start_time || '00:00'}:00`);
            const endDt = ws.end_at
              ? new Date(ws.end_at)
              : new Date(`${ws.end_date || ws.start_date}T${ws.end_time || ws.start_time || '23:59'}:00`);
            const now = Date.now();
            // Early-join window: 10 min before start, grace 30 min after end.
            const isWithinWindow = now >= startDt.getTime() - 10 * 60 * 1000 && now <= endDt.getTime() + 30 * 60 * 1000;
            const isOngoing = ws.status === 'ongoing';
            const isUpcoming = startDt.getTime() - 10 * 60 * 1000 > now;
            const isLive = (isOngoing || isWithinWindow) && ws.status !== 'completed' && ws.status !== 'cancelled';
            const materials = (ws.materials as any[]) || [];

            return (
              <Card key={reg.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    {/* Thumbnail */}
                    <div className="relative md:w-48 h-32 md:h-auto shrink-0">
                      {ws.thumbnail_url ? (
                        <img src={ws.thumbnail_url} alt={ws.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                          <Play className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                      )}
                      {isLive && (
                        <div className="absolute top-2 left-2">
                          <Badge className="bg-green-500 text-white border-none animate-pulse text-[10px]">● LIVE</Badge>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-5 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-heading font-semibold text-base">{ws.title}</h3>
                        <Badge variant="outline" className="text-[10px]">{ws.status}</Badge>
                        <Badge variant="secondary" className="text-[10px] font-mono">Roll: {reg.registration_number}</Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(ws.start_date), 'MMM dd, yyyy')}</span>
                        {ws.instructor?.full_name && <span>by {ws.instructor.full_name}</span>}
                        {ws.workshop_type === 'multi_day' && <Badge variant="outline" className="text-[10px]">Multi-Day</Badge>}
                      </div>

                      {isUpcoming && <CountdownTimer targetDate={startDt} compact className="text-xs" />}

                      <div className="flex flex-wrap gap-2 pt-1">
                        <Link to={`/workshops/${ws.slug || ws.id}`}>
                          <Button size="sm" variant="outline" className="gap-1 text-xs">
                            <ExternalLink className="h-3 w-3" /> View Details
                          </Button>
                        </Link>

                        {/* Start Workshop / Join Meet — prominent green button */}
                        {isLive && ws.meet_link && (
                          <a href={ws.meet_link} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs">
                              <Video className="h-3.5 w-3.5" /> Start Workshop
                            </Button>
                          </a>
                        )}

                        {/* Materials download button */}
                        {materials.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={() => setMaterialsWs(ws)}
                          >
                            <Download className="h-3 w-3" /> {materials.length} Material{materials.length > 1 ? 's' : ''}
                          </Button>
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

      {/* Materials Download Modal */}
      <Dialog open={!!materialsWs} onOpenChange={(open) => { if (!open) setMaterialsWs(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Workshop Materials
            </DialogTitle>
          </DialogHeader>
          {materialsWs && (
            <p className="text-sm text-muted-foreground -mt-2">{materialsWs.title}</p>
          )}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {materialsList.map((m: any, i: number) => (
              <a
                key={i}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
              >
                {fileIcon(m.type || '')}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{m.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{m.type || 'file'}</p>
                </div>
                <Button variant="ghost" size="sm" className="shrink-0 h-8 w-8 p-0">
                  <Download className="h-4 w-4" />
                </Button>
              </a>
            ))}
            {materialsList.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No materials available</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
