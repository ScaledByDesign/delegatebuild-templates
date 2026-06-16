
import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

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

export default NotFound;
