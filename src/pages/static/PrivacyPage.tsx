import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import SEOHead from '@/components/SEOHead';

const PrivacyPage = () => (
  <>
    <SEOHead title="Privacy Policy | Online Textile School" description="Read our privacy policy to understand how we handle your data." />
    <Header />
    <main className="min-h-screen bg-background">
      <section className="bg-primary text-primary-foreground py-16">
        <div className="container text-center max-w-3xl mx-auto">
          <h1 className="font-heading text-3xl md:text-5xl font-bold">Privacy Policy</h1>
          <p className="text-primary-foreground/80 mt-4">Last updated: March 2026</p>
        </div>
      </section>
      <section className="container py-12 max-w-3xl mx-auto prose prose-slate dark:prose-invert">
        <h2>1. Information We Collect</h2>
        <p>We collect information you provide when creating an account, enrolling in courses, or contacting us. This includes your name, email address, phone number, and payment details processed through our secure payment gateways.</p>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To provide and improve our educational services</li>
          <li>To process payments and manage enrollments</li>
          <li>To send course updates, certificates, and promotional communications</li>
          <li>To respond to support inquiries</li>
          <li>To analyze usage patterns and improve our platform</li>
        </ul>

        <h2>3. Data Sharing</h2>
        <p>We do not sell your personal data. We may share information with trusted service providers (payment processors, email services) strictly to operate our platform. Instructors may access student names and progress for their courses only.</p>

        <h2>4. Data Security</h2>
        <p>We implement industry-standard security measures including encrypted connections (SSL/TLS), secure password hashing, and row-level security on our databases to protect your information.</p>

        <h2>5. Cookies</h2>
        <p>We use essential cookies for authentication and session management. Analytics cookies help us understand how you use our platform. You can control cookie preferences through your browser settings.</p>

        <h2>6. Your Rights</h2>
        <p>You have the right to access, correct, or delete your personal data. You can update your profile information at any time through your dashboard settings or contact us for data deletion requests.</p>

        <h2>7. Children's Privacy</h2>
        <p>Our services are not intended for children under 13. We do not knowingly collect data from children under 13 years of age.</p>

        <h2>8. Changes to This Policy</h2>
        <p>We may update this policy periodically. We will notify you of significant changes via email or through our platform.</p>

        <h2>9. Contact</h2>
        <p>For privacy-related inquiries, contact us at <a href="mailto:info@onlinetextileschool.com">info@onlinetextileschool.com</a>.</p>
      </section>
    </main>
    <Footer />
    <BottomNav />
  </>
);

export default PrivacyPage;
