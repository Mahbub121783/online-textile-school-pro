import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, Brain, ShoppingCart, User } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';

const BottomNav = () => {
  const location = useLocation();
  const itemCount = useCartStore((s) => s.getItemCount());

  const tabs = [
    { label: 'Home', icon: Home, href: '/' },
    { label: 'Courses', icon: BookOpen, href: '/courses' },
    { label: 'Practice', icon: Brain, href: '/practice' },
    { label: 'Cart', icon: ShoppingCart, href: '/cart', badge: itemCount },
    { label: 'Profile', icon: User, href: '/dashboard' },
  ];

  return (
    <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-50 bg-background border-t lg:hidden">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.href;
          return (
            <Link
              key={tab.label}
              to={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 relative ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <div className="relative">
                <tab.icon className="h-5 w-5" />
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-accent text-accent-foreground text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
