import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useContributorVote } from '@/hooks/useContributors';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThumbsUp, BookOpen, GraduationCap, Calendar, FileText, Globe, Github, Linkedin, Twitter, Mail, Star, Users } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/SEOHead';

const SocialIcon = ({ kind }: { kind: string }) => {
  const k = kind.toLowerCase();
  if (k.includes('github')) return <Github className="h-4 w-4" />;
  if (k.includes('linkedin')) return <Linkedin className="h-4 w-4" />;
  if (k.includes('twitter') || k.includes('x.com')) return <Twitter className="h-4 w-4" />;
  if (k.includes('mail') || k.includes('@')) return <Mail className="h-4 w-4" />;
  return <Globe className="h-4 w-4" />;
};

const ContributorProfile = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { hasVoted, toggle } = useContributorVote(id);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['contributor-profile', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url, bio, headline, expertise, social_links, vote_count, is_public_contributor, created_at')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['contributor-courses', id],
    enabled: !!id,
    queryFn: async () => {
      const [{ data: owned }, { data: linked }] = await Promise.all([
        supabase.from('courses').select('id, title, slug, thumbnail_url, avg_rating, enrollment_count, price').eq('instructor_id', id!).eq('is_published', true),
        supabase.from('content_contributors').select('content_id, role, courses:content_id(id, title, slug, thumbnail_url, avg_rating, enrollment_count, price, is_published)').eq('content_type', 'course').eq('user_id', id!),
      ]);
      const linkedCourses = (linked || []).map((l: any) => l.courses).filter((c: any) => c?.is_published);
      const map = new Map<string, any>();
      [...(owned || []), ...linkedCourses].forEach((c: any) => c && map.set(c.id, c));
      return Array.from(map.values());
    },
  });

  const { data: ebooks = [] } = useQuery({
    queryKey: ['contributor-ebooks', id],
    enabled: !!id && !!profile?.full_name,
    queryFn: async () => {
      const [{ data: byName }, { data: linked }] = await Promise.all([
        supabase.from('ebooks').select('id, title, slug, cover_url, price, discount_price').eq('is_published', true).or(`author.eq.${profile!.full_name},sub_writers.cs.{${profile!.full_name}}`),
        supabase.from('content_contributors').select('content_id, role, ebooks:content_id(id, title, slug, cover_url, price, discount_price, is_published)').eq('content_type', 'ebook').eq('user_id', id!),
      ]);
      const linkedEbooks = (linked || []).map((l: any) => l.ebooks).filter((e: any) => e?.is_published);
      const map = new Map<string, any>();
      [...(byName || []), ...linkedEbooks].forEach((e: any) => e && map.set(e.id, e));
      return Array.from(map.values());
    },
  });

  const { data: workshops = [] } = useQuery({
    queryKey: ['contributor-workshops', id],
    enabled: !!id,
    queryFn: async () => {
      const [{ data: owned }, { data: linked }] = await Promise.all([
        supabase.from('workshops').select('id, title, slug, thumbnail_url, start_date, status').eq('instructor_id', id!).eq('status', 'published'),
        supabase.from('content_contributors').select('content_id, role, workshops:content_id(id, title, slug, thumbnail_url, start_date, status)').eq('content_type', 'workshop').eq('user_id', id!),
      ]);
      const linkedW = (linked || []).map((l: any) => l.workshops).filter((w: any) => w?.status === 'published');
      const map = new Map<string, any>();
      [...(owned || []), ...linkedW].forEach((w: any) => w && map.set(w.id, w));
      return Array.from(map.values());
    },
  });

  const { data: papers = [] } = useQuery({
    queryKey: ['contributor-papers', id, profile?.full_name],
    enabled: !!id && !!profile?.full_name,
    queryFn: async () => {
      const { data } = await supabase
        .from('research_papers')
        .select('id, title, abstract, view_count, download_count, authors')
        .contains('authors', [profile!.full_name])
        .limit(20);
      return data || [];
    },
  });

  const { data: endorsers = [] } = useQuery({
    queryKey: ['contributor-endorsers', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from('contributor_votes')
        .select('voter_id, created_at, user_profiles:voter_id(id, full_name, avatar_url)')
        .eq('contributor_id', id!)
        .order('created_at', { ascending: false })
        .limit(8);
      return (data || []).map((r: any) => r.user_profiles).filter(Boolean);
    },
  });

  const handleVote = () => {
    if (!user) {
      window.location.href = '/auth/login';
      return;
    }
    toggle.mutate();
  };

  if (isLoading) {
    return (
      <>
        <Header />
        <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">Loading profile...</div>
        <Footer />
      </>
    );
  }

  if (!profile || profile.is_public_contributor === false) {
    return (
      <>
        <Header />
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <h1 className="text-2xl font-heading font-bold">Profile not available</h1>
          <p className="text-muted-foreground">This contributor's profile is private or doesn't exist.</p>
          <Link to="/"><Button>Back to home</Button></Link>
        </div>
        <Footer />
      </>
    );
  }

  const totalContent = courses.length + ebooks.length + workshops.length + papers.length;
  const totalStudents = courses.reduce((s: number, c: any) => s + (c.enrollment_count || 0), 0);
  const avgRating = courses.length
    ? (courses.reduce((s: number, c: any) => s + (c.avg_rating || 0), 0) / courses.filter((c: any) => c.avg_rating).length).toFixed(1)
    : '—';
  const socialLinks: Record<string, string> = (profile.social_links as any) || {};
  const isOwnProfile = user?.id === id;

  return (
    <>
      <SEOHead
        title={`${profile.full_name || 'Contributor'} — Profile`}
        description={profile.headline || profile.bio || `View ${profile.full_name}'s courses, ebooks, and workshops`}
        ogImage={profile.avatar_url || undefined}
      />
      <Header />
      <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary/10 via-background to-accent/5 border-b">
          <div className="container max-w-6xl mx-auto px-4 py-8 sm:py-12">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <Avatar className="h-28 w-28 sm:h-36 sm:w-36 border-4 border-background shadow-xl">
                <AvatarImage src={profile.avatar_url || ''} alt={profile.full_name || ''} />
                <AvatarFallback className="text-3xl">{(profile.full_name || '?')[0]}</AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-3">
                <div>
                  <h1 className="font-heading text-3xl sm:text-4xl font-bold">{profile.full_name || 'Unnamed contributor'}</h1>
                  {profile.headline && <p className="text-lg text-muted-foreground mt-1">{profile.headline}</p>}
                </div>

                {profile.expertise && profile.expertise.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {profile.expertise.slice(0, 6).map((e: string, i: number) => (
                      <Badge key={i} variant="secondary">{e}</Badge>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    onClick={handleVote}
                    disabled={isOwnProfile || toggle.isPending}
                    variant={hasVoted ? 'default' : 'outline'}
                    className="gap-2"
                  >
                    <ThumbsUp className={`h-4 w-4 ${hasVoted ? 'fill-current' : ''}`} />
                    {isOwnProfile ? `${profile.vote_count} Endorsements` : hasVoted ? `Endorsed (${profile.vote_count})` : `Endorse (${profile.vote_count})`}
                  </Button>

                  {Object.entries(socialLinks).map(([k, v]) => v && (
                    <a key={k} href={v} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-background border hover:bg-accent transition">
                      <SocialIcon kind={k} />
                    </a>
                  ))}
                </div>

                {endorsers.length > 0 && (
                  <div className="flex items-center gap-2 pt-2">
                    <div className="flex -space-x-2">
                      {endorsers.map((e: any) => (
                        <Link key={e.id} to={`/contributor/${e.id}`} title={e.full_name || ''}>
                          <Avatar className="h-7 w-7 border-2 border-background hover:scale-110 transition">
                            <AvatarImage src={e.avatar_url || ''} alt={e.full_name || ''} />
                            <AvatarFallback className="text-[10px]">{(e.full_name || '?')[0]}</AvatarFallback>
                          </Avatar>
                        </Link>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">Recently endorsed by</span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
              <Card><CardContent className="p-4 text-center"><BookOpen className="h-5 w-5 mx-auto text-primary mb-1" /><p className="text-2xl font-bold">{totalContent}</p><p className="text-xs text-muted-foreground">Total Works</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><Users className="h-5 w-5 mx-auto text-primary mb-1" /><p className="text-2xl font-bold">{totalStudents.toLocaleString()}</p><p className="text-xs text-muted-foreground">Students</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><Star className="h-5 w-5 mx-auto text-primary mb-1" /><p className="text-2xl font-bold">{avgRating}</p><p className="text-xs text-muted-foreground">Avg Rating</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><ThumbsUp className="h-5 w-5 mx-auto text-primary mb-1" /><p className="text-2xl font-bold">{profile.vote_count}</p><p className="text-xs text-muted-foreground">Endorsements</p></CardContent></Card>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <section className="container max-w-6xl mx-auto px-4 py-8">
          <Tabs defaultValue="about">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="about">About</TabsTrigger>
              <TabsTrigger value="courses">Courses ({courses.length})</TabsTrigger>
              <TabsTrigger value="ebooks">eBooks ({ebooks.length})</TabsTrigger>
              <TabsTrigger value="workshops">Workshops ({workshops.length})</TabsTrigger>
              {papers.length > 0 && <TabsTrigger value="research">Research ({papers.length})</TabsTrigger>}
            </TabsList>

            <TabsContent value="about" className="pt-6">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <h2 className="font-heading text-xl font-semibold">Biography</h2>
                  <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                    {profile.bio || 'This contributor has not added a biography yet.'}
                  </p>
                  {profile.expertise && profile.expertise.length > 0 && (
                    <>
                      <h3 className="font-heading text-lg font-semibold pt-4">Areas of Expertise</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.expertise.map((e: string, i: number) => <Badge key={i} variant="outline">{e}</Badge>)}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="courses" className="pt-6">
              {courses.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">No published courses yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courses.map((c: any) => (
                    <Link key={c.id} to={`/courses/${c.slug}`}>
                      <Card className="overflow-hidden hover:shadow-lg transition group">
                        <div className="aspect-video bg-muted overflow-hidden">
                          <img src={c.thumbnail_url || '/placeholder.svg'} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy" />
                        </div>
                        <CardContent className="p-4 space-y-2">
                          <h3 className="font-medium line-clamp-2 group-hover:text-primary">{c.title}</h3>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {c.avg_rating?.toFixed(1) || 'New'}</span>
                            <span>{c.enrollment_count || 0} students</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="ebooks" className="pt-6">
              {ebooks.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">No published ebooks yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {ebooks.map((e: any) => (
                    <Link key={e.id} to={`/ebooks/${e.slug}`}>
                      <Card className="overflow-hidden hover:shadow-lg transition group">
                        <div className="aspect-[3/4] bg-muted overflow-hidden">
                          <img src={e.cover_url || '/placeholder.svg'} alt={e.title} className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy" />
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary">{e.title}</h3>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="workshops" className="pt-6">
              {workshops.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">No published workshops yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {workshops.map((w: any) => (
                    <Link key={w.id} to={`/workshops/${w.slug}`}>
                      <Card className="overflow-hidden hover:shadow-lg transition group">
                        <div className="aspect-video bg-muted overflow-hidden">
                          <img src={w.thumbnail_url || '/placeholder.svg'} alt={w.title} className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy" />
                        </div>
                        <CardContent className="p-4 space-y-2">
                          <h3 className="font-medium line-clamp-2 group-hover:text-primary">{w.title}</h3>
                          {w.start_date && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {new Date(w.start_date).toLocaleDateString()}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            {papers.length > 0 && (
              <TabsContent value="research" className="pt-6">
                <div className="space-y-3">
                  {papers.map((p: any) => (
                    <Card key={p.id}>
                      <CardContent className="p-4 flex gap-3">
                        <FileText className="h-6 w-6 text-primary shrink-0" />
                        <div className="flex-1">
                          <h3 className="font-medium">{p.title}</h3>
                          {p.abstract && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{p.abstract}</p>}
                          <div className="flex gap-3 text-xs text-muted-foreground mt-2">
                            <span>{p.view_count || 0} views</span>
                            <span>{p.download_count || 0} downloads</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default ContributorProfile;
