import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfileCompleteness } from '@/hooks/useProfileCompleteness';
import { renderIdCard, downloadIdCardPdf, downloadIdCardPng, IdCardData, IdCardSettings } from '@/lib/idCardRenderer';
import { ensureStudentIdCard } from '@/lib/ensureStudentIdCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, CreditCard, RefreshCw, FileImage, FileText, ChevronDown, AlertTriangle, ShieldX } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

interface Props {
  userId?: string;
}

export default function StudentIdCard({ userId }: Props) {
  const { user, profile } = useAuth();
  const { isComplete, incomplete, percentage } = useProfileCompleteness(profile);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardWrapperRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (isLoading || idCard || autoGenerating || !targetId) return;
    if (userId && userId !== user?.id) return;
    setAutoGenerating(true);
    ensureStudentIdCard(targetId).then((created) => {
      if (created) qc.invalidateQueries({ queryKey: ['student-id-card', targetId] });
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

  // 3D tilt effect
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardWrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    const el = cardWrapperRef.current;
    if (el) el.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg)';
  }, []);

  const handleDownloadPdf = async () => {
    if (!cardData || !settings) return;
    setDownloading(true);
    try { await downloadIdCardPdf(cardData, settings); } finally { setDownloading(false); }
  };

  const handleDownloadPng = async () => {
    if (!cardData || !settings) return;
    setDownloading(true);
    try { await downloadIdCardPng(cardData, settings); } finally { setDownloading(false); }
  };

  if (isLoading) return <div className="animate-pulse h-40 bg-muted rounded-lg" />;

  if (!idCard) {
    return (
      <Card className="border-dashed border-2 border-muted-foreground/20">
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
            <CreditCard className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">No ID card issued yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            ID cards are automatically generated when you have a paid course enrollment
          </p>
        </CardContent>
      </Card>
    );
  }

  const isExpired = new Date(idCard.valid_until) < new Date();
  const isActive = idCard.is_active && !isExpired;
  const isDownloadBlocked = !!(idCard as any).download_blocked;
  const canDownload = isComplete && !isDownloadBlocked;

  return (
    <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-background to-muted/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Student ID Card
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant={isActive ? 'default' : 'destructive'}
              className={isActive ? 'animate-pulse bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              <span className={isActive ? 'inline-block w-1.5 h-1.5 rounded-full bg-white mr-1.5' : 'hidden'} />
              {!idCard.is_active ? 'Deactivated' : isExpired ? 'Expired' : 'Active'}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={downloading || !canDownload} className="gap-1">
                  {downloading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Download
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadPdf} className="gap-2">
                  <FileText className="h-4 w-4" /> Download PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadPng} className="gap-2">
                  <FileImage className="h-4 w-4" /> Download PNG
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!isComplete && !userId && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">Profile {percentage}% complete.</span> Complete your profile to download.
              Missing: {incomplete.map(f => f.label).join(', ')}.{' '}
              <Link to="/dashboard/settings" className="underline font-medium">Complete Profile →</Link>
            </AlertDescription>
          </Alert>
        )}
        {isDownloadBlocked && (
          <Alert variant="destructive" className="mb-4">
            <ShieldX className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">Download blocked by administrator.</span> Contact support for assistance.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex justify-center">
          <div
            ref={cardWrapperRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="transition-all duration-200 ease-out rounded-xl shadow-2xl hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] cursor-default"
            style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
          >
            <canvas
              ref={canvasRef}
              className="rounded-xl max-w-full"
              style={{ width: '100%', maxWidth: 506, height: 'auto', aspectRatio: '1012/638' }}
            />
          </div>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-4 px-1 items-center">
          <span className="font-mono tracking-wider">Card: {idCard.card_number}</span>
          <span>
            Valid: {format(new Date(idCard.valid_from), 'dd/MM/yyyy')} — {format(new Date(idCard.valid_until), 'dd/MM/yyyy')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
