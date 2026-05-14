import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const isPreviewOrEmbedded = (() => {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.self !== window.top ||
      window.location.hostname.includes('id-preview--') ||
      window.location.hostname.includes('lovable.app') ||
      window.location.hostname.includes('lovableproject.com')
    );
  } catch {
    return true;
  }
})();

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

const SLIDE_INTERVAL = 6000;

/* ── Flip-style countdown with days/hours/minutes/seconds ── */
const useCountdown = (target: string | null) => {
  const [parts, setParts] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  useEffect(() => {
    if (!target) { setParts(null); return; }
    const end = new Date(target).getTime();
    const tick = () => {
      const diff = end - Date.now();
      if (diff <= 0) { setParts(null); return; }
      setParts({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [target]);
  return parts;
};

const CountdownUnit = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <span className="bg-background/20 backdrop-blur-sm text-primary-foreground font-bold text-lg sm:text-xl md:text-2xl px-2.5 py-1 rounded-md min-w-[2.5rem] text-center tabular-nums leading-none">
      {String(value).padStart(2, '0')}
    </span>
    <span className="text-[10px] sm:text-xs text-primary-foreground/70 mt-1 uppercase tracking-wider font-medium">{label}</span>
  </div>
);

const CountdownDisplay = ({ parts, align }: { parts: { d: number; h: number; m: number; s: number }; align: string }) => (
  <div className={`mb-5 ${align === 'center' ? 'flex justify-center' : align === 'right' ? 'flex justify-end' : ''}`}>
    <div className="inline-flex items-center gap-1">
      <span className="text-xs sm:text-sm font-semibold text-primary-foreground/90 mr-2">⏰ Ends in</span>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {parts.d > 0 && <><CountdownUnit value={parts.d} label="Days" /><span className="text-primary-foreground/50 text-lg font-light">:</span></>}
        <CountdownUnit value={parts.h} label="Hrs" />
        <span className="text-primary-foreground/50 text-lg font-light">:</span>
        <CountdownUnit value={parts.m} label="Min" />
        <span className="text-primary-foreground/50 text-lg font-light">:</span>
        <CountdownUnit value={parts.s} label="Sec" />
      </div>
    </div>
  </div>
);

/* ── Slide content with animated text entrance ── */
const SlideContent = ({ slide, animKey }: { slide: any; animKey: number }) => {
  const align = slide.text_alignment || 'left';
  const countdown = useCountdown(slide.countdown_target);

  return (
    <div className={`max-w-2xl ${align === 'center' ? 'text-center mx-auto' : align === 'right' ? 'text-right ml-auto' : ''}`}>
      {slide.is_workshop_slide && (
        <div className={`mb-4 ${align === 'center' ? 'flex justify-center' : align === 'right' ? 'flex justify-end' : ''}`}>
          <span className="inline-flex items-center gap-2 bg-accent/95 text-accent-foreground text-xs sm:text-sm font-bold uppercase tracking-wider px-4 py-1.5 rounded-full shadow-lg backdrop-blur-sm hero-new-badge">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-foreground"></span>
            </span>
            New Workshop Live
          </span>
        </div>
      )}
      {countdown && <CountdownDisplay parts={countdown} align={align} />}

      <h1
        key={`title-${animKey}`}
        className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4 md:mb-6 transition-colors hero-slide-title"
        style={{ color: slide.title_color || undefined }}
      >
        {slide.title}
      </h1>

      <p
        key={`sub-${animKey}`}
        className="text-base md:text-lg mb-6 md:mb-8 max-w-lg leading-relaxed opacity-90 transition-colors hero-slide-subtitle"
        style={{
          color: slide.subtitle_color || undefined,
          marginLeft: align === 'center' ? 'auto' : undefined,
          marginRight: align === 'center' || align === 'left' ? 'auto' : undefined,
        }}
      >
        {slide.subtitle}
      </p>

      <div
        key={`cta-${animKey}`}
        className={`flex flex-wrap gap-3 hero-slide-cta ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : ''}`}
      >
        {slide.cta_text && (
          <Button size="lg" className="bg-accent hover:bg-accent-hover text-accent-foreground font-semibold h-12 px-8 shadow-lg hover:shadow-xl transition-all hover:scale-105" asChild>
            <a href={slide.cta_link || '/'}>{slide.cta_text}</a>
          </Button>
        )}
        {slide.secondary_cta_text && (
          <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 h-12 px-8 backdrop-blur-sm transition-all hover:scale-105" asChild>
            <a href={slide.secondary_cta_link || '/'}>{slide.secondary_cta_text}</a>
          </Button>
        )}
      </div>
    </div>
  );
};

/* ── Main HeroSlider ── */
const HeroSlider = () => {
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const touchStart = useRef<number | null>(null);
  const progressRef = useRef<number>(0);
  const lastTickRef = useRef<number>(Date.now());

  const { data: dbSlides } = useQuery({
    queryKey: ['hero-slides-public'],
    queryFn: async () => {
      const { data } = await supabase.from('hero_slides').select('*').eq('is_active', true).order('sort_order', { ascending: true });
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
    retry: 0,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: [],
    enabled: !isPreviewOrEmbedded,
  });

  // Auto-fetch the latest upcoming published workshop to feature on the hero
  const { data: latestWorkshop } = useQuery({
    queryKey: ['hero-latest-workshop'],
    queryFn: async () => {
      const { data } = await supabase
        .from('workshops')
        .select('id, title, slug, short_description, thumbnail_url, start_at, instructor:user_profiles!workshops_instructor_id_fkey(full_name)')
        .eq('status', 'published')
        .gt('start_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 10 * 60 * 1000,
    retry: 0,
    refetchOnMount: false,
    refetchOnReconnect: false,
    enabled: !isPreviewOrEmbedded,
  });

  const slides = useMemo(() => {
    const base = dbSlides && dbSlides.length > 0 ? dbSlides : FALLBACK_SLIDES;
    if (!latestWorkshop) return base;
    const ws: any = latestWorkshop;
    const link = `/workshops/${ws.slug || ws.id}`;
    const instructorName = ws.instructor?.full_name;
    const workshopSlide = {
      id: `ws-${ws.id}`,
      title: ws.title,
      subtitle: ws.short_description || (instructorName ? `Live workshop with ${instructorName}. Limited seats — register now.` : 'Live workshop. Limited seats — register now.'),
      cta_text: 'Register Now',
      cta_link: link,
      secondary_cta_text: 'View Details',
      secondary_cta_link: link,
      image_url: ws.thumbnail_url || '',
      gradient_from: 'accent',
      gradient_to: 'primary-dark',
      gradient_direction: 'br',
      overlay_opacity: 15,
      text_alignment: 'left',
      title_color: null,
      subtitle_color: null,
      countdown_target: ws.start_at,
      is_workshop_slide: true,
    };
    // Workshop slide ALWAYS pinned to position 1 (index 0), regardless of admin sort_order
    return [workshopSlide, ...base];
  }, [dbSlides, latestWorkshop]);

  // When the workshop slide appears (or changes), snap back to it so it's the first thing users see
  useEffect(() => {
    if (latestWorkshop) {
      setCurrent(0);
      setProgress(0);
      progressRef.current = 0;
      lastTickRef.current = Date.now();
    }
  }, [latestWorkshop?.id]);

  const goTo = useCallback((idx: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent(idx);
    setProgress(0);
    progressRef.current = 0;
    lastTickRef.current = Date.now();
    setTimeout(() => setIsTransitioning(false), 700);
  }, [isTransitioning]);

  const next = useCallback(() => goTo((current + 1) % slides.length), [current, slides.length, goTo]);
  const prev = useCallback(() => goTo((current - 1 + slides.length) % slides.length), [current, slides.length, goTo]);

  // Progress bar + auto-advance with pause-on-hover
  useEffect(() => {
    const raf = () => {
      const now = Date.now();
      if (!isPaused) {
        const delta = now - lastTickRef.current;
        progressRef.current += delta;
        const pct = Math.min((progressRef.current / SLIDE_INTERVAL) * 100, 100);
        setProgress(pct);
        if (progressRef.current >= SLIDE_INTERVAL) {
          next();
          return;
        }
      }
      lastTickRef.current = now;
      frameId = requestAnimationFrame(raf);
    };
    let frameId = requestAnimationFrame(raf);
    return () => cancelAnimationFrame(frameId);
  }, [isPaused, next]);

  // Touch swipe
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { diff > 0 ? next() : prev(); }
    touchStart.current = null;
  };

  // Keyboard nav
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [next, prev]);

  const slide = slides[current];
  const dir = GRADIENT_DIR_MAP[slide.gradient_direction || 'br'] || 'to bottom right';
  const fromColor = getColor(slide.gradient_from || 'primary');
  const toColor = getColor(slide.gradient_to || 'primary-dark');
  const opacity = (slide.overlay_opacity ?? 5) / 100;
  const hasImage = !!slide.image_url;

  return (
    <section
      className="relative w-full h-[60vh] md:h-[80vh] overflow-hidden group"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Hero slider"
      aria-roledescription="carousel"
    >
      {/* Background image with Ken Burns effect */}
      {hasImage && (
        <div className="absolute inset-0 transition-opacity duration-700" key={`img-${current}`}>
          <img
            src={slide.image_url}
            alt=""
            className="w-full h-full object-cover hero-ken-burns"
            style={{ animationDuration: `${SLIDE_INTERVAL}ms` }}
            fetchPriority="high"
            loading="eager"
          />
        </div>
      )}

      {/* Gradient overlay */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{ background: `linear-gradient(${dir}, ${fromColor}, ${toColor})`, opacity: hasImage ? 0.8 : 1 }}
      />

      {/* Pattern overlay */}
      <div
        className="absolute inset-0"
        style={{
          opacity,
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)',
        }}
      />

      {/* Subtle vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%)',
      }} />

      {/* Content */}
      <div className="relative container h-full flex items-center">
        <div className="w-full text-primary-foreground" key={current}>
          <SlideContent slide={slide} animKey={current} />
        </div>
      </div>

      {/* Navigation arrows — visible on hover */}
      {slides.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/20 hover:bg-background/40 text-primary-foreground rounded-full p-2.5 transition-all backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:scale-110"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/20 hover:bg-background/40 text-primary-foreground rounded-full p-2.5 transition-all backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:scale-110"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Bottom bar: progress + dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0">
          {/* Slide progress bar */}
          <div className="h-0.5 bg-primary-foreground/10 w-full">
            <div
              className="h-full bg-accent transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Dots */}
          <div className="flex justify-center gap-2 py-4">
            {slides.map((_: any, i: number) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  i === current ? 'bg-accent w-8' : 'bg-primary-foreground/40 w-2.5 hover:bg-primary-foreground/60'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pause indicator */}
      {isPaused && slides.length > 1 && (
        <div className="absolute top-4 right-4 bg-background/30 backdrop-blur-sm text-primary-foreground text-[10px] px-2 py-1 rounded-full opacity-0 group-hover:opacity-70 transition-opacity">
          ⏸ Paused
        </div>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes kenBurns {
          0% { transform: scale(1); }
          100% { transform: scale(1.08); }
        }
        .hero-ken-burns {
          animation: kenBurns linear forwards;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hero-slide-title {
          animation: slideUp 0.6s ease-out both;
        }
        .hero-slide-subtitle {
          animation: slideUp 0.6s ease-out 0.15s both;
        }
        .hero-slide-cta {
          animation: slideUp 0.6s ease-out 0.3s both;
        }
        .hero-new-badge {
          animation: slideUp 0.5s ease-out both;
        }
      `}</style>
    </section>
  );
};

export default HeroSlider;
