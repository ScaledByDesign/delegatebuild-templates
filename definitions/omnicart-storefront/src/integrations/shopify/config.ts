import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const ENV_FILES = [
  ".env",
  ".env.local",
  "my-medusa-storefront/.env",
  "my-medusa-storefront/.env.local",
]
let envHydrated = false

function hydrateEnv(target: NodeJS.ProcessEnv = process.env) {
  if (envHydrated) return
  envHydrated = true

  for (const file of ENV_FILES) {
    const filePath = resolve(process.cwd(), file)
    if (!existsSync(filePath)) continue

    const content = readFileSync(filePath, "utf8")
    const lines = content.split(/\r?\n/)

    for (const line of lines) {
      if (!line || line.trim().startsWith("#")) continue
      const idx = line.indexOf("=")
      if (idx === -1) continue

      const key = line.slice(0, idx).trim()
      if (!key) continue
      if (target[key] !== undefined) continue

      const rawValue = line.slice(idx + 1)
      const value = rawValue.trim().replace(/^['"]|['"]$/g, "")
      target[key] = value
    }
  }
}

function ensure(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

export type ShopifyDataSource = "admin-api" | "public-json"

export interface ShopifyMedusaConfig {
  shopifyDomain: string
  shopifyAccessToken?: string
  medusaAdminUrl: string
  medusaAdminToken: string
  medusaDefaultRegionId: string
  medusaDefaultCollectionFallback?: string
  medusaInventoryLocationId?: string
  medusaSalesChannelId?: string
  requestTimeoutMs: number
  dataSource: ShopifyDataSource
  collectionHandle: string
  medusaSalesChannelName?: string
}

const DEFAULT_TIMEOUT = 60_000

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ShopifyMedusaConfig {
  hydrateEnv(env)

  const shopifyDomain = ensure(env.SHOPIFY_STORE_DOMAIN, "SHOPIFY_STORE_DOMAIN")
  const medusaAdminUrl = ensure(env.MEDUSA_ADMIN_URL, "MEDUSA_ADMIN_URL")
  const medusaAdminToken = ensure(env.MEDUSA_ADMIN_TOKEN, "MEDUSA_ADMIN_TOKEN")
  const medusaDefaultRegionId = ensure(env.MEDUSA_DEFAULT_REGION_ID, "MEDUSA_DEFAULT_REGION_ID")

  const requestedSource = (env.SHOPIFY_DATA_SOURCE as ShopifyDataSource | undefined) ??
    (env.SHOPIFY_ACCESS_TOKEN ? "admin-api" : "public-json")

  if (requestedSource === "admin-api" && !env.SHOPIFY_ACCESS_TOKEN) {
    throw new Error("SHOPIFY_ACCESS_TOKEN is required when SHOPIFY_DATA_SOURCE=admin-api")
  }

  const timeoutMs = env.SHOPIFY_MEDUSA_REQUEST_TIMEOUT_MS
    ? Number.parseInt(env.SHOPIFY_MEDUSA_REQUEST_TIMEOUT_MS, 10)
    : DEFAULT_TIMEOUT

  return {
    shopifyDomain: shopifyDomain.replace(/\/$/, ""),
    shopifyAccessToken: env.SHOPIFY_ACCESS_TOKEN,
    medusaAdminUrl: medusaAdminUrl.replace(/\/$/, ""),
    medusaAdminToken,
    medusaDefaultRegionId,
    medusaDefaultCollectionFallback: env.MEDUSA_DEFAULT_COLLECTION_FALLBACK,
    medusaInventoryLocationId: env.MEDUSA_INVENTORY_LOCATION_ID,
    medusaSalesChannelId: env.MEDUSA_SALES_CHANNEL_ID,
    requestTimeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT,
    dataSource: requestedSource,
    collectionHandle: env.SHOPIFY_COLLECTION_HANDLE || "all",
    medusaSalesChannelName: env.MEDUSA_SALES_CHANNEL_NAME,
  }
}
