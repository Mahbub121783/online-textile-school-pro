import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import SEOHead from '@/components/SEOHead';

const TermsPage = () => (
  <>
    <SEOHead title="Terms of Service | Online Textile School" description="Read our terms of service governing the use of our platform." />
    <Header />
    <main className="min-h-screen bg-background">
      <section className="bg-primary text-primary-foreground py-16">
        <div className="container text-center max-w-3xl mx-auto">
          <h1 className="font-heading text-3xl md:text-5xl font-bold">Terms of Service</h1>
          <p className="text-primary-foreground/80 mt-4">Last updated: March 2026</p>
        </div>
      </section>
      <section className="container py-12 max-w-3xl mx-auto prose prose-slate dark:prose-invert">
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing or using Online Textile School, you agree to be bound by these terms. If you disagree, please do not use our platform.</p>

        <h2>2. User Accounts</h2>
        <p>You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your credentials and for all activities under your account.</p>

        <h2>3. Course Enrollment & Access</h2>
        <ul>
          <li>Course access is granted upon successful payment</li>
          <li>Access is personal and non-transferable</li>
          <li>Course content may be updated by instructors at any time</li>
          <li>Lifetime access is provided unless otherwise stated</li>
        </ul>

        <h2>4. Payments & Refunds</h2>
        <p>All prices are listed in BDT. Payments are processed securely through our supported gateways. Refund requests must be made within 7 days of purchase. Digital products (eBooks) are non-refundable once downloaded.</p>

        <h2>5. Intellectual Property</h2>
        <p>All course content, materials, videos, and eBooks are protected by copyright. You may not reproduce, distribute, or share purchased content without explicit permission.</p>

        <h2>6. Instructor Terms</h2>
        <p>Instructors retain ownership of their course content but grant Online Textile School a license to host and distribute it on the platform. Revenue sharing is governed by individual agreements.</p>

        <h2>7. Code of Conduct</h2>
        <ul>
          <li>No plagiarism or academic dishonesty</li>
          <li>Respectful communication in discussions and forums</li>
          <li>No sharing of account credentials</li>
          <li>No unauthorized recording or redistribution of content</li>
        </ul>

        <h2>8. Limitation of Liability</h2>
        <p>Online Textile School provides educational content "as is." We do not guarantee specific outcomes, employment, or certifications beyond our platform certificates.</p>

        <h2>9. Termination</h2>
        <p>We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time through your dashboard settings.</p>

        <h2>10. Governing Law</h2>
        <p>These terms are governed by the laws of Bangladesh. Disputes shall be resolved through the courts of Dhaka.</p>

        <h2>11. Contact</h2>
        <p>For questions about these terms, contact us at <a href="mailto:info@onlinetextileschool.com">info@onlinetextileschool.com</a>.</p>
      </section>
    </main>
    <Footer />
    <BottomNav />
  </>
);

export default TermsPage;
