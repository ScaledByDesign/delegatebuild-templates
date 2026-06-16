import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { submitContactForm } from '@/services/contactForm';

const TrnCancelForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
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
        comment: formData.comment,
        formType: 'trn-cancel',
        subject: 'TRN Membership Cancellation Request',
      });

      toast({
        title: "Cancellation request submitted",
        description: "We'll process your request and send you a confirmation email.",
      });

      setFormData({
        name: '',
        email: '',
        comment: ''
      });
    } catch (error) {
      console.error('Form submission error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send request. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow">
        {/* Hero Banner Section */}
        <section 
          className="relative py-16 md:py-24 bg-cover bg-center flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(18,18,18,0.8) 0%, rgba(18,18,18,0.6) 100%)',
            backgroundColor: '#121212'
          }}
        >
          <div className="container mx-auto px-4 text-center">
            <h1 
              className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-wide uppercase"
              style={{ fontFamily: 'stratumno1-black, Oswald, sans-serif' }}
            >
              Cancel TRN membership
            </h1>
          </div>
        </section>

        {/* Membership Cancellation Form Section */}
        <section className="py-9 md:py-12 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto">
              <h2 
                className="text-xl md:text-2xl font-bold mb-8 text-black uppercase tracking-wide"
                style={{ fontFamily: 'stratumno1-black, Oswald, sans-serif' }}
              >
                membership cancellation form
              </h2>
              
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

export default TrnCancelForm;

