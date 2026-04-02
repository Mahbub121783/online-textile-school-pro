import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { renderIdCard, downloadIdCardPdf, IdCardData, IdCardSettings } from '@/lib/idCardRenderer';
import { ensureStudentIdCard } from '@/lib/ensureStudentIdCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, CreditCard, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  userId?: string; // If provided, admin viewing another student's card
}

export default function StudentIdCard({ userId }: Props) {
  const { user, profile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const targetId = userId || user?.id;
  const qc = useQueryClient();

  const { data: targetProfile } = useQuery({
    queryKey: ['id-card-profile', targetId],
    queryFn: async () => {
      if (!userId) return profile;
      const { data } = await supabase.from('user_profiles').select('*').eq('id', targetId!).single();
      return data;
    },
    enabled: !!targetId,
  });

  const { data: idCard, isLoading } = useQuery({
    queryKey: ['student-id-card', targetId],
    queryFn: async () => {
      const { data } = await supabase.from('student_id_cards').select('*').eq('user_id', targetId!).maybeSingle();
      return data;
    },
    enabled: !!targetId,
  });

  // Auto-generate ID card if paid enrollments exist but no card
  useEffect(() => {
    if (isLoading || idCard || autoGenerating || !targetId) return;
    // Only auto-generate for the logged-in user viewing their own card
    if (userId && userId !== user?.id) return;
    
    setAutoGenerating(true);
    ensureStudentIdCard(targetId).then((created) => {
      if (created) {
        qc.invalidateQueries({ queryKey: ['student-id-card', targetId] });
      }
      setAutoGenerating(false);
    });
  }, [isLoading, idCard, targetId, userId, user?.id]);

  const { data: settings } = useQuery({
    queryKey: ['id-card-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('id_card_settings').select('*').limit(1).single();
      return data as IdCardSettings;
    },
  });

  const cardData: IdCardData | null = targetProfile && idCard ? {
    studentName: targetProfile.full_name || 'Student',
    rollId: targetProfile.roll_id || '—',
    bloodGroup: targetProfile.blood_group || '—',
    dateOfBirth: targetProfile.date_of_birth ? format(new Date(targetProfile.date_of_birth), 'dd MMM yyyy') : '—',
    address: [targetProfile.district, targetProfile.division].filter(Boolean).join(', ') || '—',
    photoUrl: targetProfile.avatar_url || null,
    cardNumber: idCard.card_number,
    validUntil: format(new Date(idCard.valid_until), 'MMMM yyyy'),
  } : null;

  useEffect(() => {
    if (!canvasRef.current || !cardData || !settings) return;
    renderIdCard(canvasRef.current, cardData, settings);
  }, [cardData, settings]);

  const handleDownload = async () => {
    if (!cardData || !settings) return;
    setDownloading(true);
    try {
      await downloadIdCardPdf(cardData, settings);
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return <div className="animate-pulse h-40 bg-muted rounded-lg" />;

  if (!idCard) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <CreditCard className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">No ID card issued yet</p>
          <p className="text-xs text-muted-foreground mt-1">ID cards are generated when a student has paid course enrollment</p>
        </CardContent>
      </Card>
    );
  }

  const isExpired = new Date(idCard.valid_until) < new Date();
  const isActive = idCard.is_active && !isExpired;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Student ID Card
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isActive ? 'default' : 'destructive'}>
              {!idCard.is_active ? 'Deactivated' : isExpired ? 'Expired' : 'Active'}
            </Badge>
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading} className="gap-1">
              {downloading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Download PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            className="rounded-lg shadow-lg border max-w-full"
            style={{ width: '100%', maxWidth: 506, height: 'auto', aspectRatio: '1012/638' }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-3 px-1">
          <span>Card: {idCard.card_number}</span>
          <span>Valid: {format(new Date(idCard.valid_from), 'dd/MM/yyyy')} — {format(new Date(idCard.valid_until), 'dd/MM/yyyy')}</span>
        </div>
      </CardContent>
    </Card>
  );
}
