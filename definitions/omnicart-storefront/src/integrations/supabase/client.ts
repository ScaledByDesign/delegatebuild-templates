// Supabase client configuration
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Resolve config from the RUNTIME window globals first (the platform injects
// `window.VITE_*` at deploy, which is how credentials arrive when a workspace is
// linked AFTER the app was built — build-time `import.meta.env` would be empty in
// that case), then fall back to build-time env vars. Accept the common key-name
// variants so whichever the platform injects (`SUPABASE_ANON_KEY` →
// `VITE_SUPABASE_ANON_KEY`, or `…PUBLISHABLE_KEY`) is picked up.
const readEnv = (...keys: string[]): string | undefined => {
  for (const k of keys) {
    if (typeof window !== 'undefined') {
      const w = (window as unknown as Record<string, unknown>)[k];
      if (typeof w === 'string' && w) return w;
    }
    const v = (import.meta.env as Record<string, string | undefined>)[k];
    if (v) return v;
  }
  return undefined;
};

const SUPABASE_URL = readEnv(
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PROJECT_URL',
  // Raw connector / framework names the platform may inject verbatim at runtime.
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
);
const SUPABASE_PUBLISHABLE_KEY = readEnv(
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_KEY',
  // Raw connector / framework names the platform may inject verbatim at runtime.
  'SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
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