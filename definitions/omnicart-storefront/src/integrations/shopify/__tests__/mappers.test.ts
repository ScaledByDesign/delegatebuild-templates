// @ts-nocheck
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { buildProductUpsertPayload, buildVariantUpsertPayload, shopifyIdFromGid } from "../mappers"
import type { ShopifyProductNode } from "../shopifyClient"

const baseProduct: ShopifyProductNode = {
  id: "gid://shopify/Product/123",
  title: "Sample Product",
  handle: "sample-product",
  descriptionHtml: "<p>Description</p>",
  status: "ACTIVE",
  productType: "Holster",
  vendor: "VNSH",
  tags: ["tag"],
  publishedAt: new Date().toISOString(),
  onlineStoreUrl: "https://example.com",
  metafields: [],
  seo: { title: "SEO title", description: "SEO description" },
  collections: [
    {
      id: "gid://shopify/Collection/1",
      handle: "holsters",
      title: "Holsters",
    },
  ],
  images: [
    {
      id: "gid://shopify/ProductImage/10",
      url: "https://cdn.shopify.com/image1.jpg",
      altText: "Alt",
    },
  ],
  options: [
    {
      id: "gid://shopify/ProductOption/1",
      name: "Size",
      values: ["Regular", "XL"],
    },
  ],
  variants: [
    {
      id: "gid://shopify/ProductVariant/456",
      title: "Regular",
      sku: "SKU-123",
      barcode: null,
      weight: 0,
      weightUnit: "LB",
      price: "59.97",
      compareAtPrice: "79.97",
      inventoryPolicy: "DENY",
      inventoryQuantity: 25,
      selectedOptions: [
        {
          name: "Size",
          value: "Regular",
        },
      ],
      updatedAt: new Date().toISOString(),
    },
  ],
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
}

describe("mappers", () => {
  it("buildProductUpsertPayload returns expected payload", () => {
    const { createPayload, updatePayload, optionTitles } = buildProductUpsertPayload(baseProduct)

    assert.equal(createPayload.title, "Sample Product")
    assert.equal(updatePayload.status, "published")
    assert.deepEqual(optionTitles, ["Size"])
    assert.equal((createPayload.metadata as any).shopify_product_id, shopifyIdFromGid(baseProduct.id))
    assert.equal((createPayload.metadata as any).shopify_collection_handles, "holsters")
    assert.equal((createPayload.metadata as any).shopify_collection_titles, "Holsters")
  })

  it("buildVariantUpsertPayload maps variants", () => {
    const medusaProduct = {
      id: "medusa-prod",
      title: baseProduct.title,
      handle: baseProduct.handle,
      description: baseProduct.descriptionHtml,
      status: "published",
      thumbnail: null,
      options: [
        {
          id: "opt-1",
          title: "Size",
          values: [],
        },
      ],
      variants: [],
      images: [],
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      collection: undefined,
      collection_id: undefined,
    }

    const variantPayloads = buildVariantUpsertPayload(baseProduct, medusaProduct as any)
    const first = variantPayloads[0]

    assert.equal(first.payload.title, "Regular")
    assert.equal(first.payload.metadata?.shopify_variant_id, "456")
    assert.equal(first.payload.metadata?.shopify_inventory_quantity, 25)
    assert.equal("inventory_quantity" in first.payload, false)
    assert.equal(first.payload.manage_inventory, true)
    assert.equal(first.prices[0].amount, 5997)
  })
})
