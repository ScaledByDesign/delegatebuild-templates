/**
 * Pre-React Redirect Checker with LocalStorage Cache
 *
 * Strategy:
 * 1. Check localStorage cache first (synchronous, instant)
 * 2. If found in cache, redirect immediately BEFORE any tracking fires
 * 3. If not in cache, allow page to load normally
 * 4. React will handle the redirect check and update cache for next time
 *
 * This prevents tracking pixels from firing on redirected pages after the first visit
 */

(function() {
  'use strict';

  const CACHE_KEY = 'vnsh_redirects_cache';
  const CACHE_VERSION_KEY = 'vnsh_redirects_cache_version';
  const CACHE_VERSION = '1'; // Increment to invalidate cache

  // Normalize path function (same as in redirects.ts)
  function normalizePath(path) {
    let normalized = path.trim();

    // Ensure leading slash for relative paths
    if (!normalized.startsWith('/') && !normalized.startsWith('http')) {
      normalized = '/' + normalized;
    }

    // Remove trailing slash (except for root path)
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  // Get cached redirects from localStorage
  function getCachedRedirects() {
    try {
      const version = localStorage.getItem(CACHE_VERSION_KEY);
      if (version !== CACHE_VERSION) {
        // Cache version mismatch, clear it
        localStorage.removeItem(CACHE_KEY);
        localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
        return null;
      }

      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data = JSON.parse(cached);

      // Check if cache is expired (24 hours)
      if (data.timestamp && (Date.now() - data.timestamp) > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      return data.redirects || null;
    } catch (error) {
      console.error('Error reading redirect cache:', error);
      return null;
    }
  }

  // Check for redirect synchronously using cache
  function checkRedirectSync() {
    const currentPath = window.location.pathname;
    const normalizedPath = normalizePath(currentPath);

    // Skip redirect check for certain paths
    if (normalizedPath === '/' ||
        normalizedPath.startsWith('/admin') ||
        normalizedPath.startsWith('/api') ||
        normalizedPath.startsWith('/assets') ||
        normalizedPath.startsWith('/products') ||
        normalizedPath.startsWith('/collections') ||
        normalizedPath.startsWith('/cart') ||
        normalizedPath.startsWith('/checkout')) {
      return null;
    }

    const cachedRedirects = getCachedRedirects();
    if (!cachedRedirects) {
      return null;
    }

    // Look up redirect in cache
    const redirect = cachedRedirects[normalizedPath];
    return redirect || null;
  }

  // Main execution - SYNCHRONOUS
  const redirect = checkRedirectSync();

  if (redirect && redirect.destination_path) {
    console.log('🔀 Cached redirect found, navigating immediately to:', redirect.destination_path);

    // Perform the redirect immediately BEFORE any tracking scripts run
    window.location.replace(redirect.destination_path);

    // Stop script execution
    throw new Error('Redirecting...');
  }

  // No cached redirect found, allow normal page load
  // React will check the database and update the cache
  console.log('✅ No cached redirect for:', window.location.pathname);
})();

