import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCartStore } from '@/stores/cartStore';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Coins, ShoppingCart, Sparkles, Zap, History } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { toast } from 'sonner';

// 100 credits = 50 BDT  =>  price = credits * 0.5
const PRICE_PER_CREDIT = 0.5;
const PRESETS = [100, 500, 1000, 2500];
// Fixed synthetic UUID for the practice-credit "product" so order_items.item_id stays valid
const PRACTICE_CREDIT_ITEM_ID = '00000000-0000-4000-8000-000000000001';

const PracticeCredits = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addItem } = useCartStore();
  const { data: balance } = useTokenBalance();
  const [custom, setCustom] = useState<string>('');

  const { data: ledger = [] } = useQuery({
    queryKey: ['qb-token-ledger', user?.id],
    enabled: !!user,
    staleTime: 60 * 1000,
    retry: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qb_token_ledger')
        .select('id, delta, reason, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) return [];
      return data ?? [];
    },
  });

  const buy = (credits: number) => {
    if (!user) { navigate('/auth/login?redirect=/practice/credits'); return; }
    if (credits < 100 || credits % 100 !== 0) {
      toast.error('Minimum 100 credits, in multiples of 100.');
      return;
    }
    const price = credits * PRICE_PER_CREDIT;
    addItem({
      id: PRACTICE_CREDIT_ITEM_ID,
      type: 'practice_credits',
      title: `${credits} Practice Credits`,
      price,
      credits,
      thumbnail_url: undefined,
    });
    toast.success(`${credits} credits added to cart`);
    navigate('/checkout');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <SEOHead title="Buy Practice Credits — Online Textile School" description="Top up Practice Arena tokens. 100 credits for ৳50. Use them on mixed (10) or department (5) exams." />
      <main className="flex-1 pb-16 lg:pb-0">
        <div className="container mx-auto px-4 py-6 md:py-10 max-w-4xl">
          <Button asChild variant="ghost" size="sm" className="mb-4">
            <Link to="/practice"><ArrowLeft className="h-4 w-4 mr-1" /> Practice Arena</Link>
          </Button>

          <div className="rounded-3xl bg-gradient-to-br from-primary via-primary-dark to-accent text-primary-foreground p-6 md:p-8 mb-6 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 opacity-20"><Coins className="h-40 w-40" /></div>
            <Badge className="bg-white/20 hover:bg-white/30 border-0 mb-3">
              <Sparkles className="h-3 w-3 mr-1" /> Practice Credits
            </Badge>
            <h1 className="font-heading text-3xl md:text-4xl font-black mb-2">Top Up Your Tokens</h1>
            <p className="opacity-90 text-sm max-w-xl">
              Free users get 20 tokens per day. Each mixed exam costs 10 tokens; each department exam costs 5.
              Buy more credits anytime — <strong>100 credits = ৳50</strong> (৳0.50 per credit).
            </p>

            {balance && (
              <div className="mt-5 inline-flex flex-wrap items-center gap-3 bg-white/15 backdrop-blur rounded-xl px-4 py-2.5 text-sm">
                <span className="flex items-center gap-1.5"><Zap className="h-4 w-4" /> Today: <strong className="tabular-nums">{balance.daily_balance}</strong></span>
                <span className="opacity-50">·</span>
                <span className="flex items-center gap-1.5"><Coins className="h-4 w-4" /> Paid: <strong className="tabular-nums">{balance.paid_balance}</strong></span>
                {balance.is_staff && <span className="opacity-50">·</span>}
                {balance.is_staff && <Badge variant="secondary">Staff — unlimited</Badge>}
              </div>
            )}
          </div>

          <h2 className="font-heading text-xl font-bold mb-3">Pick a Pack</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {PRESETS.map((credits) => (
              <Card key={credits} className="border-2 hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer" onClick={() => buy(credits)}>
                <CardContent className="p-4 text-center">
                  <Coins className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="font-heading font-black text-2xl tabular-nums">{credits.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">credits</p>
                  <p className="font-bold mt-2 text-primary tabular-nums">৳{(credits * PRICE_PER_CREDIT).toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-2 mb-6">
            <CardContent className="p-5">
              <h3 className="font-heading font-bold mb-3">Custom Amount</h3>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[180px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Credits (min 100, in 100s)</label>
                  <Input
                    type="number"
                    min={100}
                    step={100}
                    placeholder="e.g. 300"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  Price: <strong className="text-foreground tabular-nums">৳{((Number(custom) || 0) * PRICE_PER_CREDIT).toLocaleString()}</strong>
                </div>
                <Button onClick={() => buy(Number(custom))} disabled={!custom || Number(custom) < 100}>
                  <ShoppingCart className="h-4 w-4 mr-1" /> Buy
                </Button>
              </div>
            </CardContent>
          </Card>

          {ledger.length > 0 && (
            <Card className="border-2">
              <CardContent className="p-5">
                <h3 className="font-heading font-bold mb-3 flex items-center gap-2">
                  <History className="h-4 w-4" /> Recent activity
                </h3>
                <ul className="divide-y">
                  {ledger.map((row: any) => (
                    <li key={row.id} className="py-2 flex items-center justify-between text-sm">
                      <span className="capitalize">{row.reason.replace('_', ' ')}</span>
                      <span className={`tabular-nums font-bold ${row.delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {row.delta > 0 ? '+' : ''}{row.delta}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default PracticeCredits;
