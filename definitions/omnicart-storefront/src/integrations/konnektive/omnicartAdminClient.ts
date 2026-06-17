import type { KonnektiveOmnicartConfig } from "./config"

// Re-use the existing OmniCart types from Shopify integration
export type {
  OmnicartProduct,
  OmnicartProductVariant,
  OmnicartCollection,
  OmnicartCustomer,
  OmnicartOrder,
  OmnicartInventoryItem,
} from "../shopify/omnicartAdminClient"

// Import the existing OmnicartAdminClient and extend it
import { OmnicartAdminClient as BaseOmnicartAdminClient } from "../shopify/omnicartAdminClient"

export class KonnektiveOmnicartAdminClient extends BaseOmnicartAdminClient {
  constructor(config: KonnektiveOmnicartConfig) {
    // Create a compatible config for the parent class
    super({
      medusaAdminUrl: config.medusaAdminUrl,
      medusaAdminToken: config.medusaAdminToken,
      medusaDefaultRegionId: config.medusaDefaultRegionId,
      requestTimeoutMs: config.requestTimeoutMs,
      // Add required shopify fields with placeholder values
      shopifyDomain: "placeholder.myshopify.com",
      dataSource: "admin-api" as const,
      collectionHandle: "placeholder",
    })
  }

  // Konnektive-specific customer operations
  async listCustomersByKonnektiveId(konnektiveCustomerId: string): Promise<any[]> {
    const customers = await this.listCustomers(100, 0)
    return customers.filter(customer =>
      customer.metadata?.konnektive_customer_id === konnektiveCustomerId
    )
  }

  // Konnektive-specific product operations
  async listProductsByKonnektiveId(konnektiveProductId: string): Promise<any[]> {
    const products = await this.listProducts(100, 0)
    return products.filter(product =>
      product.metadata?.konnektive_product_id === konnektiveProductId
    )
  }

  // Konnektive-specific order operations
  async listOrdersByKonnektiveId(konnektiveOrderId: string): Promise<any[]> {
    const orders = await this.listOrders(100, 0)
    return orders.filter(order =>
      order.metadata?.konnektive_order_id === konnektiveOrderId
    )
  }
}
