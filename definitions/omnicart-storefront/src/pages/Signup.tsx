import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useCustomer } from '@/hooks/useCustomer';
import { Shield, Users, Award, Mail, Lock, Eye, EyeOff, User, Phone } from 'lucide-react';

const Signup = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const { toast } = useToast();
  const { register, isAuthenticated } = useCustomer();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/account', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.firstName.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "First name is required.",
      });
      return false;
    }

    if (!formData.lastName.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Last name is required.",
      });
      return false;
    }

    if (!formData.email.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Email is required.",
      });
      return false;
    }

    if (formData.password.length < 8) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Password must be at least 8 characters long.",
      });
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Passwords do not match.",
      });
      return false;
    }

    if (!acceptTerms) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "You must accept the terms and conditions.",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const success = await register(
        formData.email,
        formData.password,
        formData.firstName,
        formData.lastName
      );
      
      if (success) {
        navigate('/account', { replace: true });
      }
    } catch (error) {
      console.error('Registration error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-vnsh-lightgray">
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex bg-vnsh-dark text-white p-12 flex-col justify-center">
          <div className="max-w-md">
            <h1 className="text-4xl font-bold mb-6">Join the VNSH Community</h1>
            <p className="text-xl mb-8 text-gray-300">
              Create your account and join thousands of professionals who trust VNSH for their tactical gear needs.
            </p>
            
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <Shield className="text-vnsh-red mt-1" size={24} />
                <div>
                  <h3 className="font-semibold mb-1">Lifetime Warranty</h3>
                  <p className="text-gray-300 text-sm">
                    All products backed by our no-questions-asked lifetime warranty.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <Users className="text-vnsh-red mt-1" size={24} />
                <div>
                  <h3 className="font-semibold mb-1">Exclusive Member Benefits</h3>
                  <p className="text-gray-300 text-sm">
                    Early access to new products, special discounts, and member-only content.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <Award className="text-vnsh-red mt-1" size={24} />
                <div>
                  <h3 className="font-semibold mb-1">Premium Quality</h3>
                  <p className="text-gray-300 text-sm">
                    Engineered with the finest materials for maximum durability and performance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Signup Form */}
        <div className="flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
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
                <h2 className="text-2xl font-bold text-vnsh-dark mb-2">Create Your Account</h2>
                <p className="text-gray-600">
                  Join the VNSH community and get access to exclusive member benefits.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      type="text"
                      name="firstName"
                      placeholder="First Name"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      className="pl-10 h-12"
                      autoComplete="given-name"
                    />
                  </div>
                  
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      type="text"
                      name="lastName"
                      placeholder="Last Name"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      className="pl-10 h-12"
                      autoComplete="family-name"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      type="email"
                      name="email"
                      placeholder="Email Address"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="pl-10 h-12"
                      autoComplete="email"
                    />
                  </div>

                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      type="tel"
                      name="phone"
                      placeholder="Phone Number (Optional)"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="pl-10 h-12"
                      autoComplete="tel"
                    />
                  </div>
                  
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      className="pl-10 pr-10 h-12"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      placeholder="Confirm Password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      required
                      className="pl-10 pr-10 h-12"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="acceptTerms"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-1 rounded border-gray-300 text-vnsh-red focus:ring-vnsh-red"
                    required
                  />
                  <label htmlFor="acceptTerms" className="text-sm text-gray-600 leading-relaxed">
                    I agree to the{" "}
                    <Link to="/pages/terms-disclaimer" className="text-vnsh-red hover:text-red-700 underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link to="/pages/privacy-policy" className="text-vnsh-red hover:text-red-700 underline">
                      Privacy Policy
                    </Link>
                  </label>
                </div>
                
                <Button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-vnsh-red hover:bg-[#0f4a1c] text-white py-3 rounded-md font-medium transition-colors h-12"
                >
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-gray-600">
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    className="text-vnsh-red hover:text-red-700 font-medium"
                  >
                    Sign In
                  </Link>
                </p>
              </div>
            </div>

            {/* Additional Info for Mobile */}
            <div className="lg:hidden mt-8 text-center space-y-4">
              <div className="flex items-center justify-center space-x-2 text-gray-600">
                <Shield size={16} className="text-vnsh-red" />
                <span className="text-sm">Lifetime Warranty</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-gray-600">
                <Users size={16} className="text-vnsh-red" />
                <span className="text-sm">Exclusive Member Benefits</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-gray-600">
                <Award size={16} className="text-vnsh-red" />
                <span className="text-sm">Premium Quality</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
