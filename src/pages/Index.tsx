import { lazy, Suspense, memo } from 'react';
import SEOHead from '@/components/SEOHead';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import HeroSlider from '@/components/features/home/HeroSlider';

// Lazy-load below-the-fold sections — not needed for initial paint
const StatsSection = lazy(() => import('@/components/features/home/StatsSection'));
const FeaturedCourses = lazy(() => import('@/components/features/home/FeaturedCourses'));
const EbookShowcase = lazy(() => import('@/components/features/home/EbookShowcase'));
const InstructorSpotlight = lazy(() => import('@/components/features/home/InstructorSpotlight'));
const TestimonialsSection = lazy(() => import('@/components/features/home/TestimonialsSection'));
const DemoClassCTA = lazy(() => import('@/components/features/home/DemoClassCTA'));

const SectionFallback = () => (
  <div className="py-12 flex items-center justify-center">
    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

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
        <Suspense fallback={<SectionFallback />}>
          <FeaturedCourses />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <EbookShowcase />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <InstructorSpotlight />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <TestimonialsSection />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <DemoClassCTA />
        </Suspense>
      </main>
      <MemoFooter />
      <MemoBottomNav />
    </div>
  );
};

export default Index;
