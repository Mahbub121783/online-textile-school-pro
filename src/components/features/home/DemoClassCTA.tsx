import { useState } from 'react';
import { Play, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

const DemoClassCTA = () => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast({ title: 'Registered!', description: 'You will receive the demo class link via email.' });
    setEmail('');
  };

  return (
    <section id="demo" className="py-12 md:py-16 bg-background">
      <div className="container">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Video */}
          <div className="aspect-video bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center relative overflow-hidden group cursor-pointer">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.05) 20px, rgba(255,255,255,0.05) 40px)' }} />
            <div className="bg-accent/90 rounded-full p-4 group-hover:scale-110 transition-transform">
              <Play className="h-8 w-8 text-accent-foreground fill-accent-foreground" />
            </div>
            <div className="absolute bottom-4 left-4 text-primary-foreground">
              <p className="font-heading font-semibold text-sm">Free Demo: Introduction to Textile Engineering</p>
              <p className="text-xs text-primary-foreground/70">45 minutes • By Dr. Rahman</p>
            </div>
          </div>

          {/* Email capture */}
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">Try a Free Demo Class</h2>
              <p className="text-muted-foreground leading-relaxed">
                Experience the quality of Online Textile School with our free demo class. Get a taste of expert-led
                textile education before you enroll.
              </p>
            </div>
            <ul className="space-y-2 text-sm text-foreground">
              <li className="flex items-center gap-2"><span className="text-success">✓</span> Full-length lesson from a real course</li>
              <li className="flex items-center gap-2"><span className="text-success">✓</span> Interactive Q&A with the instructor</li>
              <li className="flex items-center gap-2"><span className="text-success">✓</span> Downloadable study materials included</li>
              <li className="flex items-center gap-2"><span className="text-success">✓</span> No credit card required</li>
            </ul>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
              <Button type="submit" size="lg" className="bg-accent hover:bg-accent-hover text-accent-foreground h-12 px-6 shrink-0">
                Get Free Access
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DemoClassCTA;
