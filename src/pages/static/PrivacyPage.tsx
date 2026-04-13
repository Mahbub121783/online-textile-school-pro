import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import SEOHead from '@/components/SEOHead';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Shield, Eye, Share2, Lock, Cookie, UserCheck, Baby, RefreshCw, Mail,
  Printer, ChevronDown, ChevronUp, FileText, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const sections = [
  { id: 'info-collect', icon: Eye, title: '1. Information We Collect', content: 'We collect information you provide when creating an account, enrolling in courses, or contacting us. This includes your name, email address, phone number, and payment details processed through our secure payment gateways.' },
  { id: 'how-use', icon: Shield, title: '2. How We Use Your Information', list: ['To provide and improve our educational services', 'To process payments and manage enrollments', 'To send course updates, certificates, and promotional communications', 'To respond to support inquiries', 'To analyze usage patterns and improve our platform'] },
  { id: 'data-sharing', icon: Share2, title: '3. Data Sharing', content: 'We do not sell your personal data. We may share information with trusted service providers (payment processors, email services) strictly to operate our platform. Instructors may access student names and progress for their courses only.' },
  { id: 'data-security', icon: Lock, title: '4. Data Security', content: 'We implement industry-standard security measures including encrypted connections (SSL/TLS), secure password hashing, and row-level security on our databases to protect your information.' },
  { id: 'cookies', icon: Cookie, title: '5. Cookies', content: 'We use essential cookies for authentication and session management. Analytics cookies help us understand how you use our platform. You can control cookie preferences through your browser settings.' },
  { id: 'your-rights', icon: UserCheck, title: '6. Your Rights', content: 'You have the right to access, correct, or delete your personal data. You can update your profile information at any time through your dashboard settings or contact us for data deletion requests.' },
  { id: 'children', icon: Baby, title: "7. Children's Privacy", content: 'Our services are not intended for children under 13. We do not knowingly collect data from children under 13 years of age.' },
  { id: 'changes', icon: RefreshCw, title: '8. Changes to This Policy', content: 'We may update this policy periodically. We will notify you of significant changes via email or through our platform.' },
  { id: 'contact', icon: Mail, title: '9. Contact', content: 'For privacy-related inquiries, contact us at info@onlinetextileschool.com.' },
];

const PrivacyPage = () => {
  const [tocOpen, setTocOpen] = useState(false);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTocOpen(false);
  };

  return (
    <>
      <SEOHead title="Privacy Policy | Online Textile School" description="Learn how Online Textile School collects, uses, and protects your personal data." />
      <Header />
      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section className="bg-primary text-primary-foreground py-16">
          <div className="container max-w-5xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center gap-2 bg-primary-foreground/10 rounded-full px-4 py-1.5">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Your Privacy Matters</span>
            </div>
            <h1 className="font-heading text-3xl md:text-5xl font-bold">Privacy Policy</h1>
            <p className="text-primary-foreground/70 max-w-xl mx-auto">How we handle, protect, and respect your personal information at Online Textile School.</p>
            <Badge variant="secondary" className="mt-2">Last updated: March 2026</Badge>
          </div>
        </section>

        <div className="container max-w-5xl mx-auto py-8">
          {/* Breadcrumb + Print */}
          <div className="flex items-center justify-between mb-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem><BreadcrumbLink asChild><Link to="/">Home</Link></BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbPage>Privacy Policy</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="hidden md:inline-flex gap-1.5">
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>

          {/* Mobile TOC */}
          <div className="md:hidden mb-6">
            <Button variant="outline" className="w-full justify-between" onClick={() => setTocOpen(!tocOpen)}>
              <span className="text-sm font-medium">Table of Contents</span>
              {tocOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {tocOpen && (
              <Card className="mt-2">
                <CardContent className="p-3 space-y-1">
                  {sections.map((s) => (
                    <button key={s.id} onClick={() => scrollTo(s.id)} className="w-full text-left text-sm py-1.5 px-2 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      {s.title}
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex gap-8">
            {/* Desktop TOC */}
            <aside className="hidden md:block w-56 shrink-0">
              <div className="sticky top-24 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Contents</p>
                {sections.map((s) => (
                  <button key={s.id} onClick={() => scrollTo(s.id)} className="w-full text-left text-sm py-1.5 px-3 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    {s.title}
                  </button>
                ))}
              </div>
            </aside>

            {/* Sections */}
            <div className="flex-1 space-y-6">
              {sections.map((s) => (
                <Card key={s.id} id={s.id} className="scroll-mt-24">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                        <s.icon className="h-5 w-5" />
                      </div>
                      <h2 className="text-lg font-semibold text-foreground">{s.title}</h2>
                    </div>
                    {s.content && <p className="text-muted-foreground leading-relaxed">{s.content}</p>}
                    {s.list && (
                      <ul className="space-y-2 mt-1">
                        {s.list.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-muted-foreground">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ))}

              {/* Cross-link */}
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">Terms of Service</p>
                      <p className="text-sm text-muted-foreground">Read our terms governing platform usage</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/terms" className="gap-1.5">View <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
};

export default PrivacyPage;
