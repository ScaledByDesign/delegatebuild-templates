import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Mail, ArrowLeft } from 'lucide-react';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Email is required.",
      });
      return;
    }

    setIsLoading(true);

    try {
      // TODO: Implement password reset functionality with Medusa
      // For now, just simulate the request
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setIsSubmitted(true);
      toast({
        title: "Reset link sent",
        description: "If an account with that email exists, we've sent a password reset link.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Unable to send reset link. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-vnsh-lightgray flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-vnsh-dark mb-4">Check Your Email</h2>
            <p className="text-gray-600 mb-6">
              If an account with <strong>{email}</strong> exists, we've sent a password reset link to your email address.
            </p>
            
            <div className="space-y-4">
              <Button
                onClick={() => {
                  setIsSubmitted(false);
                  setEmail('');
                }}
                variant="outline"
                className="w-full"
              >
                Try Another Email
              </Button>
              
              <Link to="/login">
                <Button className="w-full bg-vnsh-green hover:bg-[#0f4a1c]">
                  Back to Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vnsh-lightgray flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <img 
              src="/lovable-uploads/060fc0ae-7c76-4b9d-84bf-ef2ccf5c7704.png" 
              alt="VNSH Logo" 
              className="h-12 w-auto mx-auto mb-2"
            />
          </Link>
          <p className="text-gray-600">Premium Tactical Holsters</p>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-vnsh-dark mb-2">Forgot Password?</h2>
            <p className="text-gray-600">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                type="email"
                name="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10 h-12"
                autoComplete="email"
              />
            </div>
            
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-vnsh-red hover:bg-[#0f4a1c] text-white py-3 rounded-md font-medium transition-colors h-12"
            >
              {isLoading ? 'Sending Reset Link...' : 'Send Reset Link'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-vnsh-red hover:text-red-700 font-medium flex items-center justify-center"
            >
              <ArrowLeft size={16} className="mr-2" />
              Back to Sign In
            </Link>
          </div>
        </div>

        {/* Additional Help */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 text-sm">
            Need help? Contact us at{" "}
            <a href="mailto:customercare@vnsh.com" className="text-vnsh-red hover:text-red-700">
              customercare@vnsh.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
