// Direct API client for Medusa - replacing the SDK
import medusaError from './util/medusa-error'
import { OMNICART_BACKEND_URL, OMNICART_PUBLISHABLE_KEY } from './omnicart-config'

export interface MedusaClientOptions {
  headers?: Record<string, string>
  cache?: RequestCache
}

export class MedusaClient {
  private baseUrl: string
  private publishableKey?: string

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
        // Try to extract the human-readable message from Medusa JSON errors
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
      console.error('Medusa API Error:', error)
      throw medusaError(error)
    }
  }

  // Convenience methods for common HTTP verbs
  async get<T = any>(path: string, options: Omit<MedusaClientOptions, 'method'> & { query?: Record<string, any> } = {}): Promise<T> {
    return this.fetch<T>(path, { ...options, method: 'GET' })
  }

  async post<T = any>(path: string, body?: any, options: Omit<MedusaClientOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.fetch<T>(path, { ...options, method: 'POST', body })
  }

  async put<T = any>(path: string, body?: any, options: Omit<MedusaClientOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.fetch<T>(path, { ...options, method: 'PUT', body })
  }

  async patch<T = any>(path: string, body?: any, options: Omit<MedusaClientOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.fetch<T>(path, { ...options, method: 'PATCH', body })
  }

  async delete<T = any>(path: string, options: Omit<MedusaClientOptions, 'method'> = {}): Promise<T> {
    return this.fetch<T>(path, { ...options, method: 'DELETE' })
  }
}

// Export a singleton instance
export const medusaClient = new MedusaClient()
export default medusaClient
