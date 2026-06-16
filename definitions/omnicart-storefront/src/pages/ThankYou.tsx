import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { submitContactForm } from '@/services/contactForm';

const ThankYou = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    comment: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await submitContactForm({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        comment: formData.comment,
        formType: 'thankyou',
        subject: 'Question about VNSH Holster Setup',
      });

      toast({
        title: "Message sent!",
        description: "We'll get back to you as soon as possible.",
      });

      setFormData({
        name: '',
        email: '',
        phone: '',
        comment: ''
      });
    } catch (error) {
      console.error('Form submission error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow">
        {/* Title Section */}
        <section className="py-9 md:py-12 bg-white">
          <div className="container mx-auto px-4">
            <h1 
              className="text-3xl md:text-4xl lg:text-5xl font-bold text-center text-black tracking-wide uppercase"
              style={{ fontFamily: 'stratumno1-black, Oswald, sans-serif' }}
            >
              How To set up your new VNSH holster
            </h1>
          </div>
        </section>

        {/* YouTube Video Section */}
        <section className="py-3 md:py-4 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute top-0 left-0 w-full h-full rounded-lg"
                  src="https://www.youtube.com/embed/0TXtIOXP9g0?enablejsapi=1"
                  title="VNSH - Setup Your New Holster"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </section>

        {/* "Have Questions?" Section with Contact Form */}
        <section className="py-9 md:py-12 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto">
              <h2 
                className="text-2xl md:text-3xl font-semibold text-center mb-8 text-gray-700"
                style={{ fontFamily: 'URWDIN-Regular, sans-serif' }}
              >
                Have Questions? send us an email
              </h2>
              
              <h3 
                className="text-xl md:text-2xl font-bold mb-6 text-black uppercase tracking-wide"
                style={{ fontFamily: 'stratumno1-black, Oswald, sans-serif' }}
              >
                Contact form
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <Input
                  type="text"
                  name="name"
                  placeholder="Name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="h-14 border-gray-300 text-base px-4 rounded-md focus:border-black focus:ring-black"
                />
                
                <Input
                  type="email"
                  name="email"
                  placeholder="Email *"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="h-14 border-gray-300 text-base px-4 rounded-md focus:border-black focus:ring-black"
                  required
                />
                
                <Input
                  type="tel"
                  name="phone"
                  placeholder="Phone number"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="h-14 border-gray-300 text-base px-4 rounded-md focus:border-black focus:ring-black"
                />
                
                <Textarea
                  name="comment"
                  placeholder="Comment"
                  value={formData.comment}
                  onChange={handleInputChange}
                  className="min-h-32 border-gray-300 resize-none text-base px-4 py-3 rounded-md focus:border-black focus:ring-black"
                  rows={5}
                  required
                />
                
                <div className="flex justify-start">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-black hover:bg-gray-800 text-white px-10 py-4 font-semibold text-base rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ThankYou;

