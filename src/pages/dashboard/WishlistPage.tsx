import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCartStore } from '@/stores/cartStore';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const WishlistPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const addItem = useCartStore((s) => s.addItem);

  const { data: wishlistItems = [], isLoading } = useQuery({
    queryKey: ['wishlist', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('wishlists')
        .select('*, courses(id, title, slug, thumbnail_url, price, discount_price, avg_rating, enrollment_count, categories(name))')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const removeWishlist = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('wishlists').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      queryClient.invalidateQueries({ queryKey: ['wishlist-ids'] });
      toast.success('Removed from wishlist');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-heading font-bold">My Wishlist</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Heart className="h-6 w-6 text-destructive fill-destructive" />
        <h1 className="text-2xl font-heading font-bold">My Wishlist</h1>
        <Badge variant="secondary">{wishlistItems.length} courses</Badge>
      </div>

      {wishlistItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Your wishlist is empty</p>
            <Button asChild className="mt-4"><Link to="/courses">Browse Courses</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {wishlistItems.map((item) => {
            const course = item.courses as any;
            if (!course) return null;
            return (
              <Card key={item.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
                <Link to={`/courses/${course.slug}`}>
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">No Image</div>
                    )}
                    {course.categories?.name && (
                      <Badge className="absolute top-2 left-2" variant="secondary">{course.categories.name}</Badge>
                    )}
                  </div>
                </Link>
                <CardContent className="p-4 space-y-3">
                  <Link to={`/courses/${course.slug}`}>
                    <h3 className="font-heading font-semibold line-clamp-2 hover:text-primary transition-colors">{course.title}</h3>
                  </Link>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {course.discount_price ? (
                        <>
                          <span className="font-bold text-primary">৳{course.discount_price}</span>
                          <span className="text-sm text-muted-foreground line-through">৳{course.price}</span>
                        </>
                      ) : (
                        <span className="font-bold text-primary">{course.price === 0 ? 'Free' : `৳${course.price}`}</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeWishlist.mutate(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => {
                        addItem({ id: course.id, title: course.title, price: course.price ?? 0, discount_price: course.discount_price ?? undefined, type: 'course', thumbnail_url: course.thumbnail_url ?? undefined });
                        toast.success('Added to cart');
                      }}>
                        <ShoppingCart className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WishlistPage;
