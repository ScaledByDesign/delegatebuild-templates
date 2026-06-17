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

export type KonnektiveDataSource = "api" | "webhook"

export interface KonnektiveOmnicartConfig {
  konnektiveApiUrl: string
  konnektiveLoginId: string
  konnektivePassword: string
  konnektiveCampaignId?: string
  medusaAdminUrl: string
  medusaAdminToken: string
  medusaDefaultRegionId: string
  medusaDefaultCollectionFallback?: string
  medusaInventoryLocationId?: string
  medusaSalesChannelId?: string
  requestTimeoutMs: number
  dataSource: KonnektiveDataSource
  medusaSalesChannelName?: string
  enableWebhooks: boolean
  webhookSecret?: string
  syncMode: "full" | "incremental" | "orders_only" | "customers_only"
  batchSize: number
  retryAttempts: number
  retryDelayMs: number
}

const DEFAULT_TIMEOUT = 60000 // 60 seconds for API operations
const DEFAULT_BATCH_SIZE = 50
const DEFAULT_RETRY_ATTEMPTS = 3
const DEFAULT_RETRY_DELAY = 1000

export function loadConfig(env: NodeJS.ProcessEnv = process.env): KonnektiveOmnicartConfig {
  hydrateEnv(env)

  const konnektiveApiUrl = ensure(env.KONNEKTIVE_API_URL, "KONNEKTIVE_API_URL")
  const konnektiveLoginId = ensure(env.KONNEKTIVE_LOGIN_ID, "KONNEKTIVE_LOGIN_ID")
  const konnektivePassword = ensure(env.KONNEKTIVE_PASSWORD, "KONNEKTIVE_PASSWORD")
  const medusaAdminUrl = ensure(env.OMNICART_ADMIN_URL, "OMNICART_ADMIN_URL")
  const medusaAdminToken = ensure(env.OMNICART_ADMIN_TOKEN, "OMNICART_ADMIN_TOKEN")
  const medusaDefaultRegionId = ensure(
    env.OMNICART_REGION_ID ?? env.OMNICART_DEFAULT_REGION_ID,
    "OMNICART_REGION_ID",
  )

  const requestedSource = (env.KONNEKTIVE_DATA_SOURCE as KonnektiveDataSource | undefined) ?? "api"

  const timeoutOverride = env.KONNEKTIVE_OMNICART_REQUEST_TIMEOUT_MS
  const timeoutMs = timeoutOverride
    ? Number.parseInt(timeoutOverride, 10)
    : DEFAULT_TIMEOUT

  const batchSize = env.KONNEKTIVE_BATCH_SIZE
    ? Number.parseInt(env.KONNEKTIVE_BATCH_SIZE, 10)
    : DEFAULT_BATCH_SIZE

  const retryAttempts = env.KONNEKTIVE_RETRY_ATTEMPTS
    ? Number.parseInt(env.KONNEKTIVE_RETRY_ATTEMPTS, 10)
    : DEFAULT_RETRY_ATTEMPTS

  const retryDelayMs = env.KONNEKTIVE_RETRY_DELAY_MS
    ? Number.parseInt(env.KONNEKTIVE_RETRY_DELAY_MS, 10)
    : DEFAULT_RETRY_DELAY

  const syncMode = (env.KONNEKTIVE_SYNC_MODE as KonnektiveOmnicartConfig["syncMode"]) ?? "full"

  return {
    konnektiveApiUrl: konnektiveApiUrl.replace(/\/$/, ""),
    konnektiveLoginId,
    konnektivePassword,
    konnektiveCampaignId: env.KONNEKTIVE_CAMPAIGN_ID,
    medusaAdminUrl: medusaAdminUrl.replace(/\/$/, ""),
    medusaAdminToken,
    medusaDefaultRegionId,
    medusaDefaultCollectionFallback:
      env.OMNICART_COLLECTION_FALLBACK,
    medusaInventoryLocationId:
      env.OMNICART_INVENTORY_LOCATION_ID,
    medusaSalesChannelId:
      env.OMNICART_SALES_CHANNEL_ID,
    requestTimeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT,
    dataSource: requestedSource,
    medusaSalesChannelName: env.OMNICART_SALES_CHANNEL_NAME,
    enableWebhooks: env.KONNEKTIVE_ENABLE_WEBHOOKS === "true",
    webhookSecret: env.KONNEKTIVE_WEBHOOK_SECRET,
    syncMode,
    batchSize: Number.isFinite(batchSize) ? batchSize : DEFAULT_BATCH_SIZE,
    retryAttempts: Number.isFinite(retryAttempts) ? retryAttempts : DEFAULT_RETRY_ATTEMPTS,
    retryDelayMs: Number.isFinite(retryDelayMs) ? retryDelayMs : DEFAULT_RETRY_DELAY,
  }
}
