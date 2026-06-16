import React, { useState, useEffect, useRef } from 'react';
import { updateShippingAddressWithTaxes } from '@/lib/data/checkout';
import { capitalizeWords } from '@/lib/checkout/states';

interface ShippingAddressFormProps {
  cartId: string;
  onAddressComplete?: (cart: any) => void;
  onAddressChange?: (isComplete: boolean) => void;
  onTaxCalculationReady?: (cart: any) => void;
  onStateChange?: (stateCode: string) => void;
}

// US States for dropdown
const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
];

export const ShippingAddressForm: React.FC<ShippingAddressFormProps> = ({
  cartId,
  onAddressComplete,
  onAddressChange,
  onTaxCalculationReady,
  onStateChange,
}) => {
  // Form state (no email - handled separately in parent)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSyncing, setIsSyncing] = useState(false);

  // Track if we've sent a partial address for tax calculation (without full address_1)
  // This prevents overwriting a complete address with a partial one
  const lastSyncedAddressRef = useRef<string | null>(null);

  // Use refs to store callbacks to avoid infinite loops
  const onAddressCompleteRef = useRef(onAddressComplete);
  const onAddressChangeRef = useRef(onAddressChange);
  const onTaxCalculationReadyRef = useRef(onTaxCalculationReady);
  const onStateChangeRef = useRef(onStateChange);
  const taxCalculatedRef = useRef(false);

  // Update refs when callbacks change
  useEffect(() => {
    onAddressCompleteRef.current = onAddressComplete;
    onAddressChangeRef.current = onAddressChange;
    onTaxCalculationReadyRef.current = onTaxCalculationReady;
    onStateChangeRef.current = onStateChange;
  }, [onAddressComplete, onAddressChange, onTaxCalculationReady, onStateChange]);

  // Stripe-matching input styles
  const inputClassName = `
    w-full px-3 py-2.5 
    bg-white
    border border-gray-300 rounded
    text-[#262626] 
    font-[system-ui,-apple-system,sans-serif]
    leading-[1.5]
    text-[15px]
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-[#176326] focus:border-[#176326]
    disabled:bg-gray-50 disabled:cursor-not-allowed
    placeholder:text-gray-400
  `.trim().replace(/\s+/g, ' ');

  const errorInputClassName = inputClassName.replace('border-gray-300', 'border-[#df1c41]');

  const labelClassName = 'block text-sm font-medium text-[#262626] mb-1.5';
  const errorClassName = 'text-[#df1c41] text-xs mt-1';

  // Validation functions
  const validatePhone = (value: string) => {
    if (!value) return 'Phone is required';
    const phoneRegex = /^[\d\s\-\(\)]+$/;
    if (!phoneRegex.test(value) || value.replace(/\D/g, '').length < 10) {
      return 'Please enter a valid phone number';
    }
    return '';
  };

  const validateZip = (value: string) => {
    if (!value) return 'ZIP code is required';
    const zipRegex = /^\d{5}(-\d{4})?$/;
    if (!zipRegex.test(value)) return 'Please enter a valid ZIP code';
    return '';
  };

  const validateRequired = (value: string, fieldName: string) => {
    if (!value.trim()) return `${fieldName} is required`;
    return '';
  };

  // Check if form is complete (inline to avoid dependency issues)
  const isFormComplete = () => {
    return !!(
      name && phone && address1 && city && state && zip &&
      !validatePhone(phone) &&
      !validateZip(zip)
    );
  };

  // Check if we have minimum fields for tax calculation
  const hasMinimumForTax = () => {
    return !!(state && zip && !validateZip(zip));
  };

  // Early tax calculation when state + zip are filled
  // IMPORTANT: We use a placeholder address_1 to avoid overwriting real address data
  // This ensures orders always have a valid address_1 even if completed during tax calculation
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!hasMinimumForTax()) return;

      // If already have full address, skip this (full address effect will handle it)
      if (isFormComplete()) return;

      // If we already synced a complete address, don't overwrite with partial data
      if (lastSyncedAddressRef.current && lastSyncedAddressRef.current.length > 0) {
        console.log('⏭️ Skipping early tax calc - complete address already synced');
        return;
      }

      setIsSyncing(true);
      try {
        console.log('💰 Calculating tax for state + zip...');

        // Use current address1 value if available, otherwise use a placeholder
        // This prevents orders from having empty address_1 if completed during this phase
        const currentAddress1 = address1.trim() || 'Address pending';

        const taxAddress = {
          first_name: name.trim().split(' ')[0] || 'Customer',
          last_name: name.trim().split(' ').slice(1).join(' ') || '',
          address_1: currentAddress1,
          city: city.trim() || 'City pending',
          province: `us-${state.toLowerCase()}`,
          postal_code: zip,
          country_code: 'us',
          phone: phone || '',
        };

        const updatedCart = await updateShippingAddressWithTaxes(cartId, taxAddress);
        taxCalculatedRef.current = true; // Mark that tax was calculated
        console.log('✅ Tax calculated for state:', state);

        onTaxCalculationReadyRef.current?.(updatedCart);
      } catch (error) {
        console.error('❌ Failed to calculate tax:', error);
      } finally {
        setIsSyncing(false);
      }
    }, 500); // Faster debounce for tax (500ms vs 800ms for full address)

    return () => clearTimeout(timer);
  }, [state, zip, cartId, address1, city, name, phone]);

  // Debounced sync with Medusa - OPTIMIZED: Single call updates address + calculates taxes
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!isFormComplete()) {
        onAddressChangeRef.current?.(false);
        taxCalculatedRef.current = false; // Reset flag
        lastSyncedAddressRef.current = null; // Clear synced address when form becomes incomplete
        return;
      }

      // Split name into first and last.
      // NOTE: when only one word is entered we leave last_name empty rather than
      // copying the first name into it — duplicating it produced bogus customer
      // records like "Henry Henry" / doubled last names downstream.
      const nameParts = name.trim().split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ');

      // Update shipping address + calculate taxes in one optimized call
      const medusaAddress = {
        first_name: firstName,
        last_name: lastName,
        address_1: address1,
        address_2: address2 || undefined,
        city: city,
        province: `us-${state.toLowerCase()}`,
        postal_code: zip,
        country_code: 'us',
        phone: phone,
      };

      // Check if we need to sync (address changed or tax was calculated with partial data)
      const addressKey = JSON.stringify(medusaAddress);
      if (lastSyncedAddressRef.current === addressKey && !taxCalculatedRef.current) {
        console.log('⏭️ Skipping sync - address unchanged');
        return;
      }

      setIsSyncing(true);
      try {
        console.log('🏠 Syncing complete address with Medusa...');

        const updatedCart = await updateShippingAddressWithTaxes(cartId, medusaAddress);

        // Mark that we've synced a complete address
        lastSyncedAddressRef.current = addressKey;
        taxCalculatedRef.current = false; // Reset tax flag

        console.log('✅ Complete address synced + taxes calculated');

        onAddressChangeRef.current?.(true);
        onAddressCompleteRef.current?.(updatedCart);
      } catch (error) {
        console.error('❌ Failed to sync address:', error);
      } finally {
        setIsSyncing(false);
      }
    }, 800); // Debounce 800ms

    return () => clearTimeout(timer);
  }, [name, phone, address1, address2, city, state, zip, cartId]);

  return (
    <div className="space-y-4">
      {/* Full Name */}
      <div>
        <label htmlFor="full-name" className={labelClassName}>
          Full name
        </label>
        <input
          id="full-name"
          name="name"
          type="text"
          value={name}
          onChange={(e) => {
            const formatted = capitalizeWords(e.target.value);
            setName(formatted);
            setErrors({ ...errors, name: '' });
          }}
          onBlur={(e) => {
            const error = validateRequired(e.target.value, 'Name');
            if (error) setErrors({ ...errors, name: error });
          }}
          className={errors.name ? errorInputClassName : inputClassName}
          placeholder="John Doe"
          autoComplete="name"
        />
        {errors.name && <p className={errorClassName}>{errors.name}</p>}
      </div>

      {/* Address Line 1 */}
      <div>
        <label htmlFor="address-line1" className={labelClassName}>
          Address
        </label>
        <input
          id="address-line1"
          name="address-line1"
          type="text"
          value={address1}
          onChange={(e) => {
            const formatted = capitalizeWords(e.target.value);
            setAddress1(formatted);
            setErrors({ ...errors, address1: '' });
          }}
          onBlur={(e) => {
            const error = validateRequired(e.target.value, 'Address');
            if (error) setErrors({ ...errors, address1: error });
          }}
          className={errors.address1 ? errorInputClassName : inputClassName}
          placeholder="354 Oyster Point Blvd"
          autoComplete="address-line1"
        />
        {errors.address1 && <p className={errorClassName}>{errors.address1}</p>}
      </div>

      {/* Address Line 2 */}
      <div>
        <label htmlFor="address-line2" className={labelClassName}>
          Apartment, suite, etc. (optional)
        </label>
        <input
          id="address-line2"
          name="address-line2"
          type="text"
          value={address2}
          onChange={(e) => {
            const formatted = capitalizeWords(e.target.value);
            setAddress2(formatted);
          }}
          className={inputClassName}
          placeholder="Apt 4B"
          autoComplete="address-line2"
        />
      </div>

      {/* City */}
      <div>
        <label htmlFor="city" className={labelClassName}>
          City
        </label>
        <input
          id="city"
          name="address-level2"
          type="text"
          value={city}
          onChange={(e) => {
            const formatted = capitalizeWords(e.target.value);
            setCity(formatted);
            setErrors({ ...errors, city: '' });
          }}
          onBlur={(e) => {
            const error = validateRequired(e.target.value, 'City');
            if (error) setErrors({ ...errors, city: error });
          }}
          className={errors.city ? errorInputClassName : inputClassName}
          placeholder="South San Francisco"
          autoComplete="address-level2"
        />
        {errors.city && <p className={errorClassName}>{errors.city}</p>}
      </div>

      {/* State and ZIP in a grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* State */}
        <div>
          <label htmlFor="state" className={labelClassName}>
            State
          </label>
          <select
            id="state"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setErrors({ ...errors, state: '' });
              onStateChangeRef.current?.(e.target.value);
            }}
            onBlur={(e) => {
              const error = validateRequired(e.target.value, 'State');
              if (error) setErrors({ ...errors, state: error });
            }}
            name="address-level1"
            className={errors.state ? errorInputClassName : inputClassName}
            autoComplete="address-level1"
          >
            <option value="">Select</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
          {errors.state && <p className={errorClassName}>{errors.state}</p>}
        </div>

        {/* ZIP Code */}
        <div>
          <label htmlFor="zip" className={labelClassName}>
            ZIP code
          </label>
          <input
            id="zip"
            name="postal-code"
            type="text"
            value={zip}
            onChange={(e) => {
              setZip(e.target.value);
              setErrors({ ...errors, zip: '' });
            }}
            onBlur={(e) => {
              const error = validateZip(e.target.value);
              if (error) setErrors({ ...errors, zip: error });
            }}
            className={errors.zip ? errorInputClassName : inputClassName}
            placeholder="94080"
            autoComplete="postal-code"
          />
          {errors.zip && <p className={errorClassName}>{errors.zip}</p>}
        </div>
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className={labelClassName}>
          Phone number
        </label>
        <input
          id="phone"
          name="tel"
          type="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setErrors({ ...errors, phone: '' });
          }}
          onBlur={(e) => {
            const error = validatePhone(e.target.value);
            if (error) setErrors({ ...errors, phone: error });
          }}
          className={errors.phone ? errorInputClassName : inputClassName}
          placeholder="(201) 555-0123"
          autoComplete="tel"
        />
        {errors.phone && <p className={errorClassName}>{errors.phone}</p>}
      </div>

      {/* Syncing indicator */}
      {isSyncing && (
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#176326]"></div>
          Calculating tax and shipping...
        </div>
      )}
    </div>
  );
};

