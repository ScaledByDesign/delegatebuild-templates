// Direct API client for OmniCart - replacing the SDK
import omnicartError from './util/omnicart-error'
import { OMNICART_BACKEND_URL, OMNICART_PUBLISHABLE_KEY } from './omnicart-config'

export interface OmnicartClientOptions {
  headers?: Record<string, string>
  cache?: RequestCache
}

export class OmnicartClient {
  private baseUrl: string
  private publishableKey?: string
  private requestLog = new Map<string, { count: number; windowStart: number }>()
  private readonly WINDOW_MS = 10000 // 10 seconds
  private readonly MAX_REQUESTS_PER_WINDOW = 10 // max 10 identical requests in 10s

  constructor() {
    this.baseUrl = OMNICART_BACKEND_URL
    this.publishableKey = OMNICART_PUBLISHABLE_KEY
  }

  private getDefaultHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.publishableKey) {
      headers['x-publishable-api-key'] = this.publishableKey
    }

    return headers
  }

  async fetch<T = any>(
    path: string,
    options: {
      method?: string
      body?: any
      headers?: Record<string, string>
      cache?: RequestCache
      query?: Record<string, any>
    } = {}
  ): Promise<T> {
    const {
      method = 'GET',
      body,
      headers = {},
      cache = 'default',
      query
    } = options

    // Build URL with query parameters
    let url = `${this.baseUrl}${path}`
    if (query) {
      const searchParams = new URLSearchParams()
      Object.entries(query).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(`${key}[]`, String(v)))
        } else if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
      const queryString = searchParams.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }

    // Circuit breaker to prevent infinite loop / render hammering
    const requestKey = `${method}:${url}:${body ? (typeof body === 'string' ? body : JSON.stringify(body)) : ''}`
    const now = Date.now()
    const tracker = this.requestLog.get(requestKey)

    if (tracker) {
      if (now - tracker.windowStart < this.WINDOW_MS) {
        tracker.count++
        if (tracker.count > this.MAX_REQUESTS_PER_WINDOW) {
          const errorMsg = `Circuit breaker triggered: Too many identical requests (${tracker.count}) to "${path}" within ${this.WINDOW_MS / 1000}s. Lower your render/useEffect updates.`
          console.error(`🚨 ${errorMsg}`)
          throw new Error(errorMsg)
        }
      } else {
        tracker.count = 1
        tracker.windowStart = now
      }
    } else {
      this.requestLog.set(requestKey, { count: 1, windowStart: now })
    }

    // Prepare headers
    const requestHeaders = {
      ...this.getDefaultHeaders(),
      ...headers
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      cache,
      credentials: 'include' // Include cookies for session management
    }

    // Add body for non-GET requests
    if (body && method !== 'GET') {
      if (typeof body === 'string') {
        requestOptions.body = body
      } else {
        requestOptions.body = JSON.stringify(body)
      }
    }

    try {
      console.log(`Making ${method} request to: ${url}`)
      const response = await fetch(url, requestOptions)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`API Error ${response.status}:`, errorText)
        // Try to extract the human-readable message from API JSON errors
        let errorMessage = `HTTP ${response.status}: ${errorText}`
        try {
          const parsed = JSON.parse(errorText)
          if (parsed.message) {
            errorMessage = parsed.message
          }
        } catch {
          // Not JSON – use the raw text
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      return data as T
    } catch (error) {
      console.error('OmniCart API Error:', error)
      throw omnicartError(error)
    }
  }

  // Convenience methods for common HTTP verbs
  async get<T = any>(path: string, options: Omit<OmnicartClientOptions, 'method'> & { query?: Record<string, any> } = {}): Promise<T> {
    return this.fetch<T>(path, { ...options, method: 'GET' })
  }

  async post<T = any>(path: string, body?: any, options: Omit<OmnicartClientOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.fetch<T>(path, { ...options, method: 'POST', body })
  }

  async put<T = any>(path: string, body?: any, options: Omit<OmnicartClientOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.fetch<T>(path, { ...options, method: 'PUT', body })
  }

  async patch<T = any>(path: string, body?: any, options: Omit<OmnicartClientOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.fetch<T>(path, { ...options, method: 'PATCH', body })
  }

  async delete<T = any>(path: string, options: Omit<OmnicartClientOptions, 'method'> = {}): Promise<T> {
    return this.fetch<T>(path, { ...options, method: 'DELETE' })
  }
}

// Export a singleton instance
export const omnicartClient = new OmnicartClient()
export default omnicartClient
