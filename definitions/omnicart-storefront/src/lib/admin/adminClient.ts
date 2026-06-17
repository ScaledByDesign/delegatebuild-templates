/**
 * Browser-compatible OmniCart Admin API client
 * This is a simplified version for frontend use
 */

import { OMNICART_BACKEND_URL, OMNICART_SALES_CHANNEL_ID } from '../omnicart-config';

interface AdminClientConfig {
  baseUrl: string;
  token: string;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
}

export class OmnicartAdminClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(config: AdminClientConfig) {
    this.baseUrl = `${config.baseUrl}/admin`;
    this.token = config.token;
  }

  private buildQuery(query?: RequestOptions['query']): string {
    if (!query) return '';
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      params.append(key, String(value));
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}${this.buildQuery(options.query)}`;

    console.log(`Admin API Request: ${options.method ?? 'GET'} ${url}`);

    // Use Basic auth like the server-side client does
    // Format: Basic base64(token:)
    const authHeader = `Basic ${btoa(`${this.token}:`)}`;

    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    console.log(`Admin API Response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const text = await response.text();
      console.error(`Admin API Error ${response.status}:`, text);
      throw new Error(`OmniCart admin error ${response.status}: ${text}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const data = await response.json();
    console.log('Admin API Response Data:', data);
    return data;
  }

  // Product methods
  async listProducts(limit: number = 100, offset: number = 0): Promise<any[]> {
    const query: Record<string, string> = {
      limit: limit.toString(),
      offset: offset.toString(),
      expand: 'variants,variants.prices,metadata,sales_channels',
    };

    if (OMNICART_SALES_CHANNEL_ID) {
      query['sales_channel_id[]'] = OMNICART_SALES_CHANNEL_ID;
    }

    const response = await this.request<{ products: any[] }>('/products', {
      query,
    });

    const products = response.products ?? [];
    if (!OMNICART_SALES_CHANNEL_ID) {
      return products;
    }

    return products.filter((product) =>
      (product.sales_channels ?? []).some((channel: { id: string }) => channel.id === OMNICART_SALES_CHANNEL_ID)
    );
  }

  async getProduct(productId: string): Promise<any> {
    const response = await this.request<{ product: any }>(`/products/${productId}`, {
      query: {
        expand: 'variants,variants.prices,metadata'
      }
    });
    return response.product;
  }

  async updateProduct(productId: string, payload: Record<string, unknown>): Promise<any> {
    const response = await this.request<{ product: any }>(`/products/${productId}`, {
      method: 'POST',
      body: payload,
    });
    return response.product;
  }

  // Collection methods
  async listCollections(limit: number = 100, offset: number = 0): Promise<any[]> {
    const response = await this.request<{ collections: any[] }>('/collections', {
      query: {
        limit: limit.toString(),
        offset: offset.toString()
      },
    });
    return response.collections ?? [];
  }

  async getCollection(collectionId: string): Promise<any> {
    const response = await this.request<{ collection: any }>(`/collections/${collectionId}`);
    return response.collection;
  }

  async updateCollection(collectionId: string, payload: Record<string, unknown>): Promise<any> {
    const response = await this.request<{ collection: any }>(`/collections/${collectionId}`, {
      method: 'POST',
      body: payload,
    });
    return response.collection;
  }

  // Fetch products belonging to a specific collection
  async listCollectionProducts(collectionId: string): Promise<any[]> {
    const query: Record<string, string> = {
      limit: '100',
      offset: '0',
      collection_id: collectionId,
      expand: 'variants,variants.prices',
    };

    if (OMNICART_SALES_CHANNEL_ID) {
      query['sales_channel_id[]'] = OMNICART_SALES_CHANNEL_ID;
    }

    const response = await this.request<{ products: any[] }>('/products', { query });
    const products = response.products ?? [];

    if (!OMNICART_SALES_CHANNEL_ID) {
      return products;
    }

    return products.filter((product) =>
      (product.sales_channels ?? []).some((channel: { id: string }) => channel.id === OMNICART_SALES_CHANNEL_ID)
    );
  }
}

// Create a singleton instance
// Note: You'll need to provide the admin token securely
// This is a placeholder - in production, you'd want to handle auth properly
let adminClient: OmnicartAdminClient | null = null;

export function getAdminClient(): OmnicartAdminClient {
  if (!adminClient) {
    // Use the same backend URL logic as the main medusa client
    const baseUrl = OMNICART_BACKEND_URL;

    // Admin tokens are NOT browser-safe, so they are never read from a build-time
    // env var (that would bundle the secret). The token is provided at runtime by
    // an authenticated admin and held only in localStorage for the session.
    const token = localStorage.getItem('medusa_admin_token') || '';

    console.log('Creating admin client with:', { baseUrl, hasToken: !!token });
    adminClient = new OmnicartAdminClient({ baseUrl, token });
  }
  return adminClient;
}

export function setAdminToken(token: string) {
  localStorage.setItem('medusa_admin_token', token);
  adminClient = null; // Reset client to pick up new token
}
