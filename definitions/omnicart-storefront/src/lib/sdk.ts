import Medusa from "@medusajs/js-sdk"

// Function to get environment variables that works in both browser and Node.js
function getEnvVar(key: string): string | undefined {
  // Browser environment (Vite)
  if (typeof window !== 'undefined' && import.meta?.env) {
    return import.meta.env[key]
  }

  // Node.js environment
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key]
  }

  return undefined
}

const isBrowser = typeof window !== 'undefined'

// Determine the OmniCart backend URL
const explicitBackendUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OMNICART_BACKEND_URL) ||
  (process.env.OMNICART_BACKEND_URL) ||
  undefined

export const OMNICART_BACKEND_URL = isBrowser ? '/api/omnicart' : (explicitBackendUrl || 'https://vnsh.omnicart.cc');

const OMNICART_PUBLISHABLE_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OMNICART_PUBLISHABLE_KEY) ||
  (process.env.OMNICART_PUBLISHABLE_KEY) ||
  'pk_bfeb37dbcbc6e9cd7d9dc3e44a2dc89160c74de9c8cd1d4fb38c88d30cda1d20'


console.log('OmniCart JS SDK Configuration:', {
  baseUrl: OMNICART_BACKEND_URL,
  publishableKey: OMNICART_PUBLISHABLE_KEY ? `${OMNICART_PUBLISHABLE_KEY.substring(0, 10)}...` : 'undefined',
  debug: import.meta.env?.MODE === 'development'
})

export const sdk = new Medusa({
  baseUrl: OMNICART_BACKEND_URL,
  debug: import.meta.env?.MODE === 'development',
  publishableKey: OMNICART_PUBLISHABLE_KEY,
})

