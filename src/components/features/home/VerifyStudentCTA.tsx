import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const VerifyStudentCTA = () => {
  return (
    <section className="py-12 md:py-16">
      <div className="container">
        <div className="max-w-3xl mx-auto bg-card border rounded-2xl p-8 md:p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
          <div className="relative">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">Verify a Student</h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-6">
              Employers, institutions, and verification services (like SheerID) can instantly confirm whether an
              Online Textile School ID card or enrollment letter is genuine — directly from our live records.
            </p>
            <Button asChild size="lg" className="gap-2">
              <Link to="/verify-student">
                Verify Student Status <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VerifyStudentCTA;
