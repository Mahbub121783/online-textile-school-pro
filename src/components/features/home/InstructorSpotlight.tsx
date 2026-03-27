import { BookOpen, Users, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const INSTRUCTORS = [
  { name: 'Dr. Mahbub Rahman', designation: 'Professor', specialization: 'Spinning Technology', students: 2340, courses: 8, avatar: '' },
  { name: 'Prof. Abdul Karim', designation: 'Associate Professor', specialization: 'Weaving & Fabric Structure', students: 1560, courses: 5, avatar: '' },
  { name: 'Dr. Fatema Akter', designation: 'Industry Expert', specialization: 'Dyeing & Color Chemistry', students: 3120, courses: 12, avatar: '' },
  { name: 'Eng. Hasan Ali', designation: 'Senior Engineer', specialization: 'Knitting Technology', students: 890, courses: 4, avatar: '' },
];

const InstructorSpotlight = () => {
  return (
    <section className="py-12 md:py-16 bg-background">
      <div className="container">
        <div className="text-center mb-8">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">Our Expert Instructors</h2>
          <p className="text-muted-foreground">Learn from Bangladesh's leading textile professionals</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {INSTRUCTORS.map((inst) => (
            <div key={inst.name} className="bg-card border rounded-lg p-6 text-center hover:shadow-lg transition-all group">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-light mx-auto mb-4 flex items-center justify-center text-primary-foreground font-heading font-bold text-xl">
                {inst.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <h3 className="font-heading font-semibold text-foreground">{inst.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{inst.designation}</p>
              <p className="text-xs text-primary mt-1">{inst.specialization}</p>
              <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{inst.students.toLocaleString()}</span>
                <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{inst.courses} courses</span>
              </div>
              <Button variant="outline" size="sm" className="mt-4 w-full text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <ExternalLink className="h-3 w-3 mr-1" />View Profile
              </Button>
            </div>
          ))}
        </div>
        <div className="text-center mt-8 bg-accent/10 border border-accent/20 rounded-lg p-6">
          <h3 className="font-heading font-semibold text-foreground mb-2">Are you a textile expert?</h3>
          <p className="text-sm text-muted-foreground mb-4">Share your knowledge and earn with Online Textile School</p>
          <Button className="bg-accent hover:bg-accent-hover text-accent-foreground">Become an Instructor</Button>
        </div>
      </div>
    </section>
  );
};

export default InstructorSpotlight;
