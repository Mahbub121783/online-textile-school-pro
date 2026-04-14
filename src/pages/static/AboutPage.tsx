import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import SEOHead from '@/components/SEOHead';
import { useSiteContent } from '@/hooks/useSiteContent';
import { BookOpen, Users, Award, Globe } from 'lucide-react';

const defaultStats = [
  { icon: 'BookOpen', label: 'Courses Available', value: '50+' },
  { icon: 'Users', label: 'Active Students', value: '5,000+' },
  { icon: 'Award', label: 'Certificates Issued', value: '2,000+' },
  { icon: 'Globe', label: 'Countries Reached', value: '20+' },
];

const defaultWhyChoose = [
  'Industry-expert instructors with years of practical experience',
  'Structured curriculum aligned with industry standards',
  'Flexible learning — study at your own pace, anywhere',
  'Interactive quizzes and assignments for hands-on learning',
  'Recognized certificates upon course completion',
  'Affordable pricing with regular discounts',
];

const iconMap: Record<string, React.ElementType> = { BookOpen, Users, Award, Globe };

const AboutPage = () => {
  const { data: content } = useSiteContent('about');

  const heroTitle = content?.hero_title || 'About Online Textile School';
  const heroDesc = content?.hero_description || 'Empowering textile professionals and students across Bangladesh and beyond with world-class online education.';
  const mission = content?.mission || 'To democratize textile education by providing affordable, high-quality online courses designed by industry experts. We believe every textile professional deserves access to continuous learning opportunities regardless of their location or financial situation.';
  const vision = content?.vision || 'To become the leading online platform for textile engineering education in South Asia, bridging the gap between academic knowledge and industry requirements. We envision a future where every textile professional is equipped with cutting-edge skills and knowledge.';
  const whyChoose: string[] = Array.isArray(content?.why_choose_us) ? content.why_choose_us : defaultWhyChoose;
  const stats = Array.isArray(content?.stats) ? content.stats : defaultStats;

  return (
    <>
      <SEOHead
        title="About Us"
        description="Learn about Online Textile School — Bangladesh's premier online textile engineering education platform. Our mission, vision, and why students choose us."
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'About Us', url: '/about' },
        ]}
      />
      <Header />
      <main className="min-h-screen bg-background">
        <section className="bg-primary text-primary-foreground py-16 md:py-24">
          <div className="container text-center max-w-3xl mx-auto space-y-4">
            <h1 className="font-heading text-3xl md:text-5xl font-bold">{heroTitle}</h1>
            <p className="text-primary-foreground/80 text-lg leading-relaxed">{heroDesc}</p>
          </div>
        </section>

        <section className="container py-12 -mt-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((s: any) => {
              const Icon = iconMap[s.icon] || BookOpen;
              return (
                <div key={s.label} className="bg-card rounded-xl p-6 text-center shadow-sm border">
                  <Icon className="h-8 w-8 mx-auto text-primary mb-2" />
                  <p className="text-2xl font-bold font-heading">{s.value}</p>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="container py-12 max-w-4xl mx-auto space-y-12">
          <div className="space-y-4">
            <h2 className="font-heading text-2xl font-bold">Our Mission</h2>
            <p className="text-muted-foreground leading-relaxed">{mission}</p>
          </div>
          <div className="space-y-4">
            <h2 className="font-heading text-2xl font-bold">Our Vision</h2>
            <p className="text-muted-foreground leading-relaxed">{vision}</p>
          </div>
          <div className="space-y-4">
            <h2 className="font-heading text-2xl font-bold">Why Choose Us?</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              {whyChoose.map((item: string, i: number) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
};

export default AboutPage;
