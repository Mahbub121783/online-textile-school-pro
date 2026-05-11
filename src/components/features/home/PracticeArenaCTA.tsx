import { Link } from 'react-router-dom';
import { Brain, Trophy, Zap, ArrowRight, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PracticeArenaCTA = () => {
  return (
    <section className="py-12 md:py-16">
      <div className="container">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary-dark to-accent text-primary-foreground p-8 md:p-14">
          {/* Decorative blobs */}
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-accent/30 rounded-full blur-3xl" />
          <div className="absolute top-8 right-8 opacity-20 hidden md:block">
            <Brain className="h-40 w-40" />
          </div>

          <div className="relative grid md:grid-cols-[1fr_auto] gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs font-bold uppercase tracking-wider mb-4">
                <Flame className="h-3.5 w-3.5" /> Practice Arena
              </div>
              <h2 className="font-heading text-3xl md:text-5xl font-bold leading-tight mb-3">
                Test Your Edge.
                <br />
                Climb the Leaderboard.
              </h2>
              <p className="text-base md:text-lg opacity-90 max-w-xl mb-6">
                Olympiad-style practice exams across every subject. Earn XP, unlock badges, build streaks.
                Compete with thousands of students live.
              </p>

              <div className="flex flex-wrap gap-6 mb-8 text-sm">
                <div className="flex items-center gap-2"><Zap className="h-4 w-4" /> Earn XP per question</div>
                <div className="flex items-center gap-2"><Trophy className="h-4 w-4" /> 10+ badges to unlock</div>
                <div className="flex items-center gap-2"><Flame className="h-4 w-4" /> Daily streak bonuses</div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" variant="secondary" className="font-bold">
                  <Link to="/practice">
                    Start Practicing <ArrowRight className="h-5 w-5 ml-1" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="bg-white/10 border-white/40 hover:bg-white/20 text-primary-foreground font-bold">
                  <Link to="/practice/leaderboard">View Leaderboard</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PracticeArenaCTA;
