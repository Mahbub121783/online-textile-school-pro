import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfileCompleteness } from '@/hooks/useProfileCompleteness';
import { downloadEnrollmentLetter, EnrollmentLetterSettings } from '@/lib/enrollmentLetterRenderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, GraduationCap, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function EnrollmentLetters() {
  const { user, profile } = useAuth();
  const { isComplete, percentage } = useProfileCompleteness(profile);
  const [downloading, setDownloading] = useState<'course' | 'general' | null>(null);

  const { data: idCard } = useQuery({
    queryKey: ['student-id-card', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('student_id_cards').select('*').eq('user_id', user!.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['paid-enrollments-letter', user?.id],
    queryFn: async () => {
      // `payment_id` alone isn't proof of payment -- it's set for every
      // checkout including $0 free courses. Only orders that actually
      // completed for a nonzero total count (matches ensureStudentIdCard.ts
      // and the server-side enforce_student_id_card_integrity() trigger).
      const { data: paidOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .gt('total', 0);
      const paidOrderIds = (paidOrders || []).map((o) => o.id);
      if (paidOrderIds.length === 0) return [];

      const { data } = await supabase
        .from('enrollments')
        .select('enrolled_at, courses(title)')
        .eq('user_id', user!.id)
        .in('payment_id', paidOrderIds)
        .order('enrolled_at', { ascending: true });
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: settings } = useQuery({
    queryKey: ['id-card-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('id_card_settings').select('*').limit(1).single();
      return data as unknown as EnrollmentLetterSettings;
    },
  });

  if (!idCard || enrollments.length === 0) return null;

  const academicYear = (() => {
    const y = new Date(idCard.valid_from).getFullYear();
    return `${y}–${y + 1}`;
  })();

  // Derived from the card's real valid_from/valid_until, which are the
  // authoritative dates computed server-side by
  // enforce_student_id_card_integrity() (db/67-id-card-tiered-duration.sql)
  // -- avoids duplicating that tiered duration formula here.
  const programMonths = Math.round(
    (new Date(idCard.valid_until).getTime() - new Date(idCard.valid_from).getTime()) / (30.44 * 24 * 60 * 60 * 1000)
  );

  const buildData = () => ({
    studentName: profile?.full_name?.trim() || 'Student',
    rollId: profile?.roll_id?.trim() || '—',
    department: (profile as any)?.department?.trim() || (profile as any)?.campus?.trim() || '—',
    academicYear,
    cardNumber: idCard.card_number,
    validFrom: idCard.valid_from,
    validUntil: idCard.valid_until,
    programMonths,
    courses: enrollments.map((e: any) => ({ title: (e.courses?.title || 'Course').trim(), enrolledAt: e.enrolled_at })),
  });

  const canDownload = isComplete;

  const handleDownload = async (type: 'course' | 'general') => {
    if (!settings) return;
    setDownloading(type);
    try {
      await downloadEnrollmentLetter(type, buildData(), settings);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Enrollment Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Official, independently-verifiable documents for student-status / discount eligibility checks (e.g. SheerID, UNiDAYS).
          Each includes a scannable QR code that confirms your record directly from our system.
        </p>
        {!canDownload && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">Profile {percentage}% complete.</span> Complete your profile to download.{' '}
              <Link to="/dashboard/settings" className="underline font-medium">Complete Profile →</Link>
            </AlertDescription>
          </Alert>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-auto py-3 flex-col items-start gap-1"
            disabled={!canDownload || downloading !== null || !settings}
            onClick={() => handleDownload('course')}
          >
            <span className="flex items-center gap-2 font-medium text-sm">
              <GraduationCap className="h-4 w-4" /> Enrollment Verification Letter
            </span>
            <span className="text-xs text-muted-foreground text-left font-normal">Course-specific, official letter with signature &amp; seal</span>
            <span className="flex items-center gap-1 text-xs mt-1 text-primary">
              {downloading === 'course' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3 w-3" />}
              Download PDF
            </span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-3 flex-col items-start gap-1"
            disabled={!canDownload || downloading !== null || !settings}
            onClick={() => handleDownload('general')}
          >
            <span className="flex items-center gap-2 font-medium text-sm">
              <FileText className="h-4 w-4" /> Signed School Letter
            </span>
            <span className="text-xs text-muted-foreground text-left font-normal">General student-status confirmation letter</span>
            <span className="flex items-center gap-1 text-xs mt-1 text-primary">
              {downloading === 'general' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3 w-3" />}
              Download PDF
            </span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
