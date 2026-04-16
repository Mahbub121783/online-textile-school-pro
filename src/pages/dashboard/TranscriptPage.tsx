import { TableSkeleton } from '@/components/ui/loading-skeletons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, GraduationCap, FileText } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

const TranscriptPage = () => {
  const { user, profile } = useAuth();

  // Fetch student grades with course info
  const { data: grades = [], isLoading } = useQuery({
    queryKey: ['student-grades-transcript', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_grades')
        .select('*, courses(title, total_lessons)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  // Fetch completed enrollments
  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments-transcript', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('enrollments')
        .select('*, courses(title)')
        .eq('user_id', user!.id)
        .not('completed_at', 'is', null);
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  // Fetch ID card settings for branding
  const { data: settings } = useQuery({
    queryKey: ['id-card-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('id_card_settings').select('*').limit(1).single();
      return data;
    },
  });

  // Fetch batch info
  const { data: batchInfo } = useQuery({
    queryKey: ['student-batch', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('batch_students')
        .select('*, batches(name, start_date, end_date)')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Calculate GPA
  const totalCredits = grades.reduce((sum: number, g: any) => sum + (g.credits || 0), 0);
  const weightedPoints = grades.reduce((sum: number, g: any) => sum + (g.grade_point || 0) * (g.credits || 0), 0);
  const cgpa = totalCredits > 0 ? (weightedPoints / totalCredits).toFixed(2) : 'N/A';

  const generatePDF = async () => {
    const doc = new jsPDF();
    const universityName = settings?.university_name || 'Online Textile University';
    const location = settings?.location || '';

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(universityName, 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (location) doc.text(location, 105, 27, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ACADEMIC TRANSCRIPT', 105, 38, { align: 'center' });

    // Student Info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let y = 50;
    doc.text(`Student Name: ${profile?.full_name || 'N/A'}`, 20, y);
    doc.text(`Roll ID: ${profile?.roll_id || 'N/A'}`, 120, y);
    y += 7;
    if (batchInfo?.batches) {
      doc.text(`Batch: ${batchInfo.batches.name}`, 20, y);
      y += 7;
    }
    doc.text(`CGPA: ${cgpa}`, 20, y);
    doc.text(`Total Credits: ${totalCredits}`, 120, y);
    y += 7;
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, y);
    y += 12;

    // Grades Table
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(20, y, 170, 8, 'F');
    doc.text('Course', 22, y + 6);
    doc.text('Grade', 120, y + 6);
    doc.text('Points', 145, y + 6);
    doc.text('Credits', 170, y + 6);
    y += 10;

    doc.setFont('helvetica', 'normal');
    for (const g of grades as any[]) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.text((g.courses?.title || 'Unknown').substring(0, 45), 22, y + 5);
      doc.text(g.letter_grade || '—', 122, y + 5);
      doc.text(String(g.grade_point ?? '—'), 147, y + 5);
      doc.text(String(g.credits ?? '—'), 172, y + 5);
      doc.line(20, y + 8, 190, y + 8);
      y += 10;
    }

    // If no grades, show completed courses
    if (grades.length === 0 && enrollments.length > 0) {
      doc.text('Completed Courses:', 22, y + 5);
      y += 10;
      for (const e of enrollments as any[]) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.text(`• ${e.courses?.title || 'Unknown'}`, 24, y + 5);
        doc.text(`Completed: ${new Date(e.completed_at).toLocaleDateString()}`, 120, y + 5);
        y += 8;
      }
    }

    // QR Code for verification
    try {
      const verificationUrl = `${window.location.origin}/verify-transcript?student=${profile?.roll_id || user?.id}&cgpa=${cgpa}&credits=${totalCredits}`;
      const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 80, margin: 1 });
      y = Math.max(y + 10, 230);
      doc.addImage(qrDataUrl, 'PNG', 155, y, 25, 25);
      doc.setFontSize(7);
      doc.text('Scan to verify', 167.5, y + 28, { align: 'center' });
    } catch {}

    // Footer
    y = Math.max(y + 20, 260);
    doc.setFontSize(8);
    doc.text('This is a digitally generated transcript with QR verification.', 105, y, { align: 'center' });
    if (settings?.authority_name) {
      doc.text(`${settings.authority_name} — ${settings.authority_position || ''}`, 105, y + 5, { align: 'center' });
    }

    doc.save(`transcript_${profile?.roll_id || 'student'}.pdf`);
    toast.success('Transcript downloaded');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" /> Academic Transcript
          </h1>
          <p className="text-sm text-muted-foreground">View and download your official transcript</p>
        </div>
        <Button onClick={generatePDF} className="gap-2" disabled={isLoading}>
          <Download className="h-4 w-4" /> Download PDF
        </Button>
      </div>

      {/* Student Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Student Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="font-medium text-sm">{profile?.full_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Roll ID</p>
              <p className="font-medium text-sm">{profile?.roll_id || 'N/A'}</p>
            </div>
            {batchInfo?.batches && (
              <div>
                <p className="text-xs text-muted-foreground">Batch</p>
                <p className="font-medium text-sm">{batchInfo.batches.name}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">CGPA</p>
              <p className="font-heading font-bold text-lg text-primary">{cgpa}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grades Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <GraduationCap className="h-5 w-5" /> Grade Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} columns={5} />
          ) : grades.length === 0 ? (
            <div className="text-center py-8">
              <GraduationCap className="h-10 w-10 mx-auto mb-3 text-muted" />
              <p className="text-muted-foreground">No grades recorded yet.</p>
              {enrollments.length > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  You have {enrollments.length} completed course(s) — grades will appear when published.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {(grades as any[]).map((g: any) => (
                <div key={g.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">{g.courses?.title || 'Unknown Course'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{g.letter_grade}</Badge>
                    <span className="text-sm text-muted-foreground">{g.grade_point} pts</span>
                    <span className="text-sm text-muted-foreground">{g.credits} cr</span>
                  </div>
                </div>
              ))}
              <Separator className="my-3" />
              <div className="flex justify-between items-center">
                <span className="font-medium">Total</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm">{totalCredits} credits</span>
                  <Badge className="text-sm">CGPA: {cgpa}</Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TranscriptPage;
