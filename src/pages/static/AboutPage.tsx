import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import SEOHead from '@/components/SEOHead';
import { SITE_CONFIG } from '@/lib/constants';
import { BookOpen, Users, Award, Globe } from 'lucide-react';

const stats = [
  { icon: BookOpen, label: 'Courses Available', value: '50+' },
  { icon: Users, label: 'Active Students', value: '5,000+' },
  { icon: Award, label: 'Certificates Issued', value: '2,000+' },
  { icon: Globe, label: 'Countries Reached', value: '20+' },
];

const AboutPage = () => (
  <>
    <SEOHead title="About Us | Online Textile School" description="Learn about Bangladesh's premier online textile education platform." />
    <Header />
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-primary text-primary-foreground py-16 md:py-24">
        <div className="container text-center max-w-3xl mx-auto space-y-4">
          <h1 className="font-heading text-3xl md:text-5xl font-bold">About Online Textile School</h1>
          <p className="text-primary-foreground/80 text-lg leading-relaxed">
            Empowering textile professionals and students across Bangladesh and beyond with world-class online education.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="container py-12 -mt-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-card rounded-xl p-6 text-center shadow-sm border">
              <s.icon className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold font-heading">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="container py-12 max-w-4xl mx-auto space-y-12">
        <div className="space-y-4">
          <h2 className="font-heading text-2xl font-bold">Our Mission</h2>
          <p className="text-muted-foreground leading-relaxed">
            To democratize textile education by providing affordable, high-quality online courses designed by industry experts. We believe every textile professional deserves access to continuous learning opportunities regardless of their location or financial situation.
          </p>
        </div>
        <div className="space-y-4">
          <h2 className="font-heading text-2xl font-bold">Our Vision</h2>
          <p className="text-muted-foreground leading-relaxed">
            To become the leading online platform for textile engineering education in South Asia, bridging the gap between academic knowledge and industry requirements. We envision a future where every textile professional is equipped with cutting-edge skills and knowledge.
          </p>
        </div>
        <div className="space-y-4">
          <h2 className="font-heading text-2xl font-bold">Why Choose Us?</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Industry-expert instructors with years of practical experience</li>
            <li>Structured curriculum aligned with industry standards</li>
            <li>Flexible learning — study at your own pace, anywhere</li>
            <li>Interactive quizzes and assignments for hands-on learning</li>
            <li>Recognized certificates upon course completion</li>
            <li>Affordable pricing with regular discounts</li>
          </ul>
        </div>
      </section>
    </main>
    <Footer />
    <BottomNav />
  </>
);

export default AboutPage;
