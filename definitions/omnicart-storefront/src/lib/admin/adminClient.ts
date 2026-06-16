/**
 * Browser-compatible OmniCart Admin API client
 * This is a simplified version for frontend use
 */

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

// Function to get environment variables
function getEnvVar(key: string): string | undefined {
  if (typeof window !== 'undefined' && import.meta?.env) {
    return import.meta.env[key];
  }
  return undefined;
}

// Determine the OmniCart backend URL using the same logic as medusa-client.ts
const isBrowser = typeof window !== 'undefined';

const explicitBackendUrl =
  getEnvVar('VITE_OMNICART_BACKEND_URL') ||
  getEnvVar('OMNICART_BACKEND_URL') ||
  undefined;

const shouldUseProxy =
  isBrowser &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
  !getEnvVar('VITE_OMNICART_DISABLE_PROXY');

const OMNICART_BACKEND_URL = explicitBackendUrl || (isBrowser ? 'https://vnsh.omnicart.cc' : 'https://vnsh.omnicart.cc');

const OMNICART_SALES_CHANNEL_ID =
  getEnvVar('VITE_OMNICART_SALES_CHANNEL_ID') ||
  getEnvVar('OMNICART_SALES_CHANNEL_ID') ||
  undefined;

console.log('Admin Client Configuration:', {
  baseUrl: OMNICART_BACKEND_URL,
  shouldUseProxy,
  explicitBackendUrl,
  salesChannelId: OMNICART_SALES_CHANNEL_ID,
});

export class MedusaAdminClient {
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

    if (MEDUSA_SALES_CHANNEL_ID) {
      query['sales_channel_id[]'] = MEDUSA_SALES_CHANNEL_ID;
    }

    const response = await this.request<{ products: any[] }>('/products', {
      query,
    });

    const products = response.products ?? [];
    if (!MEDUSA_SALES_CHANNEL_ID) {
      return products;
    }

    return products.filter((product) =>
      (product.sales_channels ?? []).some((channel: { id: string }) => channel.id === MEDUSA_SALES_CHANNEL_ID)
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

    if (MEDUSA_SALES_CHANNEL_ID) {
      query['sales_channel_id[]'] = MEDUSA_SALES_CHANNEL_ID;
    }

    const response = await this.request<{ products: any[] }>('/products', { query });
    const products = response.products ?? [];

    if (!MEDUSA_SALES_CHANNEL_ID) {
      return products;
    }

    return products.filter((product) =>
      (product.sales_channels ?? []).some((channel: { id: string }) => channel.id === MEDUSA_SALES_CHANNEL_ID)
    );
  }
}

// Create a singleton instance
// Note: You'll need to provide the admin token securely
// This is a placeholder - in production, you'd want to handle auth properly
let adminClient: MedusaAdminClient | null = null;

export function getAdminClient(): MedusaAdminClient {
  if (!adminClient) {
    // Use the same backend URL logic as the main medusa client
    const baseUrl = OMNICART_BACKEND_URL;

    // In production, you'd want to get this from a secure auth flow
    // For now, we'll try to get it from localStorage or environment
    const token = localStorage.getItem('medusa_admin_token') ||
                  getEnvVar('VITE_OMNICART_ADMIN_TOKEN') ||
                  '';

    console.log('Creating admin client with:', { baseUrl, hasToken: !!token });
    adminClient = new MedusaAdminClient({ baseUrl, token });
  }
  return adminClient;
}

export function setAdminToken(token: string) {
  localStorage.setItem('medusa_admin_token', token);
  adminClient = null; // Reset client to pick up new token
}
