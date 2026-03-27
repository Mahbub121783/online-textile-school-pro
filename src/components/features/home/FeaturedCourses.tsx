import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Clock, Users, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { COURSE_CATEGORIES } from '@/lib/constants';
import { useCartStore } from '@/stores/cartStore';

const MOCK_COURSES = [
  { id: '1', title: 'Introduction to Spinning Technology', slug: 'intro-spinning', category: 'Spinning', instructor: 'Dr. Rahman', price: 1500, discount_price: 999, rating: 4.8, students: 234, duration: '12h 30m', thumbnail: '', badge: 'Bestseller', difficulty: 'Beginner' },
  { id: '2', title: 'Advanced Weaving Techniques', slug: 'advanced-weaving', category: 'Weaving', instructor: 'Prof. Karim', price: 2500, discount_price: 1999, rating: 4.6, students: 156, duration: '18h 45m', thumbnail: '', badge: 'New', difficulty: 'Advanced' },
  { id: '3', title: 'Textile Dyeing & Color Chemistry', slug: 'dyeing-color', category: 'Dyeing & Finishing', instructor: 'Dr. Fatema', price: 2000, discount_price: null, rating: 4.9, students: 312, duration: '15h 20m', thumbnail: '', badge: 'Bestseller', difficulty: 'Intermediate' },
  { id: '4', title: 'Knitting Machine Operations', slug: 'knitting-ops', category: 'Knitting', instructor: 'Eng. Hasan', price: 1800, discount_price: 1200, rating: 4.5, students: 89, duration: '10h 15m', thumbnail: '', badge: null, difficulty: 'Beginner' },
  { id: '5', title: 'Garments Quality Control', slug: 'garments-qc', category: 'Quality Control', instructor: 'Mr. Alam', price: 0, discount_price: null, rating: 4.7, students: 567, duration: '8h', thumbnail: '', badge: 'Free', difficulty: 'Beginner' },
  { id: '6', title: 'Textile Merchandising Masterclass', slug: 'merchandising', category: 'Merchandising', instructor: 'Ms. Nusrat', price: 3000, discount_price: 2499, rating: 4.4, students: 123, duration: '20h', thumbnail: '', badge: null, difficulty: 'Intermediate' },
  { id: '7', title: 'Yarn Manufacturing Process', slug: 'yarn-manufacturing', category: 'Yarn Technology', instructor: 'Prof. Islam', price: 1200, discount_price: null, rating: 4.8, students: 198, duration: '14h', thumbnail: '', badge: 'New', difficulty: 'Beginner' },
  { id: '8', title: 'CAD/CAM for Textile Design', slug: 'cad-cam-textile', category: 'CAD/CAM', instructor: 'Dr. Siddique', price: 3500, discount_price: 2999, rating: 4.6, students: 76, duration: '22h', thumbnail: '', badge: null, difficulty: 'Advanced' },
];

const CourseCard = ({ course }: { course: typeof MOCK_COURSES[0] }) => {
  const addItem = useCartStore((s) => s.addItem);
  const finalPrice = course.discount_price ?? course.price;

  return (
    <div className="group bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-secondary">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <span className="text-4xl opacity-30">🧵</span>
        </div>
        {course.badge && (
          <Badge className={`absolute top-2 left-2 text-xs ${course.badge === 'Bestseller' ? 'bg-accent text-accent-foreground' : course.badge === 'Free' ? 'bg-success text-white' : 'bg-primary text-primary-foreground'}`}>
            {course.badge}
          </Badge>
        )}
        <Badge variant="secondary" className="absolute top-2 right-2 text-xs">{course.difficulty}</Badge>
      </div>
      {/* Content */}
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">{course.category}</p>
        <Link to={`/courses/${course.slug}`}>
          <h3 className="font-heading font-semibold text-sm leading-tight line-clamp-2 hover:text-primary transition-colors">{course.title}</h3>
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1"><Star className="h-3 w-3 fill-warning text-warning" />{course.rating}</div>
          <span>•</span>
          <div className="flex items-center gap-1"><Users className="h-3 w-3" />{course.students}</div>
          <span>•</span>
          <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{course.duration}</div>
        </div>
        <p className="text-xs text-muted-foreground">by {course.instructor}</p>
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-foreground">
              {finalPrice === 0 ? 'Free' : `৳${finalPrice.toLocaleString()}`}
            </span>
            {course.discount_price && (
              <span className="text-xs text-muted-foreground line-through">৳{course.price.toLocaleString()}</span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs group-hover:bg-accent group-hover:text-accent-foreground group-hover:border-accent transition-colors"
            onClick={() => addItem({ id: course.id, type: 'course', title: course.title, price: course.price, discount_price: course.discount_price ?? undefined })}
          >
            <ShoppingCart className="h-3 w-3 mr-1" />Add
          </Button>
        </div>
      </div>
    </div>
  );
};

const FeaturedCourses = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const categories = ['All', ...COURSE_CATEGORIES.slice(0, 6).map((c) => c.name)];
  const filtered = activeCategory === 'All' ? MOCK_COURSES : MOCK_COURSES.filter((c) => c.category === activeCategory);

  return (
    <section className="py-12 md:py-16 bg-background">
      <div className="container">
        <div className="text-center mb-8">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">Featured Courses</h2>
          <p className="text-muted-foreground">Build your textile career with expert-led courses</p>
        </div>
        {/* Category tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? 'default' : 'outline'}
              size="sm"
              className={`shrink-0 text-xs ${activeCategory === cat ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
        {/* Course grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {filtered.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
        <div className="text-center mt-8">
          <Button variant="outline" size="lg" asChild>
            <Link to="/courses">View All Courses →</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedCourses;
