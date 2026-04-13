import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Menu, X, ChevronDown, ChevronRight, User, LogOut, GraduationCap, Shield, Heart, TrendingUp } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useCartStore } from '@/stores/cartStore';
import NotificationBell from '@/components/layout/NotificationBell';
import { COURSE_CATEGORIES } from '@/lib/constants';
import OTSLogo from '@/assets/OTS_LOGO.png';

const TRENDING_SEARCHES = [
  'Spinning Technology',
  'Fabric Dyeing',
  'Garments Merchandising',
  'Weaving Calculation',
  'Quality Control',
];

const NAV_ITEMS = [
  { label: 'Find Courses', href: '/courses' },
  { label: 'Get Certified', href: '/learning-paths', hasDropdown: true },
  { label: 'eBooks', href: '/ebooks' },
];

const CERTIFICATION_MENU = [
  {
    heading: 'Learning Paths',
    items: [
      { label: 'Spinning Expert', href: '/learning-paths' },
      { label: 'Weaving Professional', href: '/learning-paths' },
      { label: 'Dyeing & Finishing', href: '/learning-paths' },
    ],
  },
  {
    heading: 'Popular Certifications',
    items: [
      { label: 'Textile Quality Control', href: '/learning-paths' },
      { label: 'Garments Technology', href: '/learning-paths' },
      { label: 'Yarn Manufacturing', href: '/learning-paths' },
      { label: 'Merchandising', href: '/learning-paths' },
    ],
  },
];

const RIGHT_NAV = [
  { label: 'Become Instructor', href: '/become-instructor' },
  { label: 'My Learning', href: '/dashboard/courses', requiresAuth: true },
];

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [certDropdown, setCertDropdown] = useState(false);
  const { user, roles, signOut } = useAuth();
  const itemCount = useCartStore((s) => s.getItemCount());
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);

  const isInstructor = roles.includes('instructor') || roles.includes('admin') || roles.includes('super_admin');
  const isAdmin = roles.includes('admin') || roles.includes('super_admin');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/courses?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchFocused(false);
      setSearchQuery('');
    }
  };

  return (
    <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${scrolled ? 'bg-background/95 backdrop-blur-md shadow-md' : 'bg-background border-b'}`}>
      {/* ===== ROW 1: Main header (desktop/tablet) ===== */}
      <div className="hidden md:block">
        <div className="container flex items-center gap-4 h-[64px]">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={OTSLogo} alt="Online Textile School" className="h-10 w-10 object-contain" />
            <span className="font-heading font-bold text-base lg:text-lg text-primary leading-tight">
              Online Textile<br className="hidden lg:block" /> School
            </span>
          </Link>

          {/* Primary Nav Links */}
          <nav className="hidden lg:flex items-center gap-1 shrink-0">
            {NAV_ITEMS.map((item) => (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => item.hasDropdown && setCertDropdown(true)}
                onMouseLeave={() => item.hasDropdown && setCertDropdown(false)}
              >
                <Link
                  to={item.href}
                  className={`flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors rounded-md hover:text-primary ${certDropdown && item.hasDropdown ? 'text-primary' : 'text-foreground'}`}
                >
                  {item.label}
                  {item.hasDropdown && <ChevronDown className="h-3 w-3" />}
                </Link>

                {/* Certification dropdown */}
                {item.hasDropdown && certDropdown && (
                  <div className="absolute top-full left-0 w-[320px] bg-background border rounded-lg shadow-xl p-4 animate-fade-in z-50">
                    {CERTIFICATION_MENU.map((section) => (
                      <div key={section.heading} className="mb-3 last:mb-0">
                        <p className="text-xs font-bold text-primary mb-1.5 uppercase tracking-wide">{section.heading}</p>
                        {section.items.map((ci) => (
                          <Link
                            key={ci.label}
                            to={ci.href}
                            className="flex items-center justify-between px-2 py-1.5 text-sm rounded-md hover:bg-secondary transition-colors"
                            onClick={() => setCertDropdown(false)}
                          >
                            {ci.label}
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Search Bar */}
          <div ref={searchRef} className="flex-1 max-w-xl relative">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search for anything"
                className="w-full h-10 pl-10 pr-4 rounded-full border-2 border-input bg-background text-sm focus:outline-none focus:border-primary transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
              />
            </form>

            {/* Trending dropdown */}
            {searchFocused && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-xl p-4 z-50 animate-fade-in">
                <p className="text-sm font-bold text-foreground mb-2">Trending</p>
                {TRENDING_SEARCHES.map((term) => (
                  <button
                    key={term}
                    type="button"
                    className="flex items-center gap-2.5 w-full px-2 py-2 text-sm text-foreground hover:bg-secondary rounded-md transition-colors"
                    onClick={() => {
                      setSearchQuery(term);
                      navigate(`/courses?q=${encodeURIComponent(term)}`);
                      setSearchFocused(false);
                    }}
                  >
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    {term}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right side nav */}
          <nav className="hidden lg:flex items-center gap-1 shrink-0">
            {RIGHT_NAV.map((item) => {
              if (item.requiresAuth && !user) return null;
              return (
                <Link key={item.label} to={item.href} className="px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors whitespace-nowrap">
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Action icons */}
          <div className="flex items-center gap-1 shrink-0">
            <LanguageToggle />
            <ThemeToggle />

            {user && (
              <Link to="/dashboard/wishlist">
                <Button variant="ghost" size="icon" className="relative">
                  <Heart className="h-5 w-5" />
                </Button>
              </Link>
            )}

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

            {user && <NotificationBell basePath="/dashboard" />}

            {user ? (
              <div className="flex items-center gap-1">
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} title="Admin">
                    <Shield className="h-5 w-5" />
                  </Button>
                )}
                {isInstructor && (
                  <Button variant="ghost" size="icon" onClick={() => navigate('/instructor')} title="Instructor">
                    <GraduationCap className="h-5 w-5" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} title="Dashboard">
                  <User className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={signOut} title="Sign Out">
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/auth/login')}>Login</Button>
                <Button size="sm" className="bg-accent hover:bg-accent-hover text-accent-foreground" onClick={() => navigate('/auth/register')}>Register</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== ROW 2: Category bar (desktop only) ===== */}
      <div className="hidden lg:block border-t">
        <div className="container">
          <nav className="flex items-center justify-center gap-1 h-[44px] overflow-x-auto">
            {COURSE_CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                to={`/courses?category=${cat.slug}`}
                className="px-3 py-1.5 text-sm text-foreground hover:text-primary transition-colors whitespace-nowrap"
              >
                {cat.name}
              </Link>
            ))}
            <Link to="/events" className="px-3 py-1.5 text-sm text-foreground hover:text-primary transition-colors whitespace-nowrap">Events</Link>
            <Link to="/blog" className="px-3 py-1.5 text-sm text-foreground hover:text-primary transition-colors whitespace-nowrap">Blog</Link>
            <Link to="/forum" className="px-3 py-1.5 text-sm text-foreground hover:text-primary transition-colors whitespace-nowrap">Forum</Link>
            <Link to="/about" className="px-3 py-1.5 text-sm text-foreground hover:text-primary transition-colors whitespace-nowrap">About</Link>
          </nav>
        </div>
      </div>

      {/* ===== MOBILE HEADER ===== */}
      <div className="md:hidden">
        <div className="container flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={OTSLogo} alt="Online Textile School" className="h-9 w-9 object-contain" />
            <span className="font-heading font-bold text-base text-primary">OTS</span>
          </Link>

          <div className="flex items-center gap-1">
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
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* ===== MOBILE MENU ===== */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background animate-fade-in">
          <div className="container py-4 space-y-2">
            <form onSubmit={handleSearch} className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search courses..."
                className="w-full h-10 pl-10 pr-4 rounded-md border border-input bg-background text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
            {[
              { label: 'Home', href: '/' },
              { label: 'Courses', href: '/courses' },
              { label: 'Learning Paths', href: '/learning-paths' },
              { label: 'eBooks', href: '/ebooks' },
              { label: 'Departments', href: '/departments' },
              { label: 'Events', href: '/events' },
              { label: 'Blog', href: '/blog' },
              { label: 'Forum', href: '/forum' },
              { label: 'Registration', href: '/register' },
              { label: 'Faculty', href: '/faculty' },
              { label: 'About', href: '/about' },
            ].map((link) => (
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
