import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Mail, Phone } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';

const FacultyPage = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');

  const { data: faculty = [], isLoading } = useQuery({
    queryKey: ['public-faculty'],
    queryFn: async () => {
      const { data } = await supabase
        .from('faculty_members')
        .select('id, name, designation, department, photo_url, email, bio, specialization, sort_order')
        .eq('is_active', true)
        .order('sort_order')
        .order('name')
        .limit(200);
      return data ?? [];
    },
  });

  const departments = useMemo(() => {
    const depts = new Set(faculty.map((f: any) => f.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [faculty]);

  const filtered = useMemo(() => {
    return faculty.filter((f: any) => {
      const matchSearch = !search || f.name?.toLowerCase().includes(search.toLowerCase()) || f.specialization?.toLowerCase().includes(search.toLowerCase());
      const matchDept = department === 'all' || f.department === department;
      return matchSearch && matchDept;
    });
  }, [faculty, search, department]);

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead title={`${t('faculty.title')} | Online Textile University`} description={t('faculty.subtitle')} />
      <UtilityBar />
      <Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <div className="bg-primary text-primary-foreground py-10">
          <div className="container text-center">
            <h1 className="font-heading text-3xl font-bold">{t('faculty.title')}</h1>
            <p className="text-primary-foreground/70 mt-2">{t('faculty.subtitle')}</p>
          </div>
        </div>

        <div className="container py-8">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`${t('common.search')}...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder={t('faculty.allDepartments')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('faculty.allDepartments')}</SelectItem>
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-center text-muted-foreground animate-pulse">{t('common.loading')}</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">{t('faculty.noFaculty')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.map((member: any) => (
                <Card key={member.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-[3/4] bg-gradient-to-br from-primary/10 to-accent/10 relative overflow-hidden">
                    {member.photo_url ? (
                      <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-5xl font-bold text-primary/30">{member.name?.[0]?.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="font-heading font-semibold text-base">{member.name}</h3>
                    {member.designation && <p className="text-xs text-primary font-medium">{member.designation}</p>}
                    {member.department && <Badge variant="outline" className="text-[10px]">{member.department}</Badge>}
                    {member.specialization && (
                      <p className="text-xs text-muted-foreground"><span className="font-medium">{t('faculty.specialization')}:</span> {member.specialization}</p>
                    )}
                    {member.bio && <p className="text-xs text-muted-foreground line-clamp-3">{member.bio}</p>}
                    <div className="flex items-center gap-3 pt-1">
                      {member.email && (
                        <a href={`mailto:${member.email}`} className="text-muted-foreground hover:text-primary transition-colors">
                          <Mail className="h-4 w-4" />
                        </a>
                      )}
                      {member.phone && (
                        <a href={`tel:${member.phone}`} className="text-muted-foreground hover:text-primary transition-colors">
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default FacultyPage;
