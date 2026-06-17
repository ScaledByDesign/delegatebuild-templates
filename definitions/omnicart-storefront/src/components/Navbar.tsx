
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ShoppingCart, Search, User, LogOut, Heart, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/useCart';
import { useCustomer } from '@/hooks/useCustomer';
import { useWishlistCount } from '@/hooks/useWishlist';
import { useLoyaltyPoints } from '@/hooks/useLoyalty';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { cart } = useCart();
  const { customer, isAuthenticated, logout } = useCustomer();
  const { count: wishlistCount } = useWishlistCount();
  const { points } = useLoyaltyPoints();

  // Calculate total quantity of items in the cart (exclude mystery gift line items)
  const cartItemsCount = cart?.items
    ?.filter((item: any) => !item.metadata?.is_mystery_gift)
    .reduce((total, item) => total + item.quantity, 0) || 0;

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Helper function to check if a route is active
  const isActiveRoute = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  // Navigation link classes with underline behavior
  const getNavLinkClasses = (path: string) => {
    const baseClasses = "relative text-vnsh-dark transition-all duration-200 after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-[2px] after:bg-[#111111] after:origin-left after:transition-transform after:duration-200 after:ease-out";
    const activeClasses = isActiveRoute(path) ? "after:scale-x-100" : "after:scale-x-0";
    const hoverClasses = "hover:after:scale-x-100 focus-visible:after:scale-x-100";
    return `${baseClasses} ${activeClasses} ${hoverClasses}`;
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="container mx-auto px-4 py-4">
        {/* Mobile Layout */}
        <div className="md:hidden flex items-center justify-center relative">
          {/* Mobile Menu Button */}
          <button
            className="text-vnsh-dark hover:text-vnsh-red absolute left-0 z-10"
            onClick={toggleMenu}
            aria-label="Menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Centered Logo */}
          <Link to="/" className="flex items-center">
            <img
              src="/lovable-uploads/060fc0ae-7c76-4b9d-84bf-ef2ccf5c7704.png"
              alt="VNSH Logo"
              className="h-10 w-auto"
            />
          </Link>

          {/* Mobile Icons */}
          <div className="flex items-center space-x-3 absolute right-0 z-10">
            <button
              className="text-vnsh-dark hover:text-vnsh-red"
              aria-label="Search"
              onClick={() => window.location.href = '/search'}
            >
              <Search size={20} />
            </button>
            {isAuthenticated && (
              <Link to="/wishlist" className="relative text-vnsh-dark hover:text-vnsh-red" aria-label="Wishlist">
                <Heart size={20} />
                {wishlistCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-vnsh-green text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                    {wishlistCount}
                  </span>
                )}
              </Link>
            )}
            <Link to="/cart" id="mobile-cart-icon" className="relative text-vnsh-dark hover:text-vnsh-red" aria-label="Cart">
              <ShoppingCart size={20} />
              {cartItemsCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-vnsh-green text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                  {cartItemsCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:block">
          {/* Centered Logo */}
          <div className="flex justify-center mb-4">
            <Link to="/" className="flex items-center">
              <img 
                src="/lovable-uploads/060fc0ae-7c76-4b9d-84bf-ef2ccf5c7704.png" 
                alt="VNSH Logo" 
                className="h-12 w-auto"
              />
            </Link>
          </div>

          <div className="flex items-center justify-between">
            {/* Desktop Navigation */}
            <nav className="site-nav flex space-x-8 flex-1 justify-center">
              <Link to="/" className={getNavLinkClasses('/')}>
                HOME
              </Link>
              <Link to="/collections/products" className={getNavLinkClasses('/collections/products')}>
                PRODUCTS
              </Link>
              <Link to="/collections/accessories" className={getNavLinkClasses('/collections/accessories')}>
                ACCESSORIES
              </Link>
              <Link to="/collections/vnsh-holsters-apparel-and-gifts" className={getNavLinkClasses('/collections/vnsh-holsters-apparel-and-gifts')}>
                APPAREL AND GIFTS
              </Link>
              <Link to="/about" className={getNavLinkClasses('/about')}>
                ABOUT US
              </Link>
              <Link to="/contact" className={getNavLinkClasses('/contact')}>
                CONTACT
              </Link>
            </nav>

            {/* Desktop Icons */}
            <div className="flex items-center space-x-4">
              <button
                className="text-vnsh-dark hover:text-vnsh-red"
                aria-label="Search"
                onClick={() => window.location.href = '/search'}
              >
                <Search size={20} />
              </button>
              <Link to="/cart" id="desktop-cart-icon" className="relative text-vnsh-dark hover:text-vnsh-red" aria-label="Cart">
                <ShoppingCart size={20} />
                {cartItemsCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-vnsh-green text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                    {cartItemsCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden bg-white shadow-lg py-4 px-4 absolute w-full">
          <nav className="flex flex-col space-y-4">
            <Link
              to="/"
              className={`${getNavLinkClasses('/')} py-2`}
              onClick={() => setIsMenuOpen(false)}
            >
              HOME
            </Link>
            <Link
              to="/collections/products"
              className={`${getNavLinkClasses('/collections/products')} py-2`}
              onClick={() => setIsMenuOpen(false)}
            >
              PRODUCTS
            </Link>
            <Link
              to="/collections/accessories"
              className={`${getNavLinkClasses('/collections/accessories')} py-2`}
              onClick={() => setIsMenuOpen(false)}
            >
              ACCESSORIES
            </Link>
            <Link
              to="/collections/vnsh-holsters-apparel-and-gifts"
              className={`${getNavLinkClasses('/collections/vnsh-holsters-apparel-and-gifts')} py-2`}
              onClick={() => setIsMenuOpen(false)}
            >
              APPAREL AND GIFTS
            </Link>
            <Link 
              to="/about" 
              className={`${getNavLinkClasses('/about')} py-2`}
              onClick={() => setIsMenuOpen(false)}
            >
              ABOUT US
            </Link>
            <Link
              to="/contact"
              className={`${getNavLinkClasses('/contact')} py-2`}
              onClick={() => setIsMenuOpen(false)}
            >
              CONTACT
            </Link>

            {/* Authentication Links for Mobile */}
            {isAuthenticated && (
              <div className="border-t border-gray-200 pt-4 mt-4">
                <Link
                  to="/account"
                  className="text-vnsh-dark hover:text-vnsh-red font-medium py-2 flex items-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <User size={18} className="mr-2" />
                  MY ACCOUNT
                </Link>
                <Link
                  to="/wishlist"
                  className="text-vnsh-dark hover:text-vnsh-red font-medium py-2 flex items-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Heart size={18} className="mr-2" />
                   WISHLIST
                  {wishlistCount > 0 && (
                    <span className="ml-2 bg-vnsh-red text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                      {wishlistCount}
                    </span>
                  )}
                </Link>
                <Link
                  to="/loyalty"
                  className="text-vnsh-dark hover:text-vnsh-red font-medium py-2 flex items-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Award size={18} className="mr-2" />
                  LOYALTY PROGRAM
                  {points > 0 && (
                    <span className="ml-2 bg-vnsh-red text-white rounded-full px-2 py-0.5 text-xs">
                      {points.toLocaleString()}
                    </span>
                  )}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-vnsh-dark hover:text-vnsh-red font-medium py-2 flex items-center w-full text-left"
                >
                  <LogOut size={18} className="mr-2" />
                   LOGOUT
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;

// Also exported as a named export so either import style resolves
// (`import Navbar from ...` or `import { Navbar } from ...`).
export { Navbar };
