import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Facebook, Instagram, Youtube, ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

/**
 * Capture email signup via Attentive SDK
 */
function sendEmailToAttentive(email: string): boolean {
  const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

  if (!emailRegex.test(email)) {
    console.log('Newsletter: Invalid email, skipping');
    return false;
  }

  if (window.attentive && typeof window.attentive.analytics?.identify === 'function') {
    window.attentive.analytics?.identify({ email });
    console.log('Newsletter: Email captured via Attentive:', email);
    return true;
  }

  console.warn('Newsletter: Attentive SDK not available');
  return false;
}

const Footer = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = useIsMobile();
  const [openSections, setOpenSections] = useState<string[]>([]);
  const { toast } = useToast();

  const toggleSection = (section: string) => {
    setOpenSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Capture email via Attentive SDK
      sendEmailToAttentive(email);

      toast({
        title: "Success!",
        description: "You've been subscribed to our newsletter.",
      });
      setEmail('');
    } catch (error) {
      console.error('Newsletter signup error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to subscribe. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };
  return <footer className="bg-black text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Mission */}
          <div className="md:border-r md:border-white md:pr-8">
            <h3 className="footer heading text-lg font-bold mb-4">OUR MISSION</h3>
            <p className="text-gray-300 text-sm leading-relaxed italic">We exist to help you carry comfortably all day, every day.</p>
            <br />
            <p className="text-gray-300 text-sm leading-relaxed italic">
              We're here to support normal, everyday Americans, 
              law-enforcement, active-duty, military in their quest for 
              armed and effective to carrying safely in dangerous world.
            </p>
          </div>

          {/* Newsletter Signup */}
          <div className="text-center md:border-r md:border-white md:pr-8">
            <div className="inline-block mb-4">
              <img src="/lovable-uploads/03c160ac-57ff-4b61-aca8-2669c70ef1aa.png" alt="VNSH Logo" className="h-16 w-auto" />
            </div>
            
            <h3 className="footer heading text-lg font-bold mb-4">STAY IN THE LOOP</h3>
            <p className="text-gray-300 text-sm mb-6">
              Be the first to get access to deals, limited-time 
              offers, and timely updates on all things 
              related to VNSH and our friends in the 
              industry!
            </p>
            
            <form onSubmit={handleNewsletterSubmit} className="flex gap-0 justify-center max-w-md mx-auto mb-6">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="bg-transparent border-white border-r-0 text-white placeholder-gray-400 flex-1 rounded-r-none focus:ring-0 focus:ring-offset-0"
                required
                disabled={isLoading}
              />
              <Button
                type="submit"
                className="bg-[#176326] hover:bg-[#0f4a1c] text-white px-6 whitespace-nowrap rounded-l-none"
                disabled={isLoading}
              >
                {isLoading ? 'SIGNING UP...' : 'SIGN UP'}
              </Button>
            </form>
            
            <div className="flex justify-center space-x-4 mt-6">
              <a 
                href="https://www.facebook.com/vnshholsters" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-white hover:text-gray-300 transition-colors cursor-pointer block p-2"
                aria-label="Visit VNSH on Facebook"
              >
                <Facebook size={20} />
              </a>
              <a 
                href="https://www.instagram.com/vnsh_holsters/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-white hover:text-gray-300 transition-colors cursor-pointer block p-2"
                aria-label="Visit VNSH on Instagram"
              >
                <Instagram size={20} />
              </a>
              <a 
                href="https://www.youtube.com/@vnshholsters" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-white hover:text-gray-300 transition-colors cursor-pointer block p-2"
                aria-label="Visit VNSH on YouTube"
              >
                <Youtube size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            {isMobile ? (
              <Collapsible
                open={openSections.includes('quicklinks')}
                onOpenChange={() => toggleSection('quicklinks')}
              >
                <CollapsibleTrigger className="flex justify-between items-center w-full py-2 text-left">
                  <h3 className="footer heading text-lg font-bold">QUICK LINKS</h3>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      openSections.includes('quicklinks') ? 'rotate-180' : ''
                    }`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="space-y-2 mt-4">
                    <li>
                      <Link to="/search" className="text-gray-300 hover:text-white text-sm">
                        Search
                      </Link>
                    </li>
                    <li>
                      <Link to="/about" className="text-gray-300 hover:text-white text-sm">
                        About Us
                      </Link>
                    </li>
                    <li>
                      <Link to="/pages/privacy-policy" className="text-gray-300 hover:text-white text-sm">
                        Privacy Policy
                      </Link>
                    </li>
                    <li>
                      <Link to="/pages/return-policy" className="text-gray-300 hover:text-white text-sm">
                        Return Policy
                      </Link>
                    </li>
                    <li>
                      <Link to="/pages/shipping-policy" className="text-gray-300 hover:text-white text-sm">
                        Shipping Policy
                      </Link>
                    </li>
                    <li>
                      <Link to="/pages/terms-disclaimer" className="text-gray-300 hover:text-white text-sm">
                        Terms & Disclaimer
                      </Link>
                    </li>
                    <li>
                      <Link to="/pages/cancel-membership" className="text-gray-300 hover:text-white text-sm">
                        Cancel Membership
                      </Link>
                    </li>
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <>
                <h3 className="footer heading text-lg font-bold mb-4">QUICK LINKS</h3>
                <ul className="space-y-2">
                  <li>
                    <Link to="/search" className="text-gray-300 hover:text-white text-sm">
                      Search
                    </Link>
                  </li>
                  <li>
                    <Link to="/about" className="text-gray-300 hover:text-white text-sm">
                      About Us
                    </Link>
                  </li>
                  <li>
                    <Link to="/pages/privacy-policy" className="text-gray-300 hover:text-white text-sm">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link to="/pages/return-policy" className="text-gray-300 hover:text-white text-sm">
                      Return Policy
                    </Link>
                  </li>
                  <li>
                    <Link to="/pages/shipping-policy" className="text-gray-300 hover:text-white text-sm">
                      Shipping Policy
                    </Link>
                  </li>
                  <li>
                    <Link to="/pages/terms-disclaimer" className="text-gray-300 hover:text-white text-sm">
                      Terms & Disclaimer
                    </Link>
                  </li>
                  <li>
                    <Link to="/pages/cancel-membership" className="text-gray-300 hover:text-white text-sm">
                      Cancel Membership
                    </Link>
                  </li>
                </ul>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-white pt-8 mt-8">
          <div className="text-center">
            <p className="text-gray-400 text-sm">© {new Date().getFullYear()} VNSH</p>
          </div>
        </div>
      </div>
    </footer>;
};
export default Footer;