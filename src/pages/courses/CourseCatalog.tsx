import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWishlist } from '@/hooks/useWishlist';
import { Search, Star, Clock, Users, ShoppingCart, SlidersHorizontal, X, Play, CheckCircle, ChevronLeft, ChevronRight, Heart, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useCartStore } from '@/stores/cartStore';
import { DIFFICULTY_LEVELS } from '@/lib/constants';
import SEOHead from '@/components/SEOHead';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';

const PER_PAGE = 12;

const CourseCatalog = () => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const addItem = useCartStore((s) => s.addItem);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { wishlistIds, toggleWishlist } = useWishlist();

  const { data: dbCategories = [] } = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('id, name, slug').order('sort_order');
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['catalog-courses'],
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('id, title, slug, price, discount_price, avg_rating, enrollment_count, total_duration_minutes, total_lessons, difficulty_level, thumbnail_url, category_id, categories(name), user_profiles!courses_instructor_id_fkey(full_name), created_at')
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: enrolledCourseIds = new Set<string>() } = useQuery({
    queryKey: ['user-enrollments-set', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('enrollments').select('course_id').eq('user_id', user!.id);
      return new Set((data ?? []).map((e) => e.course_id));
    },
  });

  const sortedFiltered = useMemo(() => {
    let result = courses.filter((c) => {
      const catName = (c.categories as any)?.name || '';
      if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedCategory && catName !== selectedCategory) return false;
      if (selectedDifficulty && c.difficulty_level !== selectedDifficulty.toLowerCase()) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime();
        case 'rating': return (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0);
        case 'price-low': return ((a.discount_price ?? a.price) || 0) - ((b.discount_price ?? b.price) || 0);
        case 'price-high': return ((b.discount_price ?? b.price) || 0) - ((a.discount_price ?? a.price) || 0);
        case 'popular':
        default: return (b.enrollment_count || 0) - (a.enrollment_count || 0);
      }
    });

    return result;
  }, [courses, search, selectedCategory, selectedDifficulty, sortBy]);

  const totalPages = Math.ceil(sortedFiltered.length / PER_PAGE);
  const paginatedCourses = sortedFiltered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const updateFilter = (setter: (v: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  const FilterSidebar = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-heading font-semibold text-sm mb-3">Category</h3>
        <div className="space-y-2">
          {dbCategories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2">
              <Checkbox id={`cat-${cat.id}`} checked={selectedCategory === cat.name} onCheckedChange={() => updateFilter(setSelectedCategory, selectedCategory === cat.name ? '' : cat.name)} />
              <Label htmlFor={`cat-${cat.id}`} className="text-sm cursor-pointer">{cat.name}</Label>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-heading font-semibold text-sm mb-3">Difficulty</h3>
        <div className="space-y-2">
          {DIFFICULTY_LEVELS.map((level) => (
            <div key={level} className="flex items-center gap-2">
              <Checkbox id={level} checked={selectedDifficulty === level} onCheckedChange={() => updateFilter(setSelectedDifficulty, selectedDifficulty === level ? '' : level)} />
              <Label htmlFor={level} className="text-sm cursor-pointer">{level}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead
        title="Course Catalog"
        description="Browse textile engineering courses in Spinning, Weaving, Dyeing, Knitting, Garments Technology and more. Learn online from industry experts."
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Courses', url: '/courses' },
        ]}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Textile Engineering Courses',
          description: 'Browse all textile engineering courses available at Online Textile School',
          url: 'https://onlinetextileschool.com/courses',
          numberOfItems: courses.length,
          itemListElement: courses.slice(0, 10).map((c: any, i: number) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `https://onlinetextileschool.com/courses/${c.slug}`,
            name: c.title,
          })),
        }}
      />
      <UtilityBar />
      <Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <div className="bg-secondary py-4">
          <div className="container">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-primary">Home</Link>
              <span>/</span>
              <span className="text-foreground">Courses</span>
            </div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mt-2">Course Catalog</h1>
          </div>
        </div>

        <div className="container py-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search courses..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="lg:hidden" onClick={() => setFiltersOpen(!filtersOpen)}>
                <SlidersHorizontal className="h-4 w-4 mr-1" />Filters
              </Button>
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">Most Popular</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-6">
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-20 bg-card border rounded-lg p-4">
                <FilterSidebar />
              </div>
            </aside>

            {filtersOpen && (
              <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden" onClick={() => setFiltersOpen(false)}>
                <div className="absolute right-0 top-0 h-full w-80 bg-card border-l p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-heading font-bold">Filters</h2>
                    <Button variant="ghost" size="icon" onClick={() => setFiltersOpen(false)}><X className="h-4 w-4" /></Button>
                  </div>
                  <FilterSidebar />
                </div>
              </div>
            )}

            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-4">{sortedFiltered.length} courses found</p>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-72 rounded-lg" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {paginatedCourses.map((course) => {
                      const finalPrice = course.discount_price ?? course.price ?? 0;
                      const isEnrolled = enrolledCourseIds instanceof Set && enrolledCourseIds.has(course.id);
                      const catName = (course.categories as any)?.name || '';
                      const instructorName = (course.user_profiles as any)?.full_name || 'Instructor';
                      const dur = course.total_duration_minutes || 0;
                      const durationStr = dur >= 60 ? `${Math.floor(dur / 60)}h ${dur % 60}m` : `${dur}m`;
                      const isWished = wishlistIds instanceof Set && wishlistIds.has(course.id);

                      return (
                        <div key={course.id} className="group bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1">
                          <div className="relative aspect-video bg-secondary overflow-hidden cursor-pointer" onClick={() => navigate(`/courses/${course.slug}`)}>
                            {course.thumbnail_url ? (
                              <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            ) : (
                              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"><span className="text-3xl opacity-30">📚</span></div>
                            )}
                            {isEnrolled && (
                              <Badge className="absolute top-2 left-2 text-xs bg-green-600 text-white border-0">
                                <CheckCircle className="h-3 w-3 mr-1" /> Enrolled
                              </Badge>
                            )}
                            {!isEnrolled && finalPrice === 0 && (
                              <Badge className="absolute top-2 left-2 text-xs bg-primary text-primary-foreground">Free</Badge>
                            )}
                            {/* Wishlist heart */}
                            {user && (
                              <button
                                className="absolute top-2 right-2 p-1.5 rounded-full bg-background/70 hover:bg-background transition-colors"
                                onClick={(e) => { e.stopPropagation(); toggleWishlist(course.id); }}
                              >
                                <Heart className={`h-4 w-4 ${isWished ? 'fill-destructive text-destructive' : 'text-muted-foreground'}`} />
                              </button>
                            )}
                          </div>
                          <div className="p-4 space-y-2">
                            <p className="text-xs text-muted-foreground">{catName}</p>
                            <Link to={`/courses/${course.slug}`}><h3 className="font-heading font-semibold text-sm line-clamp-2 hover:text-primary">{course.title}</h3></Link>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {(Number(course.avg_rating) ?? 0) > 0 && <><Star className="h-3 w-3 fill-warning text-warning" />{Number(course.avg_rating).toFixed(1)} •</>}
                              <Users className="h-3 w-3" />{course.enrollment_count || 0} •
                              <Clock className="h-3 w-3" />{durationStr}
                            </div>
                            <p className="text-xs text-muted-foreground">by {instructorName}</p>
                            <div className="flex items-center justify-between pt-2 border-t">
                              {isEnrolled ? (
                                <>
                                  <span className="text-xs text-green-600 font-semibold">✓ Purchased</span>
                                  <Button size="sm" className="h-8 text-xs bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => navigate(`/courses/${course.slug}`)}>
                                    <Play className="h-3 w-3 mr-1" />Continue
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <div>
                                    <span className="font-heading font-bold">{finalPrice === 0 ? 'Free' : `৳${Number(finalPrice).toLocaleString()}`}</span>
                                    {course.discount_price && <span className="text-xs text-muted-foreground line-through ml-2">৳{Number(course.price).toLocaleString()}</span>}
                                  </div>
                                  <div className="flex gap-1">
                                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addItem({ id: course.id, type: 'course', title: course.title, price: course.price || 0, discount_price: course.discount_price ?? undefined, thumbnail_url: course.thumbnail_url ?? undefined })}>
                                      <ShoppingCart className="h-3 w-3 mr-1" />Add
                                    </Button>
                                    <Button size="sm" className="h-8 text-xs" onClick={() => {
                                      addItem({ id: course.id, type: 'course', title: course.title, price: course.price || 0, discount_price: course.discount_price ?? undefined, thumbnail_url: course.thumbnail_url ?? undefined });
                                      navigate('/checkout');
                                    }}>
                                      <Zap className="h-3 w-3 mr-1" />Buy
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                        .reduce<(number | string)[]>((acc, p, i, arr) => {
                          if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, i) =>
                          typeof p === 'string' ? (
                            <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">…</span>
                          ) : (
                            <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" onClick={() => setPage(p)}>
                              {p}
                            </Button>
                          )
                        )}
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default CourseCatalog;
