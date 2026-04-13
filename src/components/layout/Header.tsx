import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Menu, X, ChevronDown, User, LogOut, GraduationCap, Shield } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useCartStore } from '@/stores/cartStore';
import NotificationBell from '@/components/layout/NotificationBell';
import { COURSE_CATEGORIES } from '@/lib/constants';
import OTSLogo from '@/assets/OTS_LOGO.png';

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const { user, roles, signOut } = useAuth();
  const itemCount = useCartStore((s) => s.getItemCount());
  const navigate = useNavigate();

  const isInstructor = roles.includes('instructor') || roles.includes('admin') || roles.includes('super_admin');
  const isAdmin = roles.includes('admin') || roles.includes('super_admin');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Courses', href: '/courses', hasMega: true },
    { label: 'Learning Paths', href: '/learning-paths' },
    { label: 'eBooks', href: '/ebooks' },
    { label: 'Departments', href: '/departments' },
    { label: 'Events', href: '/events' },
    { label: 'Blog', href: '/blog' },
    { label: 'Forum', href: '/forum' },
    { label: 'Registration', href: '/register' },
    { label: 'About', href: '/about' },
  ];

  return (
    <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${scrolled ? 'bg-background/95 backdrop-blur-md shadow-md' : 'bg-background'}`}>
      <div className="container flex items-center justify-between h-16 md:h-[72px]">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src={OTSLogo} alt="Online Textile School" className="h-10 w-10 md:h-12 md:w-12 object-contain" />
          <span className="hidden sm:block font-heading font-bold text-lg text-primary">
            Online Textile<br className="hidden lg:block" /> School
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <div key={link.label} className="relative" onMouseEnter={() => link.hasMega && setMegaMenuOpen(true)} onMouseLeave={() => link.hasMega && setMegaMenuOpen(false)}>
              <Link
                to={link.href}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors rounded-md hover:bg-secondary"
              >
                {link.label}
                {link.hasMega && <ChevronDown className="h-3 w-3" />}
              </Link>
              {link.hasMega && megaMenuOpen && (
                <div className="absolute top-full left-0 w-[500px] bg-background border rounded-lg shadow-xl p-4 grid grid-cols-2 gap-2 animate-fade-in">
                  {COURSE_CATEGORIES.map((cat) => (
                    <Link
                      key={cat.slug}
                      to={`/courses?category=${cat.slug}`}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary transition-colors text-sm"
                      onClick={() => setMegaMenuOpen(false)}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center">
            {searchOpen ? (
              <div className="flex items-center gap-1 animate-slide-in">
                <Input placeholder="Search courses..." className="w-48 h-9 text-sm" autoFocus onBlur={() => setSearchOpen(false)} />
                <Button variant="ghost" size="icon" onClick={() => setSearchOpen(false)}><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)}><Search className="h-4 w-4" /></Button>
            )}
          </div>

         <LanguageToggle />
         <ThemeToggle />

          {user && <NotificationBell basePath="/dashboard" />}

          <Link to="/cart" className="relative">
            <Button variant="ghost" size="icon">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold">
                  {itemCount}
                </span>
              )}
            </Button>
          </Link>

          {user ? (
            <div className="hidden md:flex items-center gap-1">
              {isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
                  <Shield className="h-4 w-4 mr-1" />
                  Admin
                </Button>
              )}
              {isInstructor && (
                <Button variant="ghost" size="sm" onClick={() => navigate('/instructor')}>
                  <GraduationCap className="h-4 w-4 mr-1" />
                  Instructor
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                <User className="h-4 w-4 mr-1" />
                Dashboard
              </Button>
              <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/auth/login')}>Login</Button>
              <Button size="sm" className="bg-accent hover:bg-accent-hover text-accent-foreground" onClick={() => navigate('/auth/register')}>Register</Button>
            </div>
          )}

          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t bg-background animate-fade-in">
          <div className="container py-4 space-y-2">
            <Input placeholder="Search courses..." className="mb-3" />
            {navLinks.map((link) => (
              <Link key={link.label} to={link.href} className="block px-3 py-2.5 text-sm font-medium rounded-md hover:bg-secondary" onClick={() => setMobileMenuOpen(false)}>
                {link.label}
              </Link>
            ))}
            <div className="border-t pt-3 mt-3 space-y-2">
              {user ? (
                <>
                  {isAdmin && (
                    <Button variant="outline" className="w-full" onClick={() => { navigate('/admin'); setMobileMenuOpen(false); }}>
                      <Shield className="h-4 w-4 mr-2" /> Admin Panel
                    </Button>
                  )}
                  {isInstructor && (
                    <Button variant="outline" className="w-full" onClick={() => { navigate('/instructor'); setMobileMenuOpen(false); }}>
                      <GraduationCap className="h-4 w-4 mr-2" /> Instructor Portal
                    </Button>
                  )}
                  <Button variant="outline" className="w-full" onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }}>Dashboard</Button>
                  <Button variant="ghost" className="w-full" onClick={() => { signOut(); setMobileMenuOpen(false); }}>Sign Out</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="w-full" onClick={() => { navigate('/auth/login'); setMobileMenuOpen(false); }}>Login</Button>
                  <Button className="w-full bg-accent hover:bg-accent-hover text-accent-foreground" onClick={() => { navigate('/auth/register'); setMobileMenuOpen(false); }}>Register</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
