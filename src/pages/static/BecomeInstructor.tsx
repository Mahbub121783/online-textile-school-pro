import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import SEOHead from '@/components/SEOHead';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign, Clock, Globe, Award, ChevronRight,
  CheckCircle, Send, Users, BookOpen, TrendingUp
} from 'lucide-react';

const benefits = [
  { icon: DollarSign, title: 'Earn Revenue', desc: 'Earn up to 70% revenue share on every course sale.' },
  { icon: Clock, title: 'Flexible Schedule', desc: 'Create and manage courses on your own time.' },
  { icon: Globe, title: 'Reach Globally', desc: 'Teach students across Bangladesh and beyond.' },
  { icon: Award, title: 'Build Your Brand', desc: 'Establish yourself as an industry expert.' },
  { icon: Users, title: 'Growing Community', desc: 'Join a network of passionate textile educators.' },
  { icon: TrendingUp, title: 'Analytics & Insights', desc: 'Track student progress and course performance.' },
];

const steps = [
  { step: '01', title: 'Apply', desc: 'Fill out the application form with your expertise and qualifications.' },
  { step: '02', title: 'Get Approved', desc: 'Our team reviews your application within 48 hours.' },
  { step: '03', title: 'Create Courses', desc: 'Use our powerful course builder to create engaging content.' },
  { step: '04', title: 'Start Earning', desc: 'Publish courses and earn from every enrollment.' },
];

const expertiseAreas = [
  'Yarn Manufacturing',
  'Fabric Manufacturing',
  'Wet Processing',
  'Apparel Manufacturing',
  'Textile Testing',
  'Fashion Design',
  'Quality Management',
  'Supply Chain',
  'Sustainability',
  'Other',
];

const BecomeInstructor = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    email: user?.email || '',
    phone: profile?.phone || '',
    expertise: '',
    experience_years: '',
    qualification: '',
    university: profile?.university || '',
    bio: '',
    linkedin_url: '',
    sample_video_url: '',
    motivation: '',
  });

  // Check if user already has a pending/approved application
  const { data: existingApp } = useQuery({
    queryKey: ['my-instructor-application', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('instructor_applications')
        .select('id, status')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
  });

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('instructor_applications').insert({
        user_id: user.id,
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        expertise: form.expertise,
        experience_years: form.experience_years ? parseInt(form.experience_years) : null,
        qualification: form.qualification.trim() || null,
        university: form.university.trim() || null,
        bio: form.bio.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        sample_video_url: form.sample_video_url.trim() || null,
        motivation: form.motivation.trim() || null,
      });
      if (error) throw error;
      toast({ title: 'Application Submitted!', description: 'We will review your application and get back to you soon.' });
      navigate('/dashboard');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead title="Become an Instructor | Online Textile School" description="Share your textile expertise and earn by teaching on Bangladesh's premier online learning platform." />
      <Header />
      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section className="bg-primary text-primary-foreground py-16 md:py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-dark/50 to-transparent" />
          <div className="container relative z-10 text-center max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 bg-accent/20 text-accent-light px-4 py-2 rounded-full text-sm font-medium">
              <BookOpen className="h-4 w-4" /> Now Accepting Applications
            </div>
            <h1 className="font-heading text-3xl md:text-5xl font-bold leading-tight">
              Share Your Expertise.<br />Inspire the Next Generation.
            </h1>
            <p className="text-primary-foreground/80 text-lg max-w-2xl mx-auto">
              Join our growing community of textile industry experts and help shape the future of textile education in Bangladesh.
            </p>
            <a href="#apply" className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-foreground font-semibold px-8 py-3 rounded-lg transition-colors">
              Apply Now <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </section>

        {/* Benefits */}
        <section className="container py-16">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-center mb-10">Why Teach With Us?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((b) => (
              <Card key={b.title} className="border-none shadow-sm bg-secondary/50 hover:shadow-md transition-shadow">
                <CardContent className="p-6 flex gap-4">
                  <div className="bg-primary/10 p-3 rounded-lg h-fit">
                    <b.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold mb-1">{b.title}</h3>
                    <p className="text-sm text-muted-foreground">{b.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section className="bg-secondary/30 py-16">
          <div className="container">
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-center mb-10">How It Works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((s, i) => (
                <div key={s.step} className="relative text-center space-y-3">
                  <div className="text-4xl font-bold text-primary/20 font-heading">{s.step}</div>
                  <h3 className="font-heading font-semibold text-lg">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                  {i < steps.length - 1 && (
                    <ChevronRight className="hidden lg:block absolute top-8 -right-3 h-6 w-6 text-muted-foreground/30" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Requirements */}
        <section className="container py-16 max-w-3xl mx-auto">
          <h2 className="font-heading text-2xl font-bold mb-6">Requirements</h2>
          <ul className="space-y-3">
            {[
              'Minimum 2 years of experience in the textile industry',
              'Strong knowledge in at least one textile discipline',
              'Ability to create structured, high-quality course content',
              'Good communication skills (written & verbal)',
              'Willingness to engage with students and provide feedback',
            ].map((req) => (
              <li key={req} className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-success shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{req}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Application Form */}
        <section id="apply" className="bg-secondary/30 py-16">
          <div className="container max-w-2xl mx-auto">
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-center mb-2">Apply to Teach</h2>
            <p className="text-muted-foreground text-center mb-8">Fill out the form below and we'll review your application within 48 hours.</p>

            {!user ? (
              <Card className="text-center py-12">
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">You need to be logged in to submit an application.</p>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={() => navigate('/auth/login')}>Login</Button>
                    <Button variant="outline" onClick={() => navigate('/auth/register')}>Create Account</Button>
                  </div>
                </CardContent>
              </Card>
            ) : existingApp ? (
              <Card className="text-center py-12">
                <CardContent className="space-y-4">
                  <CheckCircle className="h-12 w-12 mx-auto text-success" />
                  <h3 className="font-heading text-xl font-semibold">Application Already Submitted</h3>
                  <p className="text-muted-foreground">
                    Your application is currently <span className="font-semibold capitalize">{existingApp.status}</span>. We'll notify you once it's reviewed.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Full Name *</Label>
                        <Input required maxLength={100} value={form.full_name} onChange={(e) => handleChange('full_name', e.target.value)} placeholder="Your full name" />
                      </div>
                      <div>
                        <Label>Email *</Label>
                        <Input type="email" required maxLength={255} value={form.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="you@example.com" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Phone</Label>
                        <Input maxLength={20} value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+880 ..." />
                      </div>
                      <div>
                        <Label>Area of Expertise *</Label>
                        <Select value={form.expertise} onValueChange={(v) => handleChange('expertise', v)}>
                          <SelectTrigger><SelectValue placeholder="Select expertise" /></SelectTrigger>
                          <SelectContent>
                            {expertiseAreas.map((a) => (
                              <SelectItem key={a} value={a}>{a}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Years of Experience</Label>
                        <Input type="number" min={0} max={50} value={form.experience_years} onChange={(e) => handleChange('experience_years', e.target.value)} placeholder="e.g. 5" />
                      </div>
                      <div>
                        <Label>Highest Qualification</Label>
                        <Input maxLength={100} value={form.qualification} onChange={(e) => handleChange('qualification', e.target.value)} placeholder="e.g. M.Sc. in Textile Engineering" />
                      </div>
                    </div>
                    <div>
                      <Label>University / Institution</Label>
                      <Input maxLength={200} value={form.university} onChange={(e) => handleChange('university', e.target.value)} placeholder="Where did you study?" />
                    </div>
                    <div>
                      <Label>Short Bio</Label>
                      <Textarea maxLength={1000} rows={3} value={form.bio} onChange={(e) => handleChange('bio', e.target.value)} placeholder="Tell us about yourself and your experience..." />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>LinkedIn Profile URL</Label>
                        <Input maxLength={300} value={form.linkedin_url} onChange={(e) => handleChange('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/..." />
                      </div>
                      <div>
                        <Label>Sample Teaching Video URL</Label>
                        <Input maxLength={300} value={form.sample_video_url} onChange={(e) => handleChange('sample_video_url', e.target.value)} placeholder="YouTube or Drive link" />
                      </div>
                    </div>
                    <div>
                      <Label>Why do you want to teach with us?</Label>
                      <Textarea maxLength={1500} rows={4} value={form.motivation} onChange={(e) => handleChange('motivation', e.target.value)} placeholder="Share your motivation..." />
                    </div>
                    <Button type="submit" disabled={submitting || !form.expertise} className="w-full" size="lg">
                      <Send className="h-4 w-4 mr-2" /> {submitting ? 'Submitting...' : 'Submit Application'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
};

export default BecomeInstructor;
