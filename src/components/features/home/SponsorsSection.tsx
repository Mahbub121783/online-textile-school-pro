import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Crown } from 'lucide-react';

const TIER_ORDER = ['platinum', 'gold', 'silver', 'bronze'] as const;
const TIER_CONFIG: Record<string, { height: string; label: string; color: string }> = {
  platinum: { height: 'h-24 md:h-28', label: 'Platinum', color: 'text-purple-500' },
  gold: { height: 'h-20 md:h-24', label: 'Gold', color: 'text-amber-500' },
  silver: { height: 'h-16 md:h-20', label: 'Silver', color: 'text-slate-400' },
  bronze: { height: 'h-12 md:h-16', label: 'Bronze', color: 'text-orange-700' },
};

const SponsorsSection = () => {
  const { data: sponsors = [] } = useQuery({
    queryKey: ['sponsors-public'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsors')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      return data || [];
    },
  });

  if (!sponsors.length) return null;

  const grouped = TIER_ORDER.reduce((acc, tier) => {
    const items = sponsors.filter((s: any) => s.tier === tier);
    if (items.length) acc.push({ tier, items });
    return acc;
  }, [] as { tier: string; items: any[] }[]);

  const handleClick = async (sponsor: any) => {
    // Fire-and-forget click tracking
    supabase.from('sponsors').update({ click_count: (sponsor.click_count || 0) + 1 }).eq('id', sponsor.id).then();
    if (sponsor.website_url) {
      window.open(sponsor.website_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Crown className="h-6 w-6 text-primary" />
            <h2 className="text-3xl font-heading font-bold">Our Sponsors & Partners</h2>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Proudly supported by industry leaders and educational organizations
          </p>
        </div>

        {grouped.map(({ tier, items }) => {
          const config = TIER_CONFIG[tier];
          return (
            <div key={tier} className="mb-10 last:mb-0">
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className={`text-sm font-semibold uppercase tracking-wider ${config.color}`}>
                  {config.label} Partners
                </span>
              </div>

              {/* Marquee container */}
              <div className="relative overflow-hidden">
                <div className="flex animate-marquee gap-12 items-center">
                  {[...items, ...items].map((sponsor: any, idx: number) => (
                    <Tooltip key={`${sponsor.id}-${idx}`}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleClick(sponsor)}
                          className="flex-shrink-0 grayscale hover:grayscale-0 opacity-70 hover:opacity-100 transition-all duration-300 hover:scale-110 cursor-pointer"
                        >
                          <img
                            src={sponsor.logo_url}
                            alt={sponsor.name}
                            className={`${config.height} w-auto object-contain`}
                            loading="lazy"
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{sponsor.name}</p>
                        {sponsor.description && (
                          <p className="text-xs text-muted-foreground max-w-[200px]">{sponsor.description}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
};

export default SponsorsSection;
