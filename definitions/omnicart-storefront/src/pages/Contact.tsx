import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { submitContactForm } from '@/services/contactForm';
import contactHeroBg from '@/assets/contact-hero-bg.jpg';

const Contact = () => {
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
      // Submit to Maropost + Supabase Edge Function (matches vnshholsters.com behavior)
      await submitContactForm({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        comment: formData.comment,
        formType: 'contact',
        subject: 'Contact Form Submission',
      });

      toast({
        title: "Message sent!",
        description: "We'll get back to you as soon as possible.",
      });

      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        comment: ''
      });
    } catch (error) {
      console.error('Contact form error:', error);
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
        {/* Hero Section with Forest Background */}
        <section 
          className="relative h-[70vh] bg-cover bg-center flex items-center justify-center"
          style={{
            backgroundImage: `url('${contactHeroBg}')`
          }}
        >
          <div className="absolute inset-0 bg-black/40"></div>
          
          <div className="relative z-10 bg-white rounded-lg px-12 py-8 text-center max-w-lg mx-4 shadow-lg">
            <h1 className="text-4xl font-bold mb-4 text-black tracking-wide">HOW CAN WE HELP?</h1>
            <p className="text-gray-700 text-lg font-medium">Support Hours | Monday - Friday: 9AM-5PM EST</p>
          </div>
        </section>

        {/* Contact Information */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 max-w-4xl mx-auto text-center">
              <div>
                <h3 className="text-xl font-bold mb-4 text-black">Email</h3>
                <a 
                  href="mailto:customercare@vnsh.com" 
                  className="text-gray-700 text-lg hover:text-black transition-colors duration-200"
                >
                  customercare@vnsh.com
                </a>
              </div>
              
              <div>
                <h3 className="text-xl font-bold mb-4 text-black">Phone</h3>
                <a
                  href="tel:+18885261885"
                  className="text-gray-700 text-lg hover:text-black transition-colors duration-200"
                >
                  1-888-526-1885 (VNSH)
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Form */}
        <section className="py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-4xl font-bold text-center mb-16 text-black tracking-wide">HAVE QUESTIONS?</h2>
              
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    type="text"
                    name="name"
                    placeholder="Name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="h-14 border-gray-300 text-base px-4 rounded-md focus:border-black focus:ring-black"
                    required
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
                </div>
                
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
                  className="min-h-40 border-gray-300 resize-none text-base px-4 py-3 rounded-md focus:border-black focus:ring-black"
                  rows={6}
                  required
                />
                
                <div className="flex justify-start">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-black hover:bg-gray-800 text-white px-12 py-4 font-semibold text-base rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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

export default Contact;