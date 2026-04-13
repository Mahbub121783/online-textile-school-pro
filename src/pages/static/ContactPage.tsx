import { useState } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import SEOHead from '@/components/SEOHead';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SITE_CONFIG } from '@/lib/constants';
import { Phone, Mail, MapPin, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSiteContent } from '@/hooks/useSiteContent';

const ContactPage = () => {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const { data: content } = useSiteContent('contact');

  const heroTitle = content?.hero_title || 'Contact Us';
  const heroDesc = content?.hero_description || "We'd love to hear from you. Reach out anytime.";
  const address = content?.address || 'Bangladesh';

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      toast({ title: 'Message Sent!', description: 'We will get back to you within 24 hours.' });
      setSending(false);
      (e.target as HTMLFormElement).reset();
    }, 800);
  };

  return (
    <>
      <SEOHead title="Contact Us | Online Textile School" description="Get in touch with Online Textile School for inquiries, support, or partnership opportunities." />
      <Header />
      <main className="min-h-screen bg-background">
        <section className="bg-primary text-primary-foreground py-16">
          <div className="container text-center max-w-3xl mx-auto space-y-4">
            <h1 className="font-heading text-3xl md:text-5xl font-bold">{heroTitle}</h1>
            <p className="text-primary-foreground/80 text-lg">{heroDesc}</p>
          </div>
        </section>

        <section className="container py-12">
          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            <div className="space-y-8">
              <h2 className="font-heading text-2xl font-bold">Get In Touch</h2>
              <div className="space-y-4">
                <a href={`tel:${SITE_CONFIG.phone}`} className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors">
                  <div className="bg-primary/10 p-3 rounded-lg"><Phone className="h-5 w-5 text-primary" /></div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Phone</p>
                    <p>{SITE_CONFIG.phone}</p>
                  </div>
                </a>
                <a href={`mailto:${SITE_CONFIG.email}`} className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors">
                  <div className="bg-primary/10 p-3 rounded-lg"><Mail className="h-5 w-5 text-primary" /></div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Email</p>
                    <p>{SITE_CONFIG.email}</p>
                  </div>
                </a>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="bg-primary/10 p-3 rounded-lg"><MapPin className="h-5 w-5 text-primary" /></div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Address</p>
                    <p>{address}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card border rounded-xl p-6 shadow-sm">
              <h3 className="font-heading text-lg font-semibold mb-4">Send a Message</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><Label htmlFor="name">Your Name</Label><Input id="name" required maxLength={100} placeholder="Full name" /></div>
                <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required maxLength={255} placeholder="you@example.com" /></div>
                <div><Label htmlFor="subject">Subject</Label><Input id="subject" required maxLength={200} placeholder="How can we help?" /></div>
                <div><Label htmlFor="message">Message</Label><Textarea id="message" required maxLength={2000} rows={5} placeholder="Write your message..." /></div>
                <Button type="submit" disabled={sending} className="w-full">
                  <Send className="h-4 w-4 mr-2" /> {sending ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
};

export default ContactPage;
