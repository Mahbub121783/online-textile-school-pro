import { lazy, Suspense, memo, useRef, useState, useEffect, ReactNode } from 'react';
import SEOHead from '@/components/SEOHead';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import HeroSlider from '@/components/features/home/HeroSlider';

const StatsSection = lazy(() => import('@/components/features/home/StatsSection'));
const FeaturedCourses = lazy(() => import('@/components/features/home/FeaturedCourses'));
const EbookShowcase = lazy(() => import('@/components/features/home/EbookShowcase'));
const InstructorSpotlight = lazy(() => import('@/components/features/home/InstructorSpotlight'));
const TestimonialsSection = lazy(() => import('@/components/features/home/TestimonialsSection'));
const DemoClassCTA = lazy(() => import('@/components/features/home/DemoClassCTA'));
const UpcomingEvents = lazy(() => import('@/components/features/home/UpcomingEvents'));
const LearningPathsPreview = lazy(() => import('@/components/features/home/LearningPathsPreview'));
const SponsorsSection = lazy(() => import('@/components/features/home/SponsorsSection'));

const SectionFallback = () => (
  <div className="py-12 flex items-center justify-center">
    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

/** Renders children only after the wrapper scrolls into view */
const LazySection = ({ children }: { children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {visible ? (
        <Suspense fallback={<SectionFallback />}>{children}</Suspense>
      ) : (
        <SectionFallback />
      )}
    </div>
  );
};

const MemoHeader = memo(Header);
const MemoFooter = memo(Footer);
const MemoBottomNav = memo(BottomNav);

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead />
      <UtilityBar />
      <MemoHeader />
      <main className="flex-1 pb-14 lg:pb-0">
        <HeroSlider />
        <Suspense fallback={<SectionFallback />}>
          <StatsSection />
        </Suspense>
        <LazySection><FeaturedCourses /></LazySection>
        <LazySection><LearningPathsPreview /></LazySection>
        <LazySection><EbookShowcase /></LazySection>
        <LazySection><UpcomingEvents /></LazySection>
        <LazySection><InstructorSpotlight /></LazySection>
        <LazySection><TestimonialsSection /></LazySection>
        <LazySection><DemoClassCTA /></LazySection>
        <LazySection><SponsorsSection /></LazySection>
      </main>
      <MemoFooter />
      <MemoBottomNav />
    </div>
  );
};

export default Index;
