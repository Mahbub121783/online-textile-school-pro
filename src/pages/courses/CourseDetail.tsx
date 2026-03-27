import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsEnrolled, useLessonProgress } from '@/hooks/useEnrollments';
import { Star, Clock, Users, Play, Lock, ChevronDown, ChevronUp, ShoppingCart, Award, Smartphone, Download, RotateCcw, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useCartStore } from '@/stores/cartStore';
import { format } from 'date-fns';
import SEOHead from '@/components/SEOHead';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';

const CourseDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expandedSections, setExpandedSections] = useState<number[]>([0]);
  const addItem = useCartStore((s) => s.addItem);

  // Fetch course
  const { data: course, isLoading } = useQuery({
    queryKey: ['course-detail', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*, categories(name), user_profiles!courses_instructor_id_fkey(id, full_name, avatar_url)')
        .eq('slug', slug!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Fetch sections with lessons
  const { data: sections = [] } = useQuery({
    queryKey: ['course-sections', course?.id],
    enabled: !!course?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('course_sections')
        .select('*, lessons(*)')
        .eq('course_id', course!.id)
        .order('sort_order');
      return (data ?? []).map((s: any) => ({
        ...s,
        lessons: (s.lessons ?? []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      }));
    },
  });

  // Fetch reviews
  const { data: reviews = [] } = useQuery({
    queryKey: ['course-reviews', course?.id],
    enabled: !!course?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('reviews')
        .select('*, user_profiles!reviews_user_id_fkey(full_name, avatar_url)')
        .eq('course_id', course!.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  // Q&A count
  const { data: qaCount = 0 } = useQuery({
    queryKey: ['course-qa-count', course?.id],
    enabled: !!course?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from('discussions')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', course!.id)
        .is('parent_id', null);
      return count ?? 0;
    },
  });

  const { data: isEnrolled } = useIsEnrolled(course?.id);
  const { data: progressData = [] } = useLessonProgress(course?.id);

  // Check if user has a pending order for this course (to prevent re-purchase)
  const { data: hasPendingOrder } = useQuery({
    queryKey: ['course-pending-order', course?.id, user?.id],
    enabled: !!course?.id && !!user && !isEnrolled,
    queryFn: async () => {
      const { data } = await supabase
        .from('order_items')
        .select('id, orders!inner(user_id, status)')
        .eq('item_type', 'course')
        .eq('item_id', course!.id)
        .eq('orders.user_id', user!.id)
        .in('orders.status', ['pending', 'completed'])
        .limit(1);
      return (data?.length ?? 0) > 0;
    },
  });

  const allLessons = useMemo(() => sections.flatMap((s: any) => s.lessons), [sections]);
  const totalLessons = allLessons.length;
  const totalDuration = allLessons.reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
  const completedIds = new Set(progressData.filter((p: any) => p.completed).map((p: any) => p.lesson_id));

  // Find next uncompleted lesson for "Continue Learning"
  const nextLesson = useMemo(() => {
    if (!isEnrolled) return null;
    return allLessons.find((l: any) => !completedIds.has(l.id)) || allLessons[0];
  }, [allLessons, completedIds, isEnrolled]);

  const toggleSection = (i: number) => {
    setExpandedSections((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  };

  const finalPrice = course?.discount_price ?? course?.price ?? 0;
  const originalPrice = course?.price ?? 0;
  const discount = course?.discount_price && originalPrice > 0 ? Math.round((1 - course.discount_price / originalPrice) * 100) : 0;
  const instructor = course?.user_profiles as any;
  const category = (course?.categories as any)?.name;

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <UtilityBar />
        <Header />
        <main className="flex-1 pb-14 lg:pb-0">
          <div className="bg-primary py-8 md:py-12">
            <div className="container space-y-4">
              <Skeleton className="h-6 w-48 bg-primary-foreground/10" />
              <Skeleton className="h-10 w-96 bg-primary-foreground/10" />
              <Skeleton className="h-5 w-72 bg-primary-foreground/10" />
            </div>
          </div>
          <div className="container py-6 flex flex-col lg:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <Skeleton className="aspect-video w-full rounded-xl" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
            <div className="lg:w-80"><Skeleton className="h-80 w-full rounded-xl" /></div>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col">
        <UtilityBar /><Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-bold mb-2">Course Not Found</h2>
            <p className="text-muted-foreground mb-4">The course you're looking for doesn't exist.</p>
            <Button onClick={() => navigate('/courses')}>Browse Courses</Button>
          </div>
        </main>
        <Footer /><BottomNav />
      </div>
    );
  }

  const durationStr = totalDuration >= 60 ? `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m` : `${totalDuration}m`;

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead
        title={course.meta_title || course.title}
        description={course.meta_description || course.short_description || ''}
        jsonLd={{
          '@context': 'https://schema.org', '@type': 'Course',
          name: course.title,
          description: course.short_description || course.description || '',
          provider: { '@type': 'EducationalOrganization', name: 'Online Textile School' },
          instructor: { '@type': 'Person', name: instructor?.full_name || 'Instructor' },
          aggregateRating: reviews.length > 0 ? { '@type': 'AggregateRating', ratingValue: course.avg_rating, reviewCount: reviews.length, bestRating: 5 } : undefined,
          offers: { '@type': 'Offer', price: finalPrice, priceCurrency: 'BDT', availability: 'https://schema.org/InStock' },
          courseMode: 'Online', inLanguage: course.language || 'en',
        }}
      />
      <UtilityBar />
      <Header />
      <main className="flex-1 pb-14 lg:pb-0">
        {/* Hero */}
        <div className="bg-primary text-primary-foreground py-8 md:py-12">
          <div className="container">
            <div className="flex items-center gap-2 text-sm text-primary-foreground/60 mb-4">
              <Link to="/" className="hover:text-primary-foreground">Home</Link> /
              <Link to="/courses" className="hover:text-primary-foreground">Courses</Link> /
              {category && <span>{category}</span>}
            </div>
            <div className="max-w-3xl">
              <Badge className="mb-3 bg-accent text-accent-foreground">{course.difficulty_level || 'Beginner'}</Badge>
              <h1 className="font-heading text-2xl md:text-4xl font-bold mb-4">{course.title}</h1>
              <p className="text-primary-foreground/80 mb-4">{course.short_description}</p>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {(course.avg_rating ?? 0) > 0 && (
                  <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-warning text-warning" />{Number(course.avg_rating).toFixed(1)} ({reviews.length} reviews)</span>
                )}
                <span className="flex items-center gap-1"><Users className="h-4 w-4" />{course.enrollment_count || 0} students</span>
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{durationStr}</span>
              </div>
              <p className="text-sm text-primary-foreground/60 mt-2">
                By {instructor?.full_name || 'Instructor'} • Last updated {course.updated_at ? format(new Date(course.updated_at), 'MMMM yyyy') : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="container py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Content */}
            <div className="flex-1">
              {/* Intro Video */}
              {course.intro_video_url ? (
                <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6">
                  <iframe
                    src={(() => {
                      const url = course.intro_video_url!;
                      const ytMatch = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                      if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
                      const vmMatch = url.match(/vimeo\.com\/(\d+)/);
                      if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;
                      return url;
                    })()}
                    className="w-full h-full"
                    allowFullScreen
                    allow="autoplay; encrypted-media"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl flex items-center justify-center mb-6 border">
                  <div className="bg-accent rounded-full p-4"><Play className="h-8 w-8 text-accent-foreground fill-accent-foreground" /></div>
                </div>
              )}

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 gap-0">
                  {['overview', 'curriculum', 'instructor', 'reviews'].map((tab) => (
                    <TabsTrigger key={tab} value={tab} className="capitalize rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">
                      {tab === 'reviews' ? `Reviews (${reviews.length})` : tab}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="overview" className="pt-6 space-y-6">
                  {course.description && (
                    <div>
                      <h2 className="font-heading text-xl font-bold mb-4">About This Course</h2>
                      <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{course.description}</div>
                    </div>
                  )}
                  {qaCount > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MessageSquare className="h-4 w-4" />
                      {qaCount} Q&A discussions in this course
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="curriculum" className="pt-6">
                  <h2 className="font-heading text-xl font-bold mb-4">Course Curriculum</h2>
                  <p className="text-sm text-muted-foreground mb-4">{sections.length} sections • {totalLessons} lessons • {durationStr} total</p>
                  <div className="space-y-2">
                    {sections.map((section: any, i: number) => (
                      <div key={section.id} className="border rounded-lg overflow-hidden">
                        <button onClick={() => toggleSection(i)} className="w-full flex items-center justify-between p-4 bg-secondary/50 hover:bg-secondary transition-colors text-left">
                          <div>
                            <span className="font-heading font-semibold text-sm">{section.title}</span>
                            <span className="text-xs text-muted-foreground ml-2">({section.lessons.length} lessons)</span>
                          </div>
                          {expandedSections.includes(i) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        {expandedSections.includes(i) && (
                          <div className="divide-y">
                            {section.lessons.map((lesson: any) => {
                              const done = completedIds.has(lesson.id);
                              return (
                                <div key={lesson.id} className="flex items-center justify-between p-3 px-4 text-sm hover:bg-muted/30">
                                  <div className="flex items-center gap-3">
                                    {lesson.is_preview ? (
                                      <Play className="h-4 w-4 text-primary" />
                                    ) : done ? (
                                      <Award className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <Lock className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <span className={lesson.is_preview ? 'text-primary cursor-pointer hover:underline' : done ? 'text-green-700' : ''}>
                                      {lesson.title}
                                    </span>
                                    {lesson.is_preview && <Badge variant="outline" className="text-xs">Preview</Badge>}
                                    {done && <Badge variant="outline" className="text-xs text-green-600 border-green-600">Done</Badge>}
                                  </div>
                                  <span className="text-xs text-muted-foreground">{lesson.duration_minutes ? `${lesson.duration_minutes} min` : ''}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="instructor" className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-heading font-bold text-xl shrink-0 overflow-hidden">
                      {instructor?.avatar_url ? (
                        <img src={instructor.avatar_url} alt={instructor.full_name} className="w-full h-full object-cover" />
                      ) : (
                        instructor?.full_name?.[0]?.toUpperCase() || 'I'
                      )}
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-lg">{instructor?.full_name || 'Instructor'}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span><Users className="h-3 w-3 inline mr-1" />{course.enrollment_count || 0} Students</span>
                        {(course.avg_rating ?? 0) > 0 && <span><Star className="h-3 w-3 inline mr-1" />{Number(course.avg_rating).toFixed(1)} Rating</span>}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="reviews" className="pt-6">
                  {reviews.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Star className="h-12 w-12 mx-auto mb-3 text-muted" />
                      <p>No reviews yet. Be the first to review this course!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reviews.map((review: any) => (
                        <div key={review.id} className="border rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                              {review.user_profiles?.full_name?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{review.user_profiles?.full_name || 'Student'}</p>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star key={i} className={`h-3 w-3 ${i < review.rating ? 'fill-warning text-warning' : 'text-muted'}`} />
                                ))}
                                <span className="text-xs text-muted-foreground ml-1">{format(new Date(review.created_at), 'MMM dd, yyyy')}</span>
                              </div>
                            </div>
                          </div>
                          {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Sticky Purchase Card — hidden on mobile when enrolled (fixed bar handles it) */}
            <div className={`lg:w-80 shrink-0 ${isEnrolled ? 'hidden lg:block' : ''}`}>
              <div className="sticky top-20 bg-card border rounded-xl p-6 shadow-lg space-y-4">
                {isEnrolled ? (
                  <>
                    <div className="text-center space-y-1">
                      <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-full text-sm font-semibold">
                        <Award className="h-4 w-4" /> Enrolled
                      </div>
                    </div>

                    <Button
                      className="w-full h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base"
                      onClick={() => {
                        if (nextLesson) navigate(`/learn/${course.slug}/${nextLesson.id}`);
                        else navigate(`/courses/${course.slug}`);
                      }}
                    >
                      <Play className="h-5 w-5 mr-2" />
                      {completedIds.size > 0 ? 'Continue Learning' : 'Start Learning'}
                    </Button>

                    <div>
                      <div className="flex justify-between mb-1.5 text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold text-foreground">{allLessons.length > 0 ? Math.round((completedIds.size / allLessons.length) * 100) : 0}%</span>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${allLessons.length > 0 ? (completedIds.size / allLessons.length) * 100 : 0}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">{completedIds.size} / {allLessons.length} lessons completed</p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Not enrolled — show price */}
                    {originalPrice > 0 ? (
                      <div className="flex items-end gap-2">
                        <span className="font-heading text-3xl font-bold text-foreground">৳{Number(finalPrice).toLocaleString()}</span>
                        {discount > 0 && (
                          <>
                            <span className="text-lg text-muted-foreground line-through">৳{Number(originalPrice).toLocaleString()}</span>
                            <Badge className="bg-accent text-accent-foreground">{discount}% off</Badge>
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="font-heading text-3xl font-bold text-green-600">Free</span>
                    )}

                    {hasPendingOrder ? (
                      <div className="space-y-2">
                        <Button className="w-full h-12" variant="secondary" disabled>
                          <Clock className="h-4 w-4 mr-2" /> Order Pending Verification
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">Your purchase is being verified by admin.</p>
                      </div>
                    ) : (
                      <>
                        <Button className="w-full h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold" onClick={() => addItem({ id: course.id, type: 'course', title: course.title, price: originalPrice, discount_price: course.discount_price ?? undefined })}>
                          <ShoppingCart className="h-4 w-4 mr-2" />{originalPrice > 0 ? 'Add to Cart' : 'Enroll Free'}
                        </Button>
                        {originalPrice > 0 && <Button variant="outline" className="w-full h-12">Buy Now</Button>}
                      </>
                    )}
                  </>
                )}

                <div className="text-xs text-muted-foreground space-y-2 pt-2 border-t">
                  <p className="font-semibold text-foreground text-sm">This course includes:</p>
                  <p className="flex items-center gap-2"><Clock className="h-3 w-3" /> {durationStr} of content</p>
                  <p className="flex items-center gap-2"><Play className="h-3 w-3" /> {totalLessons} lessons</p>
                  <p className="flex items-center gap-2"><Award className="h-3 w-3" /> Certificate on completion</p>
                  <p className="flex items-center gap-2"><Smartphone className="h-3 w-3" /> Access on mobile and desktop</p>
                  <p className="flex items-center gap-2"><Download className="h-3 w-3" /> Downloadable resources</p>
                  <p className="flex items-center gap-2"><RotateCcw className="h-3 w-3" /> Full lifetime access</p>
                </div>

                {!isEnrolled && course.discount_ends_at && new Date(course.discount_ends_at) > new Date() && (
                  <div className="text-xs text-center text-destructive font-medium">
                    ⏰ Offer ends {format(new Date(course.discount_ends_at), 'MMM dd, yyyy')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      {/* Fixed mobile action bar for enrolled users */}
      {isEnrolled && (
        <div className="fixed bottom-14 left-0 right-0 z-40 lg:hidden bg-card border-t shadow-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">{completedIds.size}/{allLessons.length} lessons done</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                <div className="h-full bg-primary rounded-full" style={{ width: `${allLessons.length > 0 ? (completedIds.size / allLessons.length) * 100 : 0}%` }} />
              </div>
            </div>
            <Button
              className="shrink-0 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
              onClick={() => {
                if (nextLesson) navigate(`/learn/${course.slug}/${nextLesson.id}`);
              }}
            >
              <Play className="h-4 w-4 mr-1" />
              {completedIds.size > 0 ? 'Continue' : 'Start'}
            </Button>
          </div>
        </div>
      )}
      <Footer />
      <BottomNav />
    </div>
  );
};

export default CourseDetail;
