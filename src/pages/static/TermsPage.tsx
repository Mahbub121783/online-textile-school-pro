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
  FileText, UserCheck, BookOpen, CreditCard, Copyright, GraduationCap, ShieldCheck,
  AlertTriangle, XCircle, Scale, Mail, Printer, ChevronDown, ChevronUp, Shield, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const sections = [
  { id: 'acceptance', icon: FileText, title: '1. Acceptance of Terms', content: 'By accessing or using Online Textile School, you agree to be bound by these terms. If you disagree, please do not use our platform.' },
  { id: 'accounts', icon: UserCheck, title: '2. User Accounts', content: 'You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your credentials and for all activities under your account.' },
  { id: 'enrollment', icon: BookOpen, title: '3. Course Enrollment & Access', list: ['Course access is granted upon successful payment', 'Access is personal and non-transferable', 'Course content may be updated by instructors at any time', 'Lifetime access is provided unless otherwise stated'] },
  { id: 'payments', icon: CreditCard, title: '4. Payments & Refunds', content: 'All prices are listed in BDT. Payments are processed securely through our supported gateways. Refund requests must be made within 7 days of purchase. Digital products (eBooks) are non-refundable once downloaded.' },
  { id: 'ip', icon: Copyright, title: '5. Intellectual Property', content: 'All course content, materials, videos, and eBooks are protected by copyright. You may not reproduce, distribute, or share purchased content without explicit permission.' },
  { id: 'instructor', icon: GraduationCap, title: '6. Instructor Terms', content: 'Instructors retain ownership of their course content but grant Online Textile School a license to host and distribute it on the platform. Revenue sharing is governed by individual agreements.' },
  { id: 'conduct', icon: ShieldCheck, title: '7. Code of Conduct', list: ['No plagiarism or academic dishonesty', 'Respectful communication in discussions and forums', 'No sharing of account credentials', 'No unauthorized recording or redistribution of content'] },
  { id: 'liability', icon: AlertTriangle, title: '8. Limitation of Liability', content: 'Online Textile School provides educational content "as is." We do not guarantee specific outcomes, employment, or certifications beyond our platform certificates.' },
  { id: 'termination', icon: XCircle, title: '9. Termination', content: 'We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time through your dashboard settings.' },
  { id: 'governing', icon: Scale, title: '10. Governing Law', content: 'These terms are governed by the laws of Bangladesh. Disputes shall be resolved through the courts of Dhaka.' },
  { id: 'contact', icon: Mail, title: '11. Contact', content: 'For questions about these terms, contact us at info@onlinetextileschool.com.' },
];

const TermsPage = () => {
  const [tocOpen, setTocOpen] = useState(false);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTocOpen(false);
  };

  return (
    <>
      <SEOHead title="Terms of Service | Online Textile School" description="Read the terms and conditions governing the use of Online Textile School platform." />
      <Header />
      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section className="bg-primary text-primary-foreground py-16">
          <div className="container max-w-5xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center gap-2 bg-primary-foreground/10 rounded-full px-4 py-1.5">
              <Scale className="h-4 w-4" />
              <span className="text-sm font-medium">Legal Agreement</span>
            </div>
            <h1 className="font-heading text-3xl md:text-5xl font-bold">Terms of Service</h1>
            <p className="text-primary-foreground/70 max-w-xl mx-auto">The rules and guidelines that govern your use of Online Textile School's platform and services.</p>
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
                <BreadcrumbItem><BreadcrumbPage>Terms of Service</BreadcrumbPage></BreadcrumbItem>
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
                    <Shield className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">Privacy Policy</p>
                      <p className="text-sm text-muted-foreground">Learn how we protect your personal data</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/privacy" className="gap-1.5">View <ArrowRight className="h-4 w-4" /></Link>
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

export default TermsPage;
