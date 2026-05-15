import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/SEOHead';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Briefcase, Clock, DollarSign, MapPin, Search, Star, Filter, Building2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const InternshipsPage = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');

  const { data: internships = [], isLoading } = useQuery({
    queryKey: ['public-internships'],
    queryFn: async () => {
      const { data } = await supabase
        .from('internships')
        .select('id, title, slug, company, location, type, department, short_description, cover_image_url, deadline, is_featured, status, created_at')
        .eq('is_published', true)
        .eq('status', 'open')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(60);
      return data ?? [];
    },
  });

  const { data: myApps = [] } = useQuery({
    queryKey: ['my-internship-apps', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('internship_applications')
        .select('internship_id, status')
        .eq('user_id', user.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const appliedMap = Object.fromEntries(myApps.map((a: any) => [a.internship_id, a.status]));

  const departments = [...new Set(internships.map((i: any) => i.department).filter(Boolean))];

  const filtered = internships.filter((i: any) => {
    const matchSearch = i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.company.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || i.internship_type === typeFilter;
    const matchDept = deptFilter === 'all' || i.department === deptFilter;
    return matchSearch && matchType && matchDept;
  });

  const featured = filtered.filter((i: any) => i.is_featured);
  const regular = filtered.filter((i: any) => !i.is_featured);

  const statusColor = (s: string) => {
    switch (s) {
      case 'accepted': case 'offered': return 'default';
      case 'shortlisted': case 'interviewed': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead title="Internships" description="Find textile engineering internship opportunities. Gain real-world experience with top companies in Bangladesh." breadcrumbs={[{ name: 'Home', url: '/' }, { name: 'Internships', url: '/internships' }]} />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold mb-2">Internship Opportunities</h1>
          <p className="text-muted-foreground">Find and apply for internships — gain real-world experience</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by title or company..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]"><Filter className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="onsite">On-site</SelectItem>
              <SelectItem value="remote">Remote</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
          {departments.length > 0 && (
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[180px]"><Building2 className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading ? (
          <p className="text-center py-12 text-muted-foreground animate-pulse">Loading internships...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Briefcase className="h-14 w-14 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-muted-foreground text-lg">No internships match your filters.</p>
          </div>
        ) : (
          <>
            {/* Featured */}
            {featured.length > 0 && (
              <div className="mb-8">
                <h2 className="font-heading text-lg font-semibold mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" /> Featured Internships
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {featured.map((i: any) => (
                    <InternshipCard key={i.id} internship={i} appStatus={appliedMap[i.id]} user={user} />
                  ))}
                </div>
              </div>
            )}

            {/* Regular */}
            <div className="grid gap-4">
              {regular.map((i: any) => (
                <InternshipCard key={i.id} internship={i} appStatus={appliedMap[i.id]} user={user} />
              ))}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

function InternshipCard({ internship: i, appStatus, user }: { internship: any; appStatus?: string; user: any }) {
  return (
    <Card className={i.is_featured ? 'border-primary/30 bg-primary/5' : ''}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link to={`/internships/${i.id}`} className="font-heading font-bold text-lg hover:text-primary transition-colors">
                {i.title}
              </Link>
              {i.is_featured && <Badge variant="secondary" className="text-xs">Featured</Badge>}
              <Badge variant="outline" className="capitalize text-xs">{i.internship_type}</Badge>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-3.5 w-3.5" /> {i.company} {i.location && `• ${i.location}`}
            </p>
            {i.description && <p className="text-sm mt-2 line-clamp-2">{i.description}</p>}
            <div className="flex flex-wrap gap-3 mt-3 items-center">
              {i.stipend && (
                <span className="text-xs flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="h-3 w-3" /> {i.stipend}
                </span>
              )}
              {i.duration && (
                <span className="text-xs flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" /> {i.duration}
                </span>
              )}
              {i.positions_available > 0 && (
                <span className="text-xs flex items-center gap-1 text-muted-foreground">
                  <Users className="h-3 w-3" /> {i.positions_available - (i.positions_filled || 0)} positions left
                </span>
              )}
              {i.application_deadline && (
                <span className="text-xs text-muted-foreground">
                  Deadline: {new Date(i.application_deadline).toLocaleDateString()}
                </span>
              )}
            </div>
            {i.skills_required?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {i.skills_required.slice(0, 5).map((s: string) => (
                  <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0">{s}</Badge>
                ))}
                {i.skills_required.length > 5 && <span className="text-xs text-muted-foreground">+{i.skills_required.length - 5}</span>}
              </div>
            )}
          </div>
          <div className="shrink-0">
            {appStatus ? (
              <Badge variant={appStatus === 'accepted' ? 'default' : appStatus === 'rejected' ? 'destructive' : 'outline'} className="capitalize">{appStatus}</Badge>
            ) : (
              <Button size="sm" asChild>
                <Link to={`/internships/${i.id}`}>View & Apply</Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default InternshipsPage;
