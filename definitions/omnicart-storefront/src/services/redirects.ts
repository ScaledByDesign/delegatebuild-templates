import { supabase } from '@/integrations/supabase/client';

export interface Redirect {
  id: string;
  source_path: string;
  destination_path: string;
  redirect_type: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  notes?: string;
}

export interface CreateRedirectInput {
  source_path: string;
  destination_path: string;
  redirect_type?: number;
  is_active?: boolean;
  notes?: string;
}

export interface UpdateRedirectInput {
  source_path?: string;
  destination_path?: string;
  redirect_type?: number;
  is_active?: boolean;
  notes?: string;
}

// In-memory cache for active redirects (Map for O(1) lookup)
let redirectsCache: Map<string, Redirect> | null = null;
// Secondary cache for redirects whose source includes a query string.
// Keyed by normalized "path?sortedquery" so a product variant URL like
// /products/vnsh-holster?color=American Flag&size=Regular can be matched
// even though the primary path-only cache cannot represent it.
let redirectsQueryCache: Map<string, Redirect> | null = null;
let cacheInitialized = false;
let cacheInitPromise: Promise<void> | null = null;

// LocalStorage cache keys (must match inline script in index.html)
const CACHE_KEY = 'vnsh_redirects_cache';
const CACHE_VERSION_KEY = 'vnsh_redirects_cache_version';
const CACHE_VERSION = '1';

/**
 * Get all redirects
 */
export async function getAllRedirects(): Promise<Redirect[]> {
  const { data, error } = await supabase
    .from('redirects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching redirects:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get active redirects only
 */
export async function getActiveRedirects(): Promise<Redirect[]> {
  const { data, error } = await supabase
    .from('redirects')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching active redirects:', error);
    throw error;
  }

  return data || [];
}

/**
 * Save redirects to localStorage for pre-React redirect checker
 */
function saveToLocalStorage(redirects: Redirect[]): void {
  try {
    const cacheData = {
      timestamp: Date.now(),
      redirects: redirects.reduce((acc, redirect) => {
        acc[redirect.source_path] = {
          destination_path: redirect.destination_path,
          redirect_type: redirect.redirect_type
        };
        return acc;
      }, {} as Record<string, { destination_path: string; redirect_type: number }>)
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
    console.log(`💾 Saved ${redirects.length} redirects to localStorage cache`);
  } catch (error) {
    console.error('Error saving redirects to localStorage:', error);
  }
}

/**
 * Initialize the redirects cache
 * Loads all active redirects into memory for instant lookups
 * Also saves to localStorage for pre-React redirect checker
 */
async function initializeCache(): Promise<void> {
  if (cacheInitialized) return;

  // If cache is already being initialized, wait for it
  if (cacheInitPromise) {
    return cacheInitPromise;
  }

  cacheInitPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('redirects')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('Error initializing redirects cache:', error);
        throw error;
      }

      // Build the in-memory cache maps
      redirectsCache = new Map();
      redirectsQueryCache = new Map();
      if (data) {
        data.forEach(redirect => {
          // Primary path-only cache (back-compat: keep original source key)
          redirectsCache!.set(redirect.source_path, redirect);

          // If the source carries a query string (or is an absolute URL with
          // one), also index it under a normalized path?sortedquery key so it
          // can be matched on live routes like /products/:handle.
          const sourceKey = buildSourceKey(redirect.source_path);
          if (sourceKey.includes('?')) {
            redirectsQueryCache!.set(sourceKey, redirect);
          } else {
            // Also normalize plain-path sources (e.g. absolute URLs) into the
            // primary cache so they resolve by pathname.
            redirectsCache!.set(sourceKey, redirect);
          }
        });

        // Save to localStorage for pre-React redirect checker
        saveToLocalStorage(data);
      }

      cacheInitialized = true;
      console.log(`Redirects cache initialized with ${redirectsCache.size} active redirects`);
    } catch (error) {
      console.error('Failed to initialize redirects cache:', error);
      // Don't set cacheInitialized to true on error, allow retry
      cacheInitPromise = null;
      throw error;
    }
  })();

  return cacheInitPromise;
}

/**
 * Invalidate the cache (call this after creating/updating/deleting redirects)
 */
export function invalidateRedirectsCache(): void {
  redirectsCache = null;
  redirectsQueryCache = null;
  cacheInitialized = false;
  cacheInitPromise = null;
}

/**
 * Find redirect by source path (with caching for instant lookups)
 */
export async function findRedirectBySourcePath(sourcePath: string): Promise<Redirect | null> {
  // Normalize the path (remove trailing slash, ensure leading slash)
  const normalizedPath = normalizePath(sourcePath);

  // Initialize cache if not already done
  if (!cacheInitialized) {
    try {
      await initializeCache();
    } catch (error) {
      // If cache init fails, fall back to direct query
      console.warn('Cache initialization failed, falling back to direct query');
      const { data, error: queryError } = await supabase
        .from('redirects')
        .select('*')
        .eq('source_path', normalizedPath)
        .eq('is_active', true)
        .single();

      if (queryError) {
        if (queryError.code === 'PGRST116') {
          return null;
        }
        console.error('Error finding redirect:', queryError);
        throw queryError;
      }

      return data;
    }
  }

  // Use cache for instant lookup
  return redirectsCache?.get(normalizedPath) || null;
}

/**
 * Create a new redirect
 */
export async function createRedirect(input: CreateRedirectInput): Promise<Redirect> {
  const normalizedInput = {
    ...input,
    source_path: normalizePath(input.source_path),
    redirect_type: input.redirect_type || 301,
    is_active: input.is_active !== undefined ? input.is_active : true,
  };

  const { data, error } = await supabase
    .from('redirects')
    .insert([normalizedInput])
    .select()
    .single();

  if (error) {
    console.error('Error creating redirect:', error);
    throw error;
  }

  // Invalidate cache so it gets refreshed on next lookup
  invalidateRedirectsCache();

  return data;
}

/**
 * Update an existing redirect
 */
export async function updateRedirect(id: string, input: UpdateRedirectInput): Promise<Redirect> {
  const updateData: any = { ...input };

  if (input.source_path) {
    updateData.source_path = normalizePath(input.source_path);
  }

  const { data, error } = await supabase
    .from('redirects')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating redirect:', error);
    throw error;
  }

  // Invalidate cache so it gets refreshed on next lookup
  invalidateRedirectsCache();

  return data;
}

/**
 * Delete a redirect
 */
export async function deleteRedirect(id: string): Promise<void> {
  const { error } = await supabase
    .from('redirects')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting redirect:', error);
    throw error;
  }

  // Invalidate cache so it gets refreshed on next lookup
  invalidateRedirectsCache();
}

/**
 * Bulk import redirects from CSV data
 */
export async function bulkImportRedirects(redirects: CreateRedirectInput[]): Promise<{ success: number; failed: number; errors: any[] }> {
  let success = 0;
  let failed = 0;
  const errors: any[] = [];

  for (const redirect of redirects) {
    try {
      await createRedirect(redirect);
      success++;
    } catch (error) {
      failed++;
      errors.push({ redirect, error });
    }
  }

  return { success, failed, errors };
}

/**
 * Normalize path to ensure consistency
 * - Ensures leading slash
 * - Removes trailing slash (except for root)
 * - Converts to lowercase for case-insensitive matching
 */
function normalizePath(path: string): string {
  let normalized = path.trim();

  // Strip a full-origin prefix (e.g. https://vnsh.com/...) down to the path,
  // so sources stored as absolute URLs in the admin still match by pathname.
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    try {
      const url = new URL(normalized);
      normalized = url.pathname + url.search;
    } catch {
      // Leave as-is if it isn't a parseable URL
    }
  }

  // Separate the query string before path normalization
  const queryIndex = normalized.indexOf('?');
  const query = queryIndex >= 0 ? normalized.slice(queryIndex) : '';
  let pathPart = queryIndex >= 0 ? normalized.slice(0, queryIndex) : normalized;

  pathPart = pathPart.trim();

  // Ensure leading slash for relative paths
  if (!pathPart.startsWith('/')) {
    pathPart = '/' + pathPart;
  }

  // Remove trailing slash (except for root path)
  if (pathPart.length > 1 && pathPart.endsWith('/')) {
    pathPart = pathPart.slice(0, -1);
  }

  return pathPart + query;
}

/**
 * Build a stable lookup key from a path and a query string.
 * Query params are sorted so key order in the URL doesn't matter, and values
 * are decoded so "American+Flag" and "American%20Flag" both match "American Flag".
 * Returns just the normalized path when there is no query.
 */
function buildPathQueryKey(pathname: string, search: string): string {
  const path = normalizePath(pathname).split('?')[0];

  const raw = (search || '').replace(/^\?/, '');
  if (!raw) return path;

  const params = new URLSearchParams(raw);
  const entries = Array.from(params.entries())
    .map(([k, v]) => [k.toLowerCase(), v] as [string, string])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  if (entries.length === 0) return path;

  const sorted = new URLSearchParams();
  entries.forEach(([k, v]) => sorted.append(k, v));
  return `${path}?${sorted.toString()}`;
}

/**
 * Normalize a stored redirect source (path or absolute URL, possibly with a
 * query string) into the same canonical "path?sortedquery" key used at lookup.
 */
function buildSourceKey(source: string): string {
  const normalized = normalizePath(source);
  const queryIndex = normalized.indexOf('?');
  if (queryIndex < 0) {
    return normalized;
  }
  return buildPathQueryKey(normalized.slice(0, queryIndex), normalized.slice(queryIndex));
}

/**
 * Find a redirect whose source includes a query string, matching the current
 * location's path + query. Returns null if no query-bearing redirect matches.
 * The path-only system (findRedirectBySourcePath) remains the path-only path.
 */
export async function findRedirectByPathAndQuery(
  pathname: string,
  search: string
): Promise<Redirect | null> {
  if (!search || search === '?') {
    return null;
  }

  if (!cacheInitialized) {
    try {
      await initializeCache();
    } catch {
      return null;
    }
  }

  const key = buildPathQueryKey(pathname, search);
  return redirectsQueryCache?.get(key) || null;
}

