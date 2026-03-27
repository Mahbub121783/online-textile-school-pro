import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SLIDES = [
  {
    title: 'Master Textile Engineering Online',
    subtitle: 'Join thousands of learners building careers in the textile industry with expert-led courses.',
    cta: 'Explore Courses',
    ctaLink: '/courses',
    secondaryCta: 'Free Demo Class',
    secondaryCtaLink: '#demo',
    bg: 'from-primary to-primary-dark',
  },
  {
    title: 'Learn from Industry Experts',
    subtitle: 'Spinning, Weaving, Dyeing, Knitting — comprehensive courses from professionals with 10+ years of experience.',
    cta: 'Browse Categories',
    ctaLink: '/courses',
    secondaryCta: 'Become an Instructor',
    secondaryCtaLink: '/become-instructor',
    bg: 'from-primary-dark to-primary',
  },
  {
    title: 'Get Certified, Get Hired',
    subtitle: 'Earn industry-recognized certificates and a student ID card. Build your professional textile career.',
    cta: 'Start Learning',
    ctaLink: '/auth/register',
    secondaryCta: 'View eBooks',
    secondaryCtaLink: '/ebooks',
    bg: 'from-accent to-accent-hover',
  },
];

const HeroSlider = () => {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => setCurrent((c) => (c + 1) % SLIDES.length), []);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  const slide = SLIDES[current];

  return (
    <section className="relative w-full h-[60vh] md:h-[80vh] overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${slide.bg} transition-all duration-700`} />
      {/* Textile pattern overlay */}
      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)' }} />
      
      <div className="relative container h-full flex items-center">
        <div className="max-w-2xl text-primary-foreground animate-fade-in" key={current}>
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4 md:mb-6">
            {slide.title}
          </h1>
          <p className="text-base md:text-lg text-primary-foreground/80 mb-6 md:mb-8 max-w-lg leading-relaxed">
            {slide.subtitle}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" className="bg-accent hover:bg-accent-hover text-accent-foreground font-semibold h-12 px-8" asChild>
              <a href={slide.ctaLink}>{slide.cta}</a>
            </Button>
            <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 h-12 px-8" asChild>
              <a href={slide.secondaryCtaLink}>{slide.secondaryCta}</a>
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/20 hover:bg-background/40 text-primary-foreground rounded-full p-2 transition-colors backdrop-blur-sm">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/20 hover:bg-background/40 text-primary-foreground rounded-full p-2 transition-colors backdrop-blur-sm">
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${i === current ? 'bg-accent w-8' : 'bg-primary-foreground/40'}`}
          />
        ))}
      </div>
    </section>
  );
};

export default HeroSlider;
