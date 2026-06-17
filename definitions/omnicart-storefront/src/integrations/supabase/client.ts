// Supabase client configuration
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { readPublicEnv } from '@/lib/public-env';

// Resolve config via the shared public-env resolver, which normalizes the
// VITE_/NEXT_PUBLIC_/raw name variants across window globals and build-time env,
// so whichever shape the platform injects for the connected Supabase workspace
// is picked up.
const SUPABASE_URL = readPublicEnv('SUPABASE_URL', 'SUPABASE_PROJECT_URL');
const SUPABASE_PUBLISHABLE_KEY = readPublicEnv(
  'SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_KEY',
);

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('🚨 Supabase configuration missing:', {
    hasUrl: !!SUPABASE_URL,
    hasKey: !!SUPABASE_PUBLISHABLE_KEY,
  });
}

// Safe localStorage wrapper that handles private browsing mode
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silently fail in private browsing mode
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently fail in private browsing mode
    }
  },
};

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

let supabase: SupabaseClient;

// Check if configuration is missing and use mock client immediately
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn('🚨 Supabase configuration missing. App will use mock client.');
  supabase = {
    from: () => ({
      select: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      insert: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      update: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      delete: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
    }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  } as unknown as SupabaseClient;
} else {
  try {
    supabase = createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          storage: safeStorage,
          persistSession: true,
          autoRefreshToken: true,
        }
      }
    );
  } catch (error) {
    console.error('🚨 Failed to create Supabase client:', error);
    // Create a minimal mock client that won't crash the app
    supabase = {
      from: () => ({
        select: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        insert: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        update: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        delete: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      }),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
    } as unknown as SupabaseClient;
  }
}

export { supabase };