import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Building2, BookOpen, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import SEOHead from '@/components/SEOHead';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { useSiteContent } from '@/hooks/useSiteContent';

const defaultDepartments = [
  { name: 'Textile Engineering', description: 'Core textile manufacturing processes, fiber science, and industrial engineering principles.', slug: 'textile-engineering', color: 'from-blue-500/20 to-blue-600/10' },
  { name: 'Fashion Design', description: 'Creative design, pattern making, draping, and fashion technology for the modern textile industry.', slug: 'fashion-design', color: 'from-pink-500/20 to-pink-600/10' },
  { name: 'Yarn Manufacturing', description: 'Spinning technology, yarn quality control, and advanced yarn production techniques.', slug: 'yarn-manufacturing', color: 'from-green-500/20 to-green-600/10' },
  { name: 'Fabric Analysis', description: 'Fabric testing, quality assessment, weaving technology, and knitting fundamentals.', slug: 'fabric-analysis', color: 'from-purple-500/20 to-purple-600/10' },
  { name: 'Dyeing & Finishing', description: 'Wet processing, color chemistry, printing technology, and sustainable finishing methods.', slug: 'dyeing-finishing', color: 'from-orange-500/20 to-orange-600/10' },
  { name: 'Quality Control', description: 'Quality management systems, testing standards, and compliance for textile products.', slug: 'quality-control', color: 'from-teal-500/20 to-teal-600/10' },
];

const DepartmentsPage = () => {
  const { data: content } = useSiteContent('departments');

  const heroTitle = content?.hero_title || 'Our Departments';
  const heroDesc = content?.hero_description || 'Explore specialized departments covering every aspect of textile science, engineering, and design.';
  const departments = Array.isArray(content?.departments_list) ? content.departments_list : defaultDepartments;

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('id, name, slug, icon_url, sort_order').order('sort_order').limit(100);
      return data ?? [];
    },
  });

  const { data: courseCounts = {} } = useQuery({
    queryKey: ['course-counts-by-category'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('category_id').eq('is_published', true);
      const counts: Record<number, number> = {};
      (data ?? []).forEach((c: any) => { if (c.category_id) counts[c.category_id] = (counts[c.category_id] || 0) + 1; });
      return counts;
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead title="Departments | Online Textile School" description="Explore our academic departments covering all textile engineering disciplines" />
      <Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <section className="bg-gradient-to-br from-primary/10 to-accent/10 py-12 md:py-16">
          <div className="container text-center">
            <Building2 className="h-12 w-12 mx-auto text-primary mb-4" />
            <h1 className="text-3xl md:text-4xl font-heading font-bold mb-3">{heroTitle}</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">{heroDesc}</p>
          </div>
        </section>

        <section className="container py-12">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept: any) => {
              const category = categories.find((c: any) => c.slug === dept.slug);
              const count = category ? (courseCounts as Record<number, number>)[category.id] || 0 : 0;
              return (
                <Card key={dept.slug} className="overflow-hidden hover:shadow-lg transition-shadow group">
                  <div className={`h-32 bg-gradient-to-br ${dept.color} flex items-center justify-center`}>
                    <Building2 className="h-16 w-16 text-primary/30" />
                  </div>
                  <CardContent className="p-5 space-y-3">
                    <h3 className="font-heading font-bold text-lg">{dept.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-3">{dept.description}</p>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <BookOpen className="h-4 w-4" />
                        <span>{count} Courses</span>
                      </div>
                      <Button asChild size="sm" variant="outline" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Link to={`/courses?category=${dept.slug}`}>Explore <ArrowRight className="ml-1 h-3 w-3" /></Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default DepartmentsPage;
