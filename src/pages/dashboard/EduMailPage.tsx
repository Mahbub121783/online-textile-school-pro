import { TableSkeleton } from '@/components/ui/loading-skeletons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Mail, CheckCircle, Clock, XCircle, AlertTriangle, Copy, Shield, HardDrive, Key, Calendar, Server, Eye, EyeOff, RefreshCw, Lock, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ensureEmailValidity } from '@/lib/ensureEmailValidity';

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Pending Approval' },
  approved: { icon: CheckCircle, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Active' },
  rejected: { icon: XCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', label: 'Rejected' },
  failed: { icon: AlertTriangle, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', label: 'Failed' },
  expired: { icon: Calendar, color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', label: 'Expired' },
};

const EduMailPage = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: emailReq, isLoading } = useQuery({
    queryKey: ['my-edumail', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('institutional_email_requests')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1);
      return (data?.[0] as any) || null;
    },
  });

  // Auto-check validity
  useEffect(() => {
    if (user?.id && emailReq?.status === 'approved') {
      ensureEmailValidity(user.id);
    }
  }, [user?.id, emailReq?.status]);

  // Auto-sync inbox on load
  useEffect(() => {
    if (emailReq?.status === 'approved' && user) {
      handleSyncInbox(false);
    }
  }, [emailReq?.status, user?.id]);

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
      queryClient.invalidateQueries({ queryKey: ['my-edumail'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message?.includes('unique') ? 'You already have a pending or active email request.' : err.message, variant: 'destructive' });
    },
  });

  // Password change with 15-day cooldown
  const passwordCooldownDays = 15;
  const lastPasswordReset = emailReq?.last_password_reset_at ? new Date(emailReq.last_password_reset_at) : null;
  const cooldownExpires = lastPasswordReset ? new Date(lastPasswordReset.getTime() + passwordCooldownDays * 24 * 60 * 60 * 1000) : null;
  const canChangePassword = !cooldownExpires || new Date() >= cooldownExpires;
  const daysUntilChange = cooldownExpires ? Math.max(0, Math.ceil((cooldownExpires.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('cpanel-email-provisioner', {
        body: {
          requestId: emailReq.id,
          action: 'change-password',
        },
      });
      if (error) {
        // Try to extract the actual error message from the response
        let msg = 'Password change failed';
        try {
          if (error instanceof Object && 'context' in error) {
            const body = await (error as any).context?.json?.();
            if (body?.error) msg = body.error;
          }
        } catch (_) {}
        if (error.message && error.message !== 'Edge Function returned a non-2xx status code') {
          msg = error.message;
        }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({ title: '🔑 Password Changed', description: 'Your email password has been updated successfully.' });
      queryClient.invalidateQueries({ queryKey: ['my-edumail'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const handleSyncInbox = async (reset = false) => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('edumail-imap-sync', reset ? { body: { reset: true } } : undefined);
      if (error) throw error;
      if (reset) {
        toast({ title: '🔧 Inbox Repaired', description: `${data?.new_messages || 0} message(s) re-imported with the latest parser.` });
      } else if (data?.new_messages > 0) {
        toast({ title: '📬 Inbox Synced', description: `${data.new_messages} new message(s) received.` });
      }
    } catch (err: any) {
      console.error('Inbox sync error:', err);
      if (reset) toast({ title: 'Error', description: err.message || 'Repair failed', variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!' });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><TableSkeleton rows={6} columns={3} /></div>;
  }

  const config = emailReq ? statusConfig[emailReq.status] : null;
  const StatusIcon = config?.icon;

  // Validity calculations
  const validUntil = emailReq?.valid_until ? new Date(emailReq.valid_until) : null;
  const validFrom = emailReq?.valid_from ? new Date(emailReq.valid_from) : null;
  const now = new Date();
  const daysRemaining = validUntil ? Math.max(0, Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const totalDays = validFrom && validUntil ? Math.ceil((validUntil.getTime() - validFrom.getTime()) / (1000 * 60 * 60 * 24)) : 1;
  const progressPct = totalDays > 0 ? Math.max(0, Math.min(100, ((totalDays - daysRemaining) / totalDays) * 100)) : 0;
  const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 30;

  const quotaMb = emailReq?.email_quota_mb || 512;
  const usedBytes = emailReq?.disk_usage_bytes || 0;
  const usedMb = (usedBytes / (1024 * 1024)).toFixed(1);
  const usagePct = Math.min(100, (usedBytes / (quotaMb * 1024 * 1024)) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            EduMail — Institutional Email
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Your professional academic email account</p>
        </div>
        {emailReq?.status === 'approved' && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleSyncInbox(false)} disabled={isSyncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Inbox'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm('This will wipe your inbox and re-import all messages with the latest parser. Continue?')) {
                  handleSyncInbox(true);
                }
              }}
              disabled={isSyncing}
              title="Reset & re-sync inbox to fix garbled messages"
            >
              <Wrench className="h-4 w-4 mr-2" />
              Repair Inbox
            </Button>
          </div>
        )}
      </div>

      {!emailReq ? (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-heading font-bold text-lg">Get Your Institutional Email</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Request a professional email address for your academic communications, research, and career needs.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 max-w-sm mx-auto">
              <p className="text-xs text-muted-foreground mb-1">Your email will be:</p>
              <p className="font-mono text-sm font-medium">{generateEmail() || 'Complete your profile first'}</p>
            </div>
            <Button onClick={() => requestMutation.mutate()} disabled={requestMutation.isPending || !generateEmail()} size="lg">
              <Mail className="h-4 w-4 mr-2" />
              {requestMutation.isPending ? 'Submitting...' : 'Request Institutional Email'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Email Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Email Account</span>
                <Badge className={`${config?.color} gap-1`}>
                  {StatusIcon && <StatusIcon className="h-3 w-3" />}
                  {config?.label}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Email Address</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm font-medium flex-1">{emailReq.requested_email}</p>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyToClipboard(emailReq.requested_email)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Password Section */}
              {emailReq.status === 'approved' && emailReq.current_password && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Email Password
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={emailReq.current_password}
                      readOnly
                      className="font-mono text-sm h-8"
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(emailReq.current_password)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={!canChangePassword || changePasswordMutation.isPending}
                      onClick={() => changePasswordMutation.mutate()}
                    >
                      <Key className="h-3.5 w-3.5 mr-2" />
                      {changePasswordMutation.isPending
                        ? 'Changing...'
                        : canChangePassword
                          ? 'Change Password'
                          : `Change available in ${daysUntilChange} day(s)`}
                    </Button>
                  </div>

                  {lastPasswordReset && (
                    <p className="text-xs text-muted-foreground">
                      Last changed: {lastPasswordReset.toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {emailReq.status === 'pending' && (
                <p className="text-sm text-muted-foreground">Your request is being reviewed by an administrator.</p>
              )}

              {emailReq.status === 'rejected' && emailReq.admin_notes && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-xs">
                  <p className="font-medium text-destructive">Reason:</p>
                  <p className="text-muted-foreground">{emailReq.admin_notes}</p>
                </div>
              )}

              {(emailReq.status === 'rejected' || emailReq.status === 'failed' || emailReq.status === 'expired') && (
                <Button variant="outline" className="w-full" onClick={() => requestMutation.mutate()} disabled={requestMutation.isPending}>
                  <Mail className="h-4 w-4 mr-2" />
                  Request Again
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Validity & Usage Card */}
          {emailReq.status === 'approved' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Validity & Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Validity Period</span>
                    <span className={`font-medium ${isExpiringSoon ? 'text-destructive' : ''}`}>
                      {daysRemaining} days remaining
                    </span>
                  </div>
                  <Progress value={progressPct} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{validFrom?.toLocaleDateString()}</span>
                    <span>{validUntil?.toLocaleDateString()}</span>
                  </div>
                  {isExpiringSoon && (
                    <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-2 text-xs text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Your email will expire soon. Enroll in a new course to extend validity.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> Storage</span>
                    <span className="font-medium">{usedMb} MB / {quotaMb} MB</span>
                  </div>
                  <Progress value={usagePct} className="h-2" />
                </div>

                {emailReq.is_blocked && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive font-medium">
                    ⚠️ Your email account has been temporarily suspended by admin.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* IMAP/SMTP Settings */}
          {emailReq.status === 'approved' && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Email Client Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Incoming Mail (IMAP)</h4>
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Server:</span><span className="font-mono">mail.onlinetextileschool.com</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Port:</span><span className="font-mono">993</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Security:</span><span>SSL/TLS</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Username:</span>
                        <button className="font-mono text-primary underline text-xs" onClick={() => copyToClipboard(emailReq.requested_email)}>
                          {emailReq.requested_email}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Outgoing Mail (SMTP)</h4>
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Server:</span><span className="font-mono">mail.onlinetextileschool.com</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Port:</span><span className="font-mono">465</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Security:</span><span>SSL/TLS</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Username:</span>
                        <button className="font-mono text-primary underline text-xs" onClick={() => copyToClipboard(emailReq.requested_email)}>
                          {emailReq.requested_email}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default EduMailPage;
