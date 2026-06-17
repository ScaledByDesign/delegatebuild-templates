/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { 
  loginCustomer, 
  registerCustomer, 
  getCustomer, 
  logoutCustomer, 
  updateCustomer 
} from "@/lib/data/customer";
import { useToast } from "@/hooks/use-toast";

export interface Address {
  id?: string;
  first_name?: string;
  last_name?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country_code?: string;
  phone?: string;
}

export type Customer = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  billing_address?: Address;
  shipping_addresses?: Address[];
} | null;

type CustomerContextType = {
  customer: Customer;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (data: Record<string, unknown>) => Promise<boolean>;
  refreshCustomer: () => Promise<void>;
};

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export const CustomerProvider = ({ children }: { children: React.ReactNode }) => {
  const [customer, setCustomer] = useState<Customer>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const isAuthenticated = !!customer;

  useEffect(() => {
    const initCustomer = async () => {
      try {
        const customerData = await getCustomer();
        setCustomer(customerData);
      } catch (error) {
        console.error("Error initializing customer:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initCustomer();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const customerData = await loginCustomer(email, password);
      setCustomer(customerData);
      toast({
        title: "Welcome back!",
        description: "You have been logged in successfully.",
      });
      return true;
    } catch (error) {
      console.error("Error logging in:", error);
      toast({
        variant: "destructive",
        title: "Login failed",
        description: "Invalid email or password. Please try again.",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string, 
    password: string, 
    firstName: string, 
    lastName: string
  ): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const customerData = await registerCustomer(email, password, firstName, lastName);
      setCustomer(customerData);
      toast({
        title: "Account created!",
        description: "Your account has been created successfully.",
      });
      return true;
    } catch (error) {
      console.error("Error registering:", error);
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: "Unable to create account. Please try again.",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    
    try {
      await logoutCustomer();
      setCustomer(null);
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
    } catch (error) {
      console.error("Error logging out:", error);
      // Still clear the customer state even if API call fails
      setCustomer(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: Record<string, unknown>): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const updatedCustomer = await updateCustomer(data);
      if (updatedCustomer) {
        setCustomer(updatedCustomer);
        toast({
          title: "Profile updated",
          description: "Your profile has been updated successfully.",
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Unable to update profile. Please try again.",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshCustomer = async (): Promise<void> => {
    try {
      const customerData = await getCustomer();
      setCustomer(customerData);
    } catch (error) {
      console.error("Error refreshing customer:", error);
    }
  };

  return (
    <CustomerContext.Provider
      value={{
        customer,
        isLoading,
        isAuthenticated,
        login,
        register,
        logout,
        updateProfile,
        refreshCustomer,
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
};

// Safe fallback returned when the hook is used outside a CustomerProvider, so a
// missing provider degrades gracefully (logged-out state) instead of crashing.
const fallbackCustomer: CustomerContextType = {
  customer: null,
  isLoading: false,
  isAuthenticated: false,
  login: async () => false,
  register: async () => false,
  logout: async () => {},
  updateProfile: async () => false,
  refreshCustomer: async () => {},
};

export const useCustomer = () => {
  const context = useContext(CustomerContext);
  if (context === undefined) {
    console.warn("useCustomer used outside a CustomerProvider; returning safe defaults.");
    return fallbackCustomer;
  }
  return context;
};
