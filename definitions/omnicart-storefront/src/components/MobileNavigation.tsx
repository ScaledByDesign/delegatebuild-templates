import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { TouchTarget, MobileDrawer } from '@/components/MobileOptimizations';
import { 
  Home, 
  Search, 
  ShoppingCart, 
  User, 
  Menu,
  X,
  Package,
  Heart,
  Settings,
  LogOut,
  ChevronRight
} from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useCustomer } from '@/hooks/useCustomer';
import { Badge } from '@/components/ui/badge';

interface MobileNavigationProps {
  className?: string;
}

const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const { cart } = useCart();
  const cartItemCount = cart?.items?.length || 0;

  const navItems = [
    { path: '/', icon: Home, label: 'HOME' },
    { path: '/search', icon: Search, label: 'SEARCH' },
    { path: '/cart', icon: ShoppingCart, label: 'CART', badge: cartItemCount },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-pb">
      <div className="flex items-center justify-around py-2">
        {navItems.map(({ path, icon: Icon, label, badge }) => {
          const isActive = location.pathname === path;
          
          return (
            <Link
              key={path}
              to={path}
              className="flex flex-col items-center justify-center relative"
            >
              <TouchTarget
                className={`
                  relative p-2 rounded-lg transition-colors
                  ${isActive
                    ? 'text-vnsh-red bg-red-50'
                    : 'text-gray-600 hover:text-vnsh-red hover:bg-gray-50'
                  }
                `}
              >
                <Icon size={20} />
                {badge && badge > 0 && (
                  <Badge
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0 min-w-[20px] bg-vnsh-green text-white hover:bg-vnsh-green"
                  >
                    {badge > 99 ? '99+' : badge}
                  </Badge>
                )}
              </TouchTarget>
              <span className={`text-xs mt-1 ${isActive ? 'text-vnsh-red font-medium' : 'text-gray-600'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

const MobileTopNav: React.FC<{ onMenuToggle: () => void }> = ({ onMenuToggle }) => {
  const { cart } = useCart();
  const cartItemCount = cart?.items?.length || 0;

  return (
    <header className="sticky top-0 bg-white border-b border-gray-200 z-30 safe-area-pt">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Menu Button - wrapped in div to match cart structure for symmetry */}
        <div className="relative">
          <TouchTarget onClick={onMenuToggle} className="p-2 -ml-2">
            <Menu size={24} className="text-gray-700" />
          </TouchTarget>
        </div>

        {/* Logo - centered with flex-1 */}
        <Link to="/" className="flex-1 flex justify-center">
          <img
            src="/vnsh-logo.png"
            alt="VNS Holster"
            className="h-8 w-auto"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
              if (nextElement) nextElement.style.display = 'block';
            }}
          />
          <span className="text-xl font-bold text-vnsh-red hidden">VNS HOLSTER</span>
        </Link>

        {/* Cart Icon */}
        <Link to="/cart" className="relative">
          <TouchTarget className="p-2 -mr-2">
            <ShoppingCart size={24} className="text-gray-700" />
            {cartItemCount > 0 && (
              <Badge
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0 min-w-[20px] bg-vnsh-green text-white hover:bg-vnsh-green"
              >
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </Badge>
            )}
          </TouchTarget>
        </Link>
      </div>
    </header>
  );
};

const MobileSideMenu: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { customer, logout } = useCustomer();
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'HOME', icon: Home },
    { path: '/collections/products', label: 'ALL PRODUCTS', icon: Package },
    { path: '/collections/holsters', label: 'HOLSTERS', icon: Package },
    { path: '/collections/accessories', label: 'ACCESSORIES', icon: Package },
    { path: '/search', label: 'SEARCH', icon: Search },
  ];

  const accountItems = customer ? [
    { path: '/account', label: 'MY ACCOUNT', icon: User },
    { path: '/account/orders', label: 'ORDERS', icon: Package },
    { path: '/wishlist', label: 'WISHLIST', icon: Heart },
    { path: '/account/settings', label: 'SETTINGS', icon: Settings },
  ] : [
    { path: '/login', label: 'SIGN IN', icon: User },
    { path: '/signup', label: 'CREATE ACCOUNT', icon: User },
  ];

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  return (
    <MobileDrawer
      isOpen={isOpen}
      onClose={onClose}
      position="left"
      title="Menu"
    >
      <div className="p-4 space-y-6">
        {/* User Section */}
        {customer && (
          <div className="pb-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-vnsh-red rounded-full flex items-center justify-center">
                <User size={24} className="text-white" />
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {customer.first_name} {customer.last_name}
                </p>
                <p className="text-sm text-gray-500">{customer.email}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Navigation */}
        <nav className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            SHOP
          </h3>
          {menuItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            
            return (
              <Link
                key={path}
                to={path}
                onClick={onClose}
                className={`
                  flex items-center justify-between p-3 rounded-lg transition-colors
                  ${isActive 
                    ? 'bg-vnsh-red text-white' 
                    : 'text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <div className="flex items-center space-x-3">
                  <Icon size={20} />
                  <span className="font-medium">{label}</span>
                </div>
                <ChevronRight size={16} />
              </Link>
            );
          })}
        </nav>

        {/* Account Section */}
        <nav className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            ACCOUNT
          </h3>
          {accountItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            
            return (
              <Link
                key={path}
                to={path}
                onClick={onClose}
                className={`
                  flex items-center justify-between p-3 rounded-lg transition-colors
                  ${isActive 
                    ? 'bg-vnsh-red text-white' 
                    : 'text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <div className="flex items-center space-x-3">
                  <Icon size={20} />
                  <span className="font-medium">{label}</span>
                </div>
                <ChevronRight size={16} />
              </Link>
            );
          })}
          
          {customer && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-between p-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <LogOut size={20} />
                <span className="font-medium">SIGN OUT</span>
              </div>
            </button>
          )}
        </nav>
      </div>
    </MobileDrawer>
  );
};

const MobileNavigation: React.FC<MobileNavigationProps> = ({ className = "" }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  // Close menu on route change
  const location = useLocation();
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  if (!isMobile) return null;

  return (
    <div className={className}>
      <MobileTopNav onMenuToggle={() => setIsMenuOpen(true)} />
      <MobileSideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      <MobileBottomNav />
      
      {/* Add bottom padding to account for bottom nav */}
      <div className="h-20" />
    </div>
  );
};

export default MobileNavigation;
