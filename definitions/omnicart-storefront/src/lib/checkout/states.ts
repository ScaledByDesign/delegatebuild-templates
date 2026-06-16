export type RegionOption = {
  code: string;
  name: string;
};

export type CountryOption = {
  code: string;
  name: string;
};

// US States list for form dropdowns (50 states + DC, no territories)
export const US_STATES: RegionOption[] = [
  { code: 'ak', name: 'Alaska' },
  { code: 'al', name: 'Alabama' },
  { code: 'az', name: 'Arizona' },
  { code: 'ar', name: 'Arkansas' },
  { code: 'ca', name: 'California' },
  { code: 'co', name: 'Colorado' },
  { code: 'ct', name: 'Connecticut' },
  { code: 'de', name: 'Delaware' },
  { code: 'dc', name: 'District of Columbia' },
  { code: 'fl', name: 'Florida' },
  { code: 'ga', name: 'Georgia' },
  { code: 'hi', name: 'Hawaii' },
  { code: 'id', name: 'Idaho' },
  { code: 'il', name: 'Illinois' },
  { code: 'in', name: 'Indiana' },
  { code: 'ia', name: 'Iowa' },
  { code: 'ks', name: 'Kansas' },
  { code: 'ky', name: 'Kentucky' },
  { code: 'la', name: 'Louisiana' },
  { code: 'me', name: 'Maine' },
  { code: 'md', name: 'Maryland' },
  { code: 'ma', name: 'Massachusetts' },
  { code: 'mi', name: 'Michigan' },
  { code: 'mn', name: 'Minnesota' },
  { code: 'ms', name: 'Mississippi' },
  { code: 'mo', name: 'Missouri' },
  { code: 'mt', name: 'Montana' },
  { code: 'ne', name: 'Nebraska' },
  { code: 'nv', name: 'Nevada' },
  { code: 'nh', name: 'New Hampshire' },
  { code: 'nj', name: 'New Jersey' },
  { code: 'nm', name: 'New Mexico' },
  { code: 'ny', name: 'New York' },
  { code: 'nc', name: 'North Carolina' },
  { code: 'nd', name: 'North Dakota' },
  { code: 'oh', name: 'Ohio' },
  { code: 'ok', name: 'Oklahoma' },
  { code: 'or', name: 'Oregon' },
  { code: 'pa', name: 'Pennsylvania' },
  { code: 'ri', name: 'Rhode Island' },
  { code: 'sc', name: 'South Carolina' },
  { code: 'sd', name: 'South Dakota' },
  { code: 'tn', name: 'Tennessee' },
  { code: 'tx', name: 'Texas' },
  { code: 'ut', name: 'Utah' },
  { code: 'vt', name: 'Vermont' },
  { code: 'va', name: 'Virginia' },
  { code: 'wa', name: 'Washington' },
  { code: 'wv', name: 'West Virginia' },
  { code: 'wi', name: 'Wisconsin' },
  { code: 'wy', name: 'Wyoming' },
];

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'us', name: 'United States' },
];

const REGION_MAP: Record<string, RegionOption[]> = {
  us: US_STATES,
};

export const getRegionsForCountry = (countryCode?: string): RegionOption[] => {
  if (!countryCode) {
    return [];
  }

  return REGION_MAP[countryCode.toLowerCase()] || [];
};

// Format phone number as (XXX) XXX-XXXX
export const formatPhoneNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
  if (!match) return value;

  const [, area, exchange, line] = match;
  if (!exchange) return area;
  if (!line) return `(${area}) ${exchange}`;
  return `(${area}) ${exchange}-${line}`;
};

// Format ZIP code as #####
export const formatZipCode = (value: string): string => {
  return value.replace(/\D/g, '').slice(0, 5);
};

// Format credit card as XXXX XXXX XXXX XXXX
export const formatCardNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  const groups = cleaned.match(/\d{1,4}/g) || [];
  return groups.join(' ').slice(0, 19);
};

// Capitalize first letter of each word (for names, cities, etc.)
export const capitalizeWords = (value: string): string => {
  return value
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Capitalize first letter only (for single words)
export const capitalizeFirst = (value: string): string => {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

// Format expiry date as MM/YY
export const formatExpiryDate = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 0) return '';
  if (cleaned.length <= 2) return cleaned;

  const month = cleaned.slice(0, 2);
  const year = cleaned.slice(2, 4);

  // Validate month (01-12)
  const monthNum = parseInt(month);
  if (monthNum > 12) {
    return cleaned.slice(0, 1);
  }

  return `${month}/${year}`;
};

// Format CVV (3-4 digits)
export const formatCvv = (value: string): string => {
  return value.replace(/\D/g, '').slice(0, 4);
};

// Validate ZIP code
export const isValidZipCode = (zip: string): boolean => {
  return /^\d{5}(-\d{4})?$/.test(zip.replace(/\D/g, ''));
};

// Validate phone number
export const isValidPhoneNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10;
};

// Validate card number (Luhn algorithm)
export const isValidCardNumber = (cardNumber: string): boolean => {
  const cleaned = cardNumber.replace(/\D/g, '');
  if (cleaned.length < 13 || cleaned.length > 19) return false;

  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned.charAt(i), 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
};

// Validate expiry date
export const isValidExpiryDate = (expiry: string): boolean => {
  const cleaned = expiry.replace(/\D/g, '');
  if (cleaned.length !== 4) return false;

  const month = parseInt(cleaned.slice(0, 2), 10);
  const year = parseInt(cleaned.slice(2, 4), 10);

  if (month < 1 || month > 12) return false;

  const currentYear = new Date().getFullYear() % 100;
  const currentMonth = new Date().getMonth() + 1;

  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;

  return true;
};

// Validate CVV
export const isValidCvv = (cvv: string): boolean => {
  const cleaned = cvv.replace(/\D/g, '');
  return cleaned.length >= 3 && cleaned.length <= 4;
};

/**
 * Normalize state input to 2-letter state code
 * Handles both full state names ("Texas") and codes ("TX", "tx")
 * Used for Express Checkout (Apple Pay/Google Pay) which may send either format
 *
 * @param stateInput - Either "Texas" or "TX" or "tx"
 * @returns 2-letter lowercase state code ("tx") or null if not found
 */
export const normalizeStateCode = (stateInput: string | undefined): string | null => {
  if (!stateInput) return null;

  const cleaned = stateInput.trim().toLowerCase();

  // Check if it's already a 2-letter code
  const directMatch = US_STATES.find(state => state.code === cleaned);
  if (directMatch) {
    return directMatch.code;
  }

  // Check if it's a full state name
  const nameMatch = US_STATES.find(
    state => state.name.toLowerCase() === cleaned
  );
  if (nameMatch) {
    return nameMatch.code;
  }

  // Log warning if state not found
  console.warn(`⚠️ Could not normalize state: "${stateInput}"`);
  return null;
};
