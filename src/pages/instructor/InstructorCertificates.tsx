import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Award, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useEffect, useRef } from 'react';
import { renderCertificateToCanvas, type CertificateData } from '@/lib/certificateRenderer';

const InstructorCertificates = () => {
  const { user } = useAuth();
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const { data: courses = [] } = useQuery({
    queryKey: ['instructor-courses-cert', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title, cert_template_id').eq('instructor_id', user!.id);
      return data ?? [];
    },
  });

  const courseIds = courses.map((c: any) => c.id);
  const templateIds = [...new Set(courses.map((c: any) => c.cert_template_id).filter(Boolean))];

  const { data: templates = [] } = useQuery({
    queryKey: ['instructor-cert-templates', templateIds],
    enabled: templateIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('certificate_templates').select('*').in('id', templateIds);
      return data ?? [];
    },
  });

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ['instructor-certificates', user?.id],
    enabled: !!user && courseIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('certificates')
        .select('*, user_profiles!certificates_user_id_fkey(full_name)')
        .in('course_id', courseIds)
        .order('issued_at', { ascending: false });
      const courseMap = new Map(courses.map((c: any) => [c.id, c.title]));
      return (data ?? []).map((cert: any) => ({ ...cert, course_title: courseMap.get(cert.course_id) }));
    },
  });

  // Preview rendering
  useEffect(() => {
    if (!previewTemplate || !previewCanvasRef.current) return;
    const sampleData: CertificateData = {
      student_name: 'John Doe',
      course_title: 'Sample Course',
      certificate_number: 'CERT-PREVIEW',
      completion_date: format(new Date(), 'MMMM dd, yyyy'),
      instructor_signature: 'Instructor',
      grade_letter: 'A+',
      grade_point: '4.00 / 4.00',
    };
    renderCertificateToCanvas(previewTemplate.background_url, previewTemplate.fields_config || [], sampleData).then(offscreen => {
      const canvas = previewCanvasRef.current!;
      const w = canvas.parentElement?.clientWidth || 500;
      const h = w / (1122 / 793);
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(offscreen, 0, 0, w, h);
    });
  }, [previewTemplate]);

  const totalDownloads = certificates.reduce((sum: number, c: any) => sum + (c.download_count || 0), 0);

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold">Certificates</h2>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">{certificates.length}</p>
          <p className="text-xs text-muted-foreground">Issued</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">{templates.length}</p>
          <p className="text-xs text-muted-foreground">Templates</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">{totalDownloads}</p>
          <p className="text-xs text-muted-foreground">Downloads</p>
        </div>
      </div>

      <Tabs defaultValue="issued">
        <TabsList>
          <TabsTrigger value="issued">Issued Certificates</TabsTrigger>
          <TabsTrigger value="templates">My Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="issued">
          {certificates.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Award className="h-16 w-16 mx-auto mb-4 text-muted" />
              <h3 className="font-heading font-bold text-lg mb-2">No certificates yet</h3>
              <p>Certificates will appear here when students complete your courses.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Certificate #</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Downloads</TableHead>
                    <TableHead className="text-right">Issued</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certificates.map((cert: any) => (
                    <TableRow key={cert.id}>
                      <TableCell className="font-mono text-xs">{cert.certificate_number}</TableCell>
                      <TableCell>{cert.user_profiles?.full_name || 'Student'}</TableCell>
                      <TableCell className="text-muted-foreground">{cert.course_title || '—'}</TableCell>
                      <TableCell className="text-center">
                        {cert.score_percentage ? <Badge variant={Number(cert.score_percentage) >= 80 ? 'default' : 'secondary'}>{cert.score_percentage}%</Badge> : '—'}
                      </TableCell>
                      <TableCell className="text-center">{cert.download_count || 0}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">
                        {cert.issued_at ? format(new Date(cert.issued_at), 'MMM dd, yyyy') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates">
          {templates.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No templates assigned to your courses yet.</p>
          ) : (
            <div className="space-y-4">
              {templates.map((tpl: any) => {
                const tplCourses = courses.filter((c: any) => c.cert_template_id === tpl.id);
                return (
                  <div key={tpl.id} className="border rounded-xl p-4 bg-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-heading font-bold text-sm">{tpl.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Courses: {tplCourses.map((c: any) => c.title).join(', ') || 'None'}
                        </p>
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {tpl.download_rule === 'gradebook_pass' ? `Score ≥ ${tpl.min_score_pct}%` : tpl.download_rule === 'course_complete' ? 'Course Complete' : 'Anytime'}
                        </Badge>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setPreviewTemplate(previewTemplate?.id === tpl.id ? null : tpl)}>
                        <Eye className="h-4 w-4 mr-1" /> Preview
                      </Button>
                    </div>
                    {previewTemplate?.id === tpl.id && (
                      <div className="mt-4 border rounded-lg overflow-hidden">
                        <canvas ref={previewCanvasRef} className="w-full" style={{ aspectRatio: '1122/793' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InstructorCertificates;
