import SEOHead from '@/components/SEOHead';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import HeroSlider from '@/components/features/home/HeroSlider';
import StatsSection from '@/components/features/home/StatsSection';
import FeaturedCourses from '@/components/features/home/FeaturedCourses';
import EbookShowcase from '@/components/features/home/EbookShowcase';
import InstructorSpotlight from '@/components/features/home/InstructorSpotlight';
import TestimonialsSection from '@/components/features/home/TestimonialsSection';
import DemoClassCTA from '@/components/features/home/DemoClassCTA';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead />
      <UtilityBar />
      <Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <HeroSlider />
        <StatsSection />
        <FeaturedCourses />
        <EbookShowcase />
        <InstructorSpotlight />
        <TestimonialsSection />
        <DemoClassCTA />
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default Index;
