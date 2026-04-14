import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Mail, CheckCircle, Clock, XCircle, AlertTriangle, Copy, Calendar } from 'lucide-react';

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Pending Approval' },
  approved: { icon: CheckCircle, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Active' },
  rejected: { icon: XCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', label: 'Rejected' },
  failed: { icon: AlertTriangle, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', label: 'Failed' },
  expired: { icon: Calendar, color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', label: 'Expired' },
};

export default function InstitutionalEmailWidget() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [requesting, setRequesting] = useState(false);

  const { data: existingRequest, isLoading } = useQuery({
    queryKey: ['my-institutional-email', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('institutional_email_requests')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
  });

  const generateEmail = () => {
    if (!profile) return '';
    const firstName = (profile.full_name || '').trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
    if (!firstName) return '';
    const rollId = profile.roll_id || '';
    const last3 = rollId.slice(-3) || '000';
    return `${firstName}${last3}@onlinetextileschool.com`;
  };

  const requestMutation = useMutation({
    mutationFn: async () => {
      const email = generateEmail();
      if (!email || !user) throw new Error('Cannot generate email');
      const { error } = await supabase.from('institutional_email_requests').insert({
        user_id: user.id,
        requested_email: email,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: '✅ Request Submitted', description: 'Your institutional email request has been sent to admin for approval.' });
      queryClient.invalidateQueries({ queryKey: ['my-institutional-email'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message?.includes('unique') ? 'You already have a pending or active email request.' : err.message, variant: 'destructive' });
    },
  });

  if (isLoading) return null;

  const config = existingRequest ? statusConfig[existingRequest.status] : null;
  const StatusIcon = config?.icon;

  return (
    <div className="bg-card border rounded-xl p-6">
      <h3 className="font-heading font-bold mb-3 flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        Institutional Email
      </h3>

      {!existingRequest ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Request a professional institutional email address for your academic communications.
          </p>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Your email will be:</p>
            <p className="font-mono text-sm font-medium">{generateEmail() || 'Complete your profile first'}</p>
          </div>
          <Button
            onClick={() => requestMutation.mutate()}
            disabled={requestMutation.isPending || !generateEmail()}
            className="w-full"
          >
            <Mail className="h-4 w-4 mr-2" />
            {requestMutation.isPending ? 'Submitting...' : 'Request Institutional Email'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className={`${config?.color} gap-1`}>
              {StatusIcon && <StatusIcon className="h-3 w-3" />}
              {config?.label}
            </Badge>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Email Address</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-sm font-medium flex-1">{existingRequest.requested_email}</p>
              {existingRequest.status === 'approved' && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    navigator.clipboard.writeText(existingRequest.requested_email);
                    toast({ title: 'Copied!' });
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {existingRequest.status === 'approved' && existingRequest.valid_until && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Validity</span>
                <span>{Math.max(0, Math.ceil((new Date(existingRequest.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days left</span>
              </div>
              <Progress value={Math.min(100, ((Date.now() - new Date(existingRequest.valid_from || existingRequest.created_at).getTime()) / (new Date(existingRequest.valid_until).getTime() - new Date(existingRequest.valid_from || existingRequest.created_at).getTime())) * 100)} className="h-1.5" />
            </div>
          )}

          {existingRequest.status === 'approved' && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs space-y-1">
              <p className="font-medium text-primary">Webmail Access:</p>
              <a href="https://premium.us10.svlogins.com:2096" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                https://premium.us10.svlogins.com:2096
              </a>
              <p className="text-muted-foreground mt-1">Login credentials were sent to your registered email.</p>
            </div>
          )}

          {existingRequest.status === 'rejected' && existingRequest.admin_notes && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-xs">
              <p className="font-medium text-destructive">Reason:</p>
              <p className="text-muted-foreground">{existingRequest.admin_notes}</p>
            </div>
          )}

          {(existingRequest.status === 'rejected' || existingRequest.status === 'failed' || existingRequest.status === 'expired') && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending}
            >
              Request Again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
