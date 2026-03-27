import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Users, Copy, Gift, CheckCircle2, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const ReferralsPage = () => {
  const { user, profile } = useAuth();
  const referralCode = profile?.referral_code || '';
  const referralLink = `${window.location.origin}/auth/register?ref=${referralCode}`;

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['my-referrals', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('referral_rewards')
        .select('*, referred:user_profiles!referral_rewards_referred_id_fkey(full_name, avatar_url, created_at)')
        .eq('referrer_id', user!.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const totalEarned = referrals
    .filter((r: any) => r.status === 'credited')
    .reduce((sum: number, r: any) => sum + Number(r.reward_amount || 0), 0);
  const pendingCount = referrals.filter((r: any) => r.status === 'pending').length;

  const copyCode = () => {
    navigator.clipboard.writeText(referralLink);
    toast({ title: 'Copied!', description: 'Referral link copied to clipboard.' });
  };

  if (isLoading) {
    return <div className="animate-pulse text-muted-foreground py-12 text-center">Loading referrals...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold">Referral Program</h2>

      {/* Referral link card */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <Gift className="h-6 w-6" />
          <h3 className="font-heading font-bold text-lg">Invite Friends, Earn Rewards!</h3>
        </div>
        <p className="text-sm opacity-80 mb-4">Share your referral link and earn wallet credits when friends enroll in courses.</p>
        <div className="flex gap-2">
          <Input value={referralLink} readOnly className="bg-white/20 border-white/30 text-primary-foreground placeholder:text-primary-foreground/50 flex-1" />
          <Button variant="secondary" className="shrink-0 gap-2" onClick={copyCode}>
            <Copy className="h-4 w-4" /> Copy
          </Button>
        </div>
        <p className="text-xs mt-3 opacity-70">Your code: <strong>{referralCode}</strong></p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="font-heading text-2xl font-bold">{referrals.length}</p>
          <p className="text-xs text-muted-foreground">Total Referrals</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="font-heading text-2xl font-bold text-primary">৳{totalEarned}</p>
          <p className="text-xs text-muted-foreground">Total Earned</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="font-heading text-2xl font-bold">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
      </div>

      {/* Referral history */}
      <div className="bg-card border rounded-xl p-6">
        <h3 className="font-heading font-bold text-lg mb-4">Referral History</h3>
        {referrals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 text-muted" />
            <p>No referrals yet. Share your link to get started!</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referred User</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Reward</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referrals.map((ref: any) => (
                <TableRow key={ref.id}>
                  <TableCell className="font-medium text-sm">{ref.referred?.full_name || 'User'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(ref.created_at), 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant={ref.status === 'credited' ? 'default' : ref.status === 'expired' ? 'destructive' : 'secondary'} className="gap-1">
                      {ref.status === 'credited' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {ref.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {ref.status === 'credited' ? `+৳${ref.reward_amount}` : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default ReferralsPage;
