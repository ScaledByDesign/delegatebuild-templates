/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { getDefaultRegion, getRegionByCountry, MedusaRegion } from "@/services/medusa/regions";
import { useToast } from "@/hooks/use-toast";

type RegionContextType = {
  region: MedusaRegion | null;
  isLoading: boolean;
  setRegion: (region: MedusaRegion) => void;
  setRegionByCountry: (countryCode: string) => Promise<boolean>;
  formatPrice: (amount: number) => string;
  currencyCode: string;
};

const RegionContext = createContext<RegionContextType | undefined>(undefined);

export const RegionProvider = ({ children }: { children: React.ReactNode }) => {
  const [region, setRegionState] = useState<MedusaRegion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const initRegion = async () => {
      try {
        // Try to get region from localStorage first
        const savedRegionId = localStorage.getItem('medusa_region_id');
        if (savedRegionId && region?.id !== savedRegionId) {
          // For now, just get default region
          // In a full implementation, you'd fetch the specific region by ID
        }

        // Get default region
        const defaultRegion = await getDefaultRegion();
        if (defaultRegion) {
          setRegionState(defaultRegion);
          localStorage.setItem('medusa_region_id', defaultRegion.id);
        }
      } catch (error) {
        console.error("Error initializing region:", error);
        toast({
          variant: "destructive",
          title: "Region Error",
          description: "Failed to load region settings. Using default.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    initRegion();
  }, [toast, region]);

  const setRegion = (newRegion: MedusaRegion) => {
    setRegionState(newRegion);
    localStorage.setItem('medusa_region_id', newRegion.id);
  };

  const setRegionByCountry = async (countryCode: string): Promise<boolean> => {
    try {
      const foundRegion = await getRegionByCountry(countryCode);
      if (foundRegion) {
        setRegion(foundRegion);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error setting region by country:", error);
      return false;
    }
  };

  const formatPrice = (amount: number): string => {
    if (!region) return `$${amount.toFixed(2)}`;

    // API sends prices in dollars, no conversion needed

    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: region.currency_code.toUpperCase(),
      }).format(amount);
    } catch (error) {
      // Fallback to USD formatting
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
    }
  };

  const currencyCode = region?.currency_code?.toUpperCase() || 'USD';

  return (
    <RegionContext.Provider
      value={{
        region,
        isLoading,
        setRegion,
        setRegionByCountry,
        formatPrice,
        currencyCode,
      }}
    >
      {children}
    </RegionContext.Provider>
  );
};

// Safe fallback returned when the hook is used outside a RegionProvider, so a
// missing provider degrades gracefully (USD formatting) instead of crashing the
// whole app with a thrown error.
const fallbackRegion: RegionContextType = {
  region: null,
  isLoading: false,
  setRegion: () => {},
  setRegionByCountry: async () => false,
  formatPrice: (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount),
  currencyCode: "USD",
};

export const useRegion = () => {
  const context = useContext(RegionContext);
  if (context === undefined) {
    console.warn("useRegion used outside a RegionProvider; returning safe defaults.");
    return fallbackRegion;
  }
  return context;
};
