import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const FALLBACK_SLIDES = [
  { id: 'f1', title: 'Master Textile Engineering Online', subtitle: 'Join thousands of learners building careers in the textile industry with expert-led courses.', cta_text: 'Explore Courses', cta_link: '/courses', secondary_cta_text: 'Free Demo Class', secondary_cta_link: '#demo', image_url: '', gradient_from: 'primary', gradient_to: 'primary-dark', gradient_direction: 'br', overlay_opacity: 5, text_alignment: 'left', title_color: null, subtitle_color: null, countdown_target: null },
  { id: 'f2', title: 'Learn from Industry Experts', subtitle: 'Spinning, Weaving, Dyeing, Knitting — comprehensive courses from professionals.', cta_text: 'Browse Categories', cta_link: '/courses', secondary_cta_text: 'Become an Instructor', secondary_cta_link: '/become-instructor', image_url: '', gradient_from: 'primary-dark', gradient_to: 'primary', gradient_direction: 'br', overlay_opacity: 5, text_alignment: 'left', title_color: null, subtitle_color: null, countdown_target: null },
  { id: 'f3', title: 'Get Certified, Get Hired', subtitle: 'Earn industry-recognized certificates and a student ID card. Build your professional textile career.', cta_text: 'Start Learning', cta_link: '/auth/register', secondary_cta_text: 'View eBooks', secondary_cta_link: '/ebooks', image_url: '', gradient_from: 'accent', gradient_to: 'accent-hover', gradient_direction: 'br', overlay_opacity: 5, text_alignment: 'left', title_color: null, subtitle_color: null, countdown_target: null },
];

const GRADIENT_DIR_MAP: Record<string, string> = {
  br: 'to bottom right', r: 'to right', b: 'to bottom', bl: 'to bottom left',
  tr: 'to top right', t: 'to top', tl: 'to top left', l: 'to left',
};

const COLOR_MAP: Record<string, string> = {
  primary: 'hsl(var(--primary))',
  'primary-dark': 'hsl(var(--primary-dark, var(--primary)))',
  accent: 'hsl(var(--accent))',
  'accent-hover': 'hsl(var(--accent))',
  secondary: 'hsl(var(--secondary))',
  muted: 'hsl(var(--muted))',
};

const getColor = (name: string) => COLOR_MAP[name] || COLOR_MAP.primary;

// Countdown hook
const useCountdown = (target: string | null) => {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!target) return;
    const end = new Date(target).getTime();
    const tick = () => {
      const diff = end - Date.now();
      if (diff <= 0) { setTimeLeft(''); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [target]);
  return timeLeft;
};

const SlideContent = ({ slide }: { slide: any }) => {
  const align = slide.text_alignment || 'left';
  const countdown = useCountdown(slide.countdown_target);

  return (
    <div className={`max-w-2xl ${align === 'center' ? 'text-center mx-auto' : align === 'right' ? 'text-right ml-auto' : ''}`}>
      {countdown && (
        <div className={`mb-4 ${align === 'center' ? 'flex justify-center' : align === 'right' ? 'flex justify-end' : ''}`}>
          <span className="inline-flex items-center gap-1.5 bg-destructive text-destructive-foreground text-sm font-semibold px-3 py-1.5 rounded-full animate-pulse">
            ⏰ {countdown}
          </span>
        </div>
      )}
      <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4 md:mb-6 transition-colors"
        style={{ color: slide.title_color || undefined }}>
        {slide.title}
      </h1>
      <p className="text-base md:text-lg mb-6 md:mb-8 max-w-lg leading-relaxed opacity-80 transition-colors"
        style={{ color: slide.subtitle_color || undefined, marginLeft: align === 'center' ? 'auto' : undefined, marginRight: align === 'center' || align === 'left' ? 'auto' : undefined }}>
        {slide.subtitle}
      </p>
      <div className={`flex flex-wrap gap-3 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : ''}`}>
        {slide.cta_text && (
          <Button size="lg" className="bg-accent hover:bg-accent-hover text-accent-foreground font-semibold h-12 px-8" asChild>
            <a href={slide.cta_link || '/'}>{slide.cta_text}</a>
          </Button>
        )}
        {slide.secondary_cta_text && (
          <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 h-12 px-8" asChild>
            <a href={slide.secondary_cta_link || '/'}>{slide.secondary_cta_text}</a>
          </Button>
        )}
      </div>
    </div>
  );
};

const HeroSlider = () => {
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchStart = useRef<number | null>(null);

  const { data: dbSlides } = useQuery({
    queryKey: ['hero-slides-public'],
    queryFn: async () => {
      const { data } = await supabase.from('hero_slides').select('*').eq('is_active', true).order('sort_order', { ascending: true });
      return data ?? [];
    },
    staleTime: 30000,
  });

  const slides = dbSlides && dbSlides.length > 0 ? dbSlides : FALLBACK_SLIDES;

  const goTo = useCallback((idx: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent(idx);
    setTimeout(() => setIsTransitioning(false), 700);
  }, [isTransitioning]);

  const next = useCallback(() => goTo((current + 1) % slides.length), [current, slides.length, goTo]);
  const prev = useCallback(() => goTo((current - 1 + slides.length) % slides.length), [current, slides.length, goTo]);

  useEffect(() => {
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next]);

  // Touch swipe
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { diff > 0 ? next() : prev(); }
    touchStart.current = null;
  };

  const slide = slides[current];
  const dir = GRADIENT_DIR_MAP[slide.gradient_direction || 'br'] || 'to bottom right';
  const fromColor = getColor(slide.gradient_from || 'primary');
  const toColor = getColor(slide.gradient_to || 'primary-dark');
  const opacity = (slide.overlay_opacity ?? 5) / 100;

  return (
    <section className="relative w-full h-[60vh] md:h-[80vh] overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Background image */}
      {slide.image_url && (
        <div className="absolute inset-0 transition-opacity duration-700" key={`img-${current}`}>
          <img src={slide.image_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 transition-all duration-700"
        style={{ background: `linear-gradient(${dir}, ${fromColor}, ${toColor})`, opacity: slide.image_url ? 0.8 : 1 }} />

      {/* Pattern overlay */}
      <div className="absolute inset-0" style={{ opacity, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)' }} />

      {/* Content */}
      <div className="relative container h-full flex items-center">
        <div className="w-full text-primary-foreground animate-fade-in" key={current}>
          <SlideContent slide={slide} />
        </div>
      </div>

      {/* Navigation arrows */}
      {slides.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/20 hover:bg-background/40 text-primary-foreground rounded-full p-2 transition-colors backdrop-blur-sm">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/20 hover:bg-background/40 text-primary-foreground rounded-full p-2 transition-colors backdrop-blur-sm">
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {slides.map((_: any, i: number) => (
            <button key={i} onClick={() => goTo(i)}
              className={`h-2.5 rounded-full transition-all duration-300 ${i === current ? 'bg-accent w-8' : 'bg-primary-foreground/40 w-2.5'}`} />
          ))}
        </div>
      )}
    </section>
  );
};

export default HeroSlider;
