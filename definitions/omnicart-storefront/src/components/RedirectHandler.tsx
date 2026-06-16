import { useEffect, useState } from 'react';
import { useLocation, Navigate, Link } from 'react-router-dom';
import { findRedirectBySourcePath } from '@/services/redirects';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';

/**
 * RedirectHandler component
 * Checks if the current path has a redirect configured
 * If found, performs the redirect (internal or external)
 * If not found, shows 404 page
 * Shows a blank screen while checking to prevent 404 flash
 */
const RedirectHandler = () => {
  const location = useLocation();
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const checkRedirect = async () => {
      setIsChecking(true);
      setHasChecked(false);

      try {
        const redirect = await findRedirectBySourcePath(location.pathname);

        if (redirect) {
          const destination = redirect.destination_path;

          // Check if it's an external URL
          if (destination.startsWith('http://') || destination.startsWith('https://')) {
            // External redirect - use window.location
            // Don't set isChecking to false, keep showing blank screen during redirect
            window.location.href = destination;
            return;
          }

          // Internal redirect - use React Router
          setRedirectTo(destination);
        } else {
          setRedirectTo(null);
        }
      } catch (error) {
        console.error('Error checking redirect:', error);
        setRedirectTo(null);
      } finally {
        setIsChecking(false);
        setHasChecked(true);
      }
    };

    checkRedirect();
  }, [location.pathname]);

  // Show blank screen while checking (prevents flash of 404)
  // This includes the time during external redirect
  // With caching, this should be nearly instant after first load
  if (isChecking || !hasChecked) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#ffffff'
      }} />
    );
  }

  // Perform internal redirect
  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  // No redirect found, show 404 page
  return <NotFoundPage pathname={location.pathname} />;
};

/**
 * Separate 404 component to properly use useEffect
 */
const NotFoundPage = ({ pathname }: { pathname: string }) => {
  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      pathname
    );
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-grow flex items-center justify-center bg-vnsh-lightgray">
        <div className="text-center px-4 py-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 text-vnsh-dark">404</h1>
          <p className="text-xl text-gray-600 mb-8">Oops! The page you're looking for can't be found.</p>
          <Button asChild className="btn-primary">
            <Link to="/">Return to Home</Link>
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default RedirectHandler;

