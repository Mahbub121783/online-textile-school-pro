import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Award, Download, ExternalLink, AlertCircle, Lock, CheckCircle2, BookOpen, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { useProfileCompleteness } from '@/hooks/useProfileCompleteness';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { downloadCertificatePDF, type CertificateField, type CertificateData } from '@/lib/certificateRenderer';

const CertificatesPage = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { percentage, isComplete, incomplete, isLoading: completenessLoading } = useProfileCompleteness(profile);

  // All enrolled courses
  const { data: enrollments = [] } = useQuery({
    queryKey: ['my-enrollments-cert', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('enrollments')
        .select('course_id, completed_at, progress_pct, enrolled_at')
        .eq('user_id', user!.id);
      return data ?? [];
    },
  });
  const courseIds = enrollments.map((e: any) => e.course_id);
  const enrollmentMap = new Map(enrollments.map((e: any) => [e.course_id, e]));

  // Courses with cert_template_id + instructor name
  const { data: courses = [] } = useQuery({
    queryKey: ['enrolled-courses-detail', courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('id, title, slug, thumbnail_url, cert_template_id, certificate_threshold_pct, instructor_id, user_profiles!courses_instructor_id_fkey(full_name)')
        .in('id', courseIds);
      return data ?? [];
    },
  });

  // Issued certificates (course-based only here)
  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ['my-certificates', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('certificates')
        .select('*')
        .eq('user_id', user!.id)
        .is('workshop_id', null)
        .order('issued_at', { ascending: false });
      return data ?? [];
    },
  });
  const certMap = new Map(certificates.map((c: any) => [c.course_id, c]));

  // Workshop certificates
  const { data: workshopCerts = [] } = useQuery({
    queryKey: ['my-workshop-certs-page', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('certificates')
        .select('*, workshops!certificates_workshop_id_fkey(id, title, slug, thumbnail_url, instructor_name, instructor:user_profiles!workshops_instructor_id_fkey(full_name))')
        .eq('user_id', user!.id)
        .not('workshop_id', 'is', null)
        .order('issued_at', { ascending: false });
      return data ?? [];
    },
  });

  // Workshop registrations (for pending certificates)
  const { data: workshopRegs = [] } = useQuery({
    queryKey: ['my-workshop-regs-cert', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('workshop_registrations')
        .select('id, workshop_id, status, checked_in_at, workshops!workshop_registrations_workshop_id_fkey(id, title, slug, thumbnail_url, status, certificate_enabled, cert_template_id, certificate_min_attendance_pct)')
        .eq('user_id', user!.id);
      return (data ?? []).filter((r: any) => r.workshops?.certificate_enabled && r.workshops?.cert_template_id);
    },
  });

  const issuedWorkshopIds = new Set(workshopCerts.map((c: any) => c.workshop_id));
  const pendingWorkshopRegs = workshopRegs.filter((r: any) => !issuedWorkshopIds.has(r.workshop_id));

  const claimWorkshopMutation = useMutation({
    mutationFn: async (workshopId: string) => {
      const { data, error } = await supabase.rpc('claim_my_workshop_certificate', { _workshop_id: workshopId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Certificate claimed! 🎓');
      queryClient.invalidateQueries({ queryKey: ['my-workshop-certs-page', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['my-workshop-regs-cert', user?.id] });
    },
    onError: (e: any) => toast.error(e.message || 'Could not claim certificate'),
  });

  // Templates
  const templateIds = [...new Set(courses.map((c: any) => c.cert_template_id).filter(Boolean))];
  const { data: templates = [] } = useQuery({
    queryKey: ['cert-templates-for-student', templateIds],
    enabled: templateIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('certificate_templates').select('*').in('id', templateIds);
      return data ?? [];
    },
  });
  const templateMap = new Map(templates.map((t: any) => [t.id, t]));

  // Grade configs for mapping score → letter grade
  const { data: gradeConfigs = [] } = useQuery({
    queryKey: ['grade-configs-cert'],
    queryFn: async () => {
      const { data } = await supabase
        .from('grade_configs')
        .select('*')
        .eq('is_active', true)
        .order('min_pct', { ascending: false });
      return data ?? [];
    },
  });

  // Best quiz scores per course
  const { data: quizAttempts = [] } = useQuery({
    queryKey: ['cert-quiz-attempts', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('quiz_attempts')
        .select('quiz_id, percentage, passed')
        .eq('user_id', user!.id)
        .order('percentage', { ascending: false });
      return data ?? [];
    },
  });
  const { data: quizzes = [] } = useQuery({
    queryKey: ['cert-quizzes', courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('quizzes').select('id, course_id, pass_percentage').in('course_id', courseIds).eq('is_published', true);
      return data ?? [];
    },
  });

  // Helper: map score to grade
  const getGradeFromScore = (score: number | null) => {
    if (score == null || gradeConfigs.length === 0) return { letter: '', point: '' };
    const match = gradeConfigs.find((g: any) => score >= g.min_pct && score <= g.max_pct);
    if (!match) return { letter: '', point: '' };
    const maxGP = Math.max(...gradeConfigs.map((g: any) => g.grade_point));
    return {
      letter: match.letter_grade,
      point: `${match.grade_point.toFixed(2)} / ${maxGP.toFixed(2)}`,
    };
  };

  const downloadMutation = useMutation({
    mutationFn: async (cert: any) => {
      const course = courses.find((c: any) => c.id === cert.course_id);
      const template = templateMap.get(course?.cert_template_id) || cert.template_snapshot;
      const fieldsConfig: CertificateField[] = template?.fields_config || [];
      const grade = getGradeFromScore(cert.score_percentage);
      const data: CertificateData = {
        student_name: profile?.full_name || 'Student',
        course_title: course?.title || 'Course',
        certificate_number: cert.certificate_number,
        completion_date: cert.issued_at ? format(new Date(cert.issued_at), 'MMMM dd, yyyy') : '',
        instructor_signature: (course as any)?.user_profiles?.full_name || '',
        grade_letter: grade.letter,
        grade_point: grade.point,
      };
      await downloadCertificatePDF(template?.background_url || null, fieldsConfig, data, `certificate-${cert.certificate_number}.pdf`);
      await supabase.from('certificates').update({
        download_count: (cert.download_count || 0) + 1,
        downloaded_at: new Date().toISOString(),
      } as any).eq('id', cert.id);
    },
    onSuccess: () => toast.success('Certificate downloaded!'),
    onError: (e: any) => toast.error(e.message || 'Download failed'),
  });

  // Build per-course status
  const getRequirements = (course: any) => {
    const enrollment = enrollmentMap.get(course.id);
    const cert = certMap.get(course.id);
    const template = templateMap.get(course.cert_template_id);
    const missing: string[] = [];
    let status: 'earned' | 'not_passed' | 'in_progress' = 'in_progress';

    if (cert) return { status: 'earned' as const, missing, cert };

    // Profile check
    if (!isComplete) missing.push(`Profile ${percentage}% complete (need 100%)`);

    // Course completion
    const progressPct = enrollment?.progress_pct || 0;
    const threshold = course.certificate_threshold_pct || 100;
    if (progressPct < threshold) missing.push(`Course ${progressPct}% complete (need ${threshold}%)`);

    // Gradebook pass check (quiz scores)
    if (template?.download_rule === 'gradebook_pass') {
      const courseQuizzes = quizzes.filter((q: any) => q.course_id === course.id);
      if (courseQuizzes.length > 0) {
        const avgScore = courseQuizzes.reduce((sum: number, q: any) => {
          const best = quizAttempts.find((a: any) => a.quiz_id === q.id);
          return sum + (best?.percentage || 0);
        }, 0) / courseQuizzes.length;
        const minScore = template.min_score_pct || 60;
        if (avgScore < minScore) missing.push(`Quiz avg ${Math.round(avgScore)}% (need ${minScore}%)`);
      }
    }

    if (missing.length > 0 && progressPct >= 50) status = 'not_passed';
    return { status, missing, cert: null };
  };

  const earned = courses.filter((c: any) => certMap.has(c.id));
  const pending = courses.filter((c: any) => !certMap.has(c.id));

  if (isLoading) {
    return <div className="animate-pulse text-muted-foreground py-12 text-center">Loading certificates...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold">My Certificates</h2>

      {!completenessLoading && !isComplete && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-heading font-bold text-sm text-amber-800 dark:text-amber-200">
                Profile {percentage}% Complete — Certificate downloads locked
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                Missing: {incomplete.map(f => f.label).join(', ')}
              </p>
              <Progress value={percentage} className="h-1.5 mt-2" />
              <Button size="sm" variant="outline" className="mt-2 border-amber-300 text-amber-800 dark:text-amber-200" onClick={() => navigate('/dashboard/settings')}>
                Complete Profile
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Earned Certificates */}
      {earned.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-heading font-bold text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" /> Earned Certificates
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {earned.map((course: any) => {
              const cert = certMap.get(course.id);
              const eligible = isComplete;
              return (
                <Card key={course.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Award className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-heading font-bold text-sm line-clamp-2">{course.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">#{cert.certificate_number}</p>
                        <p className="text-xs text-muted-foreground">Issued: {format(new Date(cert.issued_at), 'dd MMM yyyy')}</p>
                        {cert.score_percentage !== null && (
                          <p className="text-xs mt-0.5">Score: <span className="font-medium text-primary">{cert.score_percentage}%</span></p>
                        )}
                      </div>
                      <Badge variant="default" className="gap-1 shrink-0">
                        <CheckCircle2 className="h-3 w-3" /> Earned
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 flex-1"
                        disabled={!eligible || downloadMutation.isPending}
                        onClick={() => downloadMutation.mutate(cert)}
                      >
                        {eligible ? <><Download className="h-3.5 w-3.5" /> Download PDF</> : <><Lock className="h-3.5 w-3.5" /> Locked</>}
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1" onClick={() => window.open(`/verify-certificate?cert=${cert.certificate_number}`, '_blank')}>
                        <ExternalLink className="h-3.5 w-3.5" /> Verify
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Workshop Certificates */}
      {workshopCerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-heading font-bold text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" /> Workshop Certificates
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workshopCerts.map((cert: any) => {
              const ws = cert.workshops;
              const eligible = isComplete;
              const handleDownload = async () => {
                const tpl: any = cert.template_snapshot;
                const fields: CertificateField[] = tpl?.fields_config || [];
                const data: CertificateData = {
                  student_name: profile?.full_name || 'Student',
                  course_title: ws?.title || 'Workshop',
                  certificate_number: cert.certificate_number,
                  completion_date: cert.issued_at ? format(new Date(cert.issued_at), 'MMMM dd, yyyy') : '',
                  instructor_signature: ws?.instructor?.full_name || ws?.instructor_name || '',
                };
                try {
                  await downloadCertificatePDF(tpl?.background_url || null, fields, data, `certificate-${cert.certificate_number}.pdf`);
                  await supabase.from('certificates').update({
                    download_count: (cert.download_count || 0) + 1,
                    downloaded_at: new Date().toISOString(),
                  } as any).eq('id', cert.id);
                  toast.success('Certificate downloaded!');
                } catch (e: any) {
                  toast.error(e.message || 'Download failed');
                }
              };
              return (
                <Card key={cert.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="h-1 bg-gradient-to-r from-accent via-primary to-accent" />
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                        <Award className="h-5 w-5 text-accent" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-heading font-bold text-sm line-clamp-2">{ws?.title || 'Workshop'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">#{cert.certificate_number}</p>
                        <p className="text-xs text-muted-foreground">Issued: {cert.issued_at ? format(new Date(cert.issued_at), 'dd MMM yyyy') : '—'}</p>
                      </div>
                      <Badge variant="default" className="gap-1 shrink-0"><CheckCircle2 className="h-3 w-3" /> Workshop</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1 flex-1" disabled={!eligible} onClick={handleDownload}>
                        {eligible ? <><Download className="h-3.5 w-3.5" /> Download PDF</> : <><Lock className="h-3.5 w-3.5" /> Locked</>}
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1" onClick={() => window.open(`/verify-certificate?cert=${cert.certificate_number}`, '_blank')}>
                        <ExternalLink className="h-3.5 w-3.5" /> Verify
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Workshop Certificates */}
      {pendingWorkshopRegs.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-heading font-bold text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-accent" /> Pending Workshop Certificates
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingWorkshopRegs.map((reg: any) => {
              const ws = reg.workshops;
              const completed = ws?.status === 'completed';
              const attendanceReq = (ws?.certificate_min_attendance_pct || 0) > 0;
              const attended = !attendanceReq || !!reg.checked_in_at;
              const reqs: { ok: boolean; label: string }[] = [
                { ok: completed, label: completed ? 'Workshop completed' : `Workshop status: ${ws?.status || 'pending'}` },
                { ok: isComplete, label: isComplete ? 'Profile 100% complete' : `Profile ${percentage}% complete (need 100%)` },
              ];
              if (attendanceReq) reqs.push({ ok: attended, label: attended ? 'Attendance confirmed' : 'Attendance not marked' });
              const canClaim = completed && isComplete && attended;
              return (
                <Card key={reg.id} className="overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-accent/40 via-primary/40 to-accent/40" />
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {ws?.thumbnail_url ? (
                        <img src={ws.thumbnail_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                          <Award className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-heading font-bold text-sm line-clamp-2">{ws?.title || 'Workshop'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Workshop certificate</p>
                      </div>
                      <Badge variant={completed ? 'secondary' : 'outline'} className="gap-1 shrink-0">
                        {completed ? <><Clock className="h-3 w-3" /> Ready to claim</> : <><Clock className="h-3 w-3" /> Awaiting</>}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {reqs.map((r, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {r.ok ? <CheckCircle2 className="h-3 w-3 text-primary shrink-0" /> : <XCircle className="h-3 w-3 text-destructive shrink-0" />}
                          <span>{r.label}</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      className="w-full gap-1"
                      disabled={!canClaim || claimWorkshopMutation.isPending}
                      onClick={() => claimWorkshopMutation.mutate(reg.workshop_id)}
                    >
                      {canClaim ? <><Award className="h-3.5 w-3.5" /> Claim Certificate</> : <><Lock className="h-3.5 w-3.5" /> Locked</>}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-heading font-bold text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-muted-foreground" /> Pending Certificates
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.map((course: any) => {
              const enrollment = enrollmentMap.get(course.id);
              const req = getRequirements(course);
              const progressPct = enrollment?.progress_pct || 0;

              return (
                <Card key={course.id} className="overflow-hidden opacity-90">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {course.thumbnail_url ? (
                        <img src={course.thumbnail_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                          <BookOpen className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-heading font-bold text-sm line-clamp-2">{course.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{progressPct}% complete</p>
                      </div>
                      <Badge variant={req.status === 'not_passed' ? 'destructive' : 'secondary'} className="gap-1 shrink-0">
                        {req.status === 'not_passed' ? (
                          <><XCircle className="h-3 w-3" /> Not Passed</>
                        ) : (
                          <><Clock className="h-3 w-3" /> In Progress</>
                        )}
                      </Badge>
                    </div>

                    <Progress value={progressPct} className="h-1.5" />

                    {req.missing.length > 0 && (
                      <div className="space-y-1">
                        {req.missing.map((m, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <XCircle className="h-3 w-3 text-destructive shrink-0" />
                            <span>{m}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button size="sm" variant="outline" className="w-full" onClick={() => navigate(`/courses/${course.slug}`)}>
                      Continue Course
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {courses.length === 0 && certificates.length === 0 && workshopCerts.length === 0 && workshopRegs.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Award className="h-16 w-16 mx-auto mb-4 text-muted" />
          <h3 className="font-heading font-bold text-lg mb-2">No certificates yet</h3>
          <p>Enroll in a course and complete it to earn your certificate.</p>
        </div>
      )}
    </div>
  );
};

export default CertificatesPage;
