import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Menu, X, ChevronDown, Heart, User, LogOut, GraduationCap, Shield, BookOpen, Settings, TrendingUp } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';
import CurrencySelector from '@/components/CurrencySelector';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useCartStore } from '@/stores/cartStore';
import NotificationBell from '@/components/layout/NotificationBell';
import { COURSE_CATEGORIES } from '@/lib/constants';
import OTSLogo from '@/assets/OTS_LOGO.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import CreditBalancePill from '@/components/layout/CreditBalancePill';

const TRENDING_SEARCHES = [
  'Spinning Technology',
  'Fabric Dyeing',
  'Garments Merchandising',
  'Weaving Calculation',
  'Quality Control',
];

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [certDropdown, setCertDropdown] = useState(false);
  const { t } = useTranslation();
  const { user, roles, signOut, profile } = useAuth();
  const itemCount = useCartStore((s) => s.getItemCount());
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);

  const isInstructor = roles.includes('instructor');
  const isAdmin = roles.includes('admin') || roles.includes('super_admin');

  const userInitials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U';

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
    <header className={`site-header sticky top-0 z-50 w-full transition-all duration-300 ${scrolled ? 'bg-background/95 backdrop-blur-md shadow-md' : 'bg-background border-b'}`}>
      {/* ===== DESKTOP HEADER ===== */}
      <div className="hidden md:block">
        <div className="container flex items-center gap-6 h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <img src={OTSLogo} alt="Online Textile School" className="h-9 w-9 object-contain" />
            <span className="font-heading font-bold text-base text-primary leading-tight hidden lg:block">
              Online Textile<br />School
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden lg:flex items-center gap-0.5 shrink-0">
            <Link to="/courses" className="px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors rounded-md">
              {t('nav.courses')}
            </Link>

            <div
              className="relative"
              onMouseEnter={() => setCertDropdown(true)}
              onMouseLeave={() => setCertDropdown(false)}
            >
              <Link
                to="/learning-paths"
                className={`flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors rounded-md hover:text-primary ${certDropdown ? 'text-primary' : 'text-foreground'}`}
              >
                {t('nav.learningPaths')}
                <ChevronDown className="h-3.5 w-3.5" />
              </Link>

              {certDropdown && (
                <div className="absolute top-full left-0 w-[280px] bg-background border rounded-lg shadow-xl p-3 animate-fade-in z-50">
                  <p className="text-xs font-bold text-primary mb-2 uppercase tracking-wide px-2">Learning Paths</p>
                  {['Spinning Expert', 'Weaving Professional', 'Dyeing & Finishing'].map((item) => (
                    <Link
                      key={item}
                      to="/learning-paths"
                      className="block px-2 py-1.5 text-sm rounded-md hover:bg-secondary transition-colors"
                      onClick={() => setCertDropdown(false)}
                    >
                      {item}
                    </Link>
                  ))}
                  <div className="border-t my-2" />
                  <p className="text-xs font-bold text-primary mb-2 uppercase tracking-wide px-2">Popular Certifications</p>
                  {['Textile Quality Control', 'Garments Technology', 'Yarn Manufacturing', 'Merchandising'].map((item) => (
                    <Link
                      key={item}
                      to="/learning-paths"
                      className="block px-2 py-1.5 text-sm rounded-md hover:bg-secondary transition-colors"
                      onClick={() => setCertDropdown(false)}
                    >
                      {item}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link to="/ebooks" className="px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors rounded-md">
              {t('nav.ebooks')}
            </Link>

            <Link to="/register" className="px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors rounded-md">
              {t('nav.registration')}
            </Link>
          </nav>

          {/* Search */}
          <div ref={searchRef} className="flex-1 max-w-lg relative">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('common.search')}
                className="w-full h-10 pl-10 pr-4 rounded-full border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
              />
            </form>

            {searchFocused && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-xl p-3 z-50 animate-fade-in">
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Trending</p>
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
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                    {term}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right nav */}
          <nav className="hidden lg:flex items-center gap-1 shrink-0">
            <Link to="/become-instructor" className="px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors whitespace-nowrap">
              Become Instructor
            </Link>
            {user && (
              <Link to="/dashboard/courses" className="px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors whitespace-nowrap">
                {t('dashboard.myCourses')}
              </Link>
            )}
          </nav>

          {/* Action icons — clean & minimal */}
          <div className="flex items-center gap-0.5 shrink-0">
            <CurrencySelector />
            <LanguageToggle />
            <ThemeToggle />

            {user && (
              <Link to="/dashboard/wishlist">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Heart className="h-[18px] w-[18px]" />
                </Button>
              </Link>
            )}

            <CreditBalancePill />

            <Link to="/cart" className="relative">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ShoppingCart className="h-[18px] w-[18px]" />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-accent text-accent-foreground text-[10px] w-[18px] h-[18px] flex items-center justify-center rounded-full font-bold">
                    {itemCount}
                  </span>
                )}
              </Button>
            </Link>

            {user && <NotificationBell basePath="/dashboard" />}

            {/* User avatar dropdown or auth buttons */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full p-0 ml-1">
                    <Avatar className="h-8 w-8 border-2 border-primary/20">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium truncate">{profile?.full_name || 'Student'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                    <User className="mr-2 h-4 w-4" /> {t('common.dashboard')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`/contributor/${user.id}`)}>
                    <GraduationCap className="mr-2 h-4 w-4" /> View public profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/dashboard/courses')}>
                    <BookOpen className="mr-2 h-4 w-4" /> {t('dashboard.myCourses')}
                  </DropdownMenuItem>
                  {isInstructor && (
                    <DropdownMenuItem onClick={() => navigate('/instructor')}>
                      <GraduationCap className="mr-2 h-4 w-4" /> Instructor Portal
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate('/admin')}>
                      <Shield className="mr-2 h-4 w-4" /> Admin Panel
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate('/dashboard/settings')}>
                    <Settings className="mr-2 h-4 w-4" /> {t('common.settings')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" /> {t('common.signOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2 ml-2">
                <Button variant="ghost" size="sm" className="h-8 text-sm" onClick={() => navigate('/auth/login')}>
                  {t('common.login')}
                </Button>
                <Button size="sm" className="h-8 text-sm bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => navigate('/auth/register')}>
                  {t('common.register')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== CATEGORY BAR (desktop) ===== */}
      <div className="hidden lg:block border-t bg-muted/30">
        <div className="container">
          <nav className="flex items-center gap-0.5 h-10 overflow-hidden">
            {COURSE_CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                to={`/courses?category=${cat.slug}`}
                className="px-2.5 py-1 text-[13px] text-foreground/80 hover:text-primary transition-colors whitespace-nowrap"
              >
                {cat.name}
              </Link>
            ))}
            <Link to="/events" className="px-2.5 py-1 text-[13px] text-foreground/80 hover:text-primary transition-colors whitespace-nowrap">{t('nav.events')}</Link>
            <Link to="/workshops" className="px-2.5 py-1 text-[13px] text-foreground/80 hover:text-primary transition-colors whitespace-nowrap">Workshops</Link>
            <Link to="/class-videos" className="px-2.5 py-1 text-[13px] text-foreground/80 hover:text-primary transition-colors whitespace-nowrap font-medium">Class Videos</Link>
            <Link to="/practice" className="px-2.5 py-1 text-[13px] text-accent hover:text-accent-hover transition-colors whitespace-nowrap font-bold">🧠 Practice</Link>
            <Link to="/campus-onboard" className="px-2.5 py-1 text-[13px] text-foreground/80 hover:text-primary transition-colors whitespace-nowrap">Campus Onboard</Link>
            <Link to="/blog" className="px-2.5 py-1 text-[13px] text-foreground/80 hover:text-primary transition-colors whitespace-nowrap">{t('nav.blog')}</Link>
            <Link to="/forum" className="px-2.5 py-1 text-[13px] text-foreground/80 hover:text-primary transition-colors whitespace-nowrap">{t('nav.forum')}</Link>
            <Link to="/about" className="px-2.5 py-1 text-[13px] text-foreground/80 hover:text-primary transition-colors whitespace-nowrap">{t('nav.about')}</Link>
          </nav>
        </div>
      </div>

      {/* ===== MOBILE HEADER ===== */}
      <div className="md:hidden">
        <div className="container flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={OTSLogo} alt="OTS" className="h-8 w-8 object-contain" />
            <span className="font-heading font-bold text-sm text-primary">OTS</span>
          </Link>

          <div className="flex items-center gap-0.5">
            <ThemeToggle />
            <CreditBalancePill />
            {user && <NotificationBell basePath="/dashboard" />}
            <Link to="/cart" className="relative">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ShoppingCart className="h-[18px] w-[18px]" />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-accent text-accent-foreground text-[10px] w-[18px] h-[18px] flex items-center justify-center rounded-full font-bold">
                    {itemCount}
                  </span>
                )}
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* ===== MOBILE MENU ===== */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background animate-fade-in max-h-[80vh] overflow-y-auto">
          <div className="container py-3 space-y-1">
            <form onSubmit={handleSearch} className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search courses..."
                className="w-full h-10 pl-10 pr-4 rounded-lg border border-input bg-background text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>

            {[
              { label: t('nav.courses'), href: '/courses' },
              { label: t('nav.learningPaths'), href: '/learning-paths' },
              { label: t('nav.ebooks'), href: '/ebooks' },
              { label: t('nav.registration'), href: '/register' },
              { label: t('nav.events'), href: '/events' },
              { label: 'Workshops', href: '/workshops' },
              { label: 'Class Videos', href: '/class-videos' },
              { label: '🧠 Practice Arena', href: '/practice' },
              { label: 'Campus Onboard', href: '/campus-onboard' },
              { label: t('nav.blog'), href: '/blog' },
              { label: t('nav.forum'), href: '/forum' },
              { label: t('nav.about'), href: '/about' },
            ].map((link) => (
              <Link key={link.label} to={link.href} className="block px-3 py-2.5 text-sm font-medium rounded-md hover:bg-secondary" onClick={() => setMobileMenuOpen(false)}>
                {link.label}
              </Link>
            ))}

            <div className="border-t pt-3 mt-2 space-y-1.5">
              {user ? (
                <>
                  <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }}>
                    <User className="h-4 w-4 mr-2" /> {t('common.dashboard')}
                  </Button>
                  {isInstructor && (
                    <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => { navigate('/instructor'); setMobileMenuOpen(false); }}>
                      <GraduationCap className="h-4 w-4 mr-2" /> Instructor
                    </Button>
                  )}
                  {isAdmin && (
                    <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => { navigate('/admin'); setMobileMenuOpen(false); }}>
                      <Shield className="h-4 w-4 mr-2" /> Admin
                    </Button>
                  )}
                  <Button variant="ghost" className="w-full justify-start text-destructive" size="sm" onClick={() => { signOut(); setMobileMenuOpen(false); }}>
                    <LogOut className="h-4 w-4 mr-2" /> {t('common.signOut')}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="w-full" size="sm" onClick={() => { navigate('/auth/login'); setMobileMenuOpen(false); }}>{t('common.login')}</Button>
                  <Button className="w-full bg-primary text-primary-foreground" size="sm" onClick={() => { navigate('/auth/register'); setMobileMenuOpen(false); }}>{t('common.register')}</Button>
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
