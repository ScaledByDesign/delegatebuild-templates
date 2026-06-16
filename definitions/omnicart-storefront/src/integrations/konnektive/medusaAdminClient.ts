import type { KonnektiveMedusaConfig } from "./config"

// Re-use the existing Medusa types from Shopify integration
export type {
  MedusaProduct,
  MedusaProductVariant,
  MedusaCollection,
  MedusaCustomer,
  MedusaOrder,
  MedusaInventoryItem,
} from "../shopify/medusaAdminClient"

// Import the existing MedusaAdminClient and extend it
import { MedusaAdminClient as BaseMedusaAdminClient } from "../shopify/medusaAdminClient"

export class KonnektiveMedusaAdminClient extends BaseMedusaAdminClient {
  constructor(config: KonnektiveMedusaConfig) {
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
