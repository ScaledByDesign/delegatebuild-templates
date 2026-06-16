/**
 * Konnektive Order Widget Component
 *
 * Displays Konnektive-specific order details only if the order came from Konnektive.
 * Hides the widget entirely if no Konnektive data is found.
 */

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Check, Clock, Package, X } from 'lucide-react'

interface KonnektiveMetadata {
  konnektive_order_id?: string
  konnektive_customer_id?: string
  konnektive_product_ids?: string[]
  konnektive_campaign_id?: string
  konnektive_sync_status?: string
  konnektive_last_sync?: string
  [key: string]: any
}

interface KonnektiveOrderWidgetProps {
  orderId: string
  metadata?: Record<string, any>
  className?: string
  hideIfNoData?: boolean
}

/**
 * Checks if order has valid Konnektive metadata
 */
function hasKonnektiveData(metadata?: Record<string, any>): metadata is KonnektiveMetadata & Record<string, any> {
  if (!metadata) return false

  // Check for any Konnektive-related keys
  const konnektiveKeys = Object.keys(metadata).filter(key =>
    key.toLowerCase().includes('konnektive')
  )

  // If we found Konnektive keys, check if they have actual values
  if (konnektiveKeys.length > 0) {
    return konnektiveKeys.some(key => {
      const value = metadata[key]
      return value !== null && value !== undefined && value !== ''
    })
  }

  return false
}

/**
 * Gets the sync status badge
 */
function getSyncStatusBadge(status?: string) {
  const statusLower = status?.toLowerCase() || ''

  if (statusLower === 'synced' || statusLower === 'success') {
    return {
      label: 'Synced',
      icon: Check,
      className: 'bg-green-100 text-green-800'
    }
  }
  if (statusLower === 'pending' || statusLower === 'syncing') {
    return {
      label: 'Syncing',
      icon: Clock,
      className: 'bg-blue-100 text-blue-800'
    }
  }
  if (statusLower === 'failed' || statusLower === 'error') {
    return {
      label: 'Sync Failed',
      icon: X,
      className: 'bg-red-100 text-red-800'
    }
  }

  return {
    label: 'Unknown',
    icon: AlertCircle,
    className: 'bg-gray-100 text-gray-800'
  }
}

/**
 * Konnektive Order Widget Component
 *
 * Only displays if:
 * 1. Konnektive metadata exists in order
 * 2. At least one Konnektive field has a non-empty value
 *
 * Shows:
 * - Konnektive Order ID
 * - Customer ID
 * - Sync Status
 * - Last Sync time
 * - Associated campaign (if available)
 */
export const KonnektiveOrderWidget: React.FC<KonnektiveOrderWidgetProps> = ({
  orderId,
  metadata,
  className = '',
  hideIfNoData = true
}) => {
  // Check if this order has Konnektive data
  const konnektiveData = useMemo(() => {
    if (!hasKonnektiveData(metadata)) {
      console.debug('[Konnektive Widget] No Konnektive data found in order metadata', {
        orderId,
        availableKeys: Object.keys(metadata || {})
      })
      return null
    }
    return metadata as KonnektiveMetadata & Record<string, any>
  }, [metadata, orderId])

  // If hideIfNoData is true and no Konnektive data found, don't render anything
  if (hideIfNoData && !konnektiveData) {
    return null
  }

  // If we have no Konnektive data, show a placeholder message (only if hideIfNoData is false)
  if (!konnektiveData) {
    return (
      <Card className={`border-gray-200 bg-gray-50 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-gray-400" />
            <span>Konnektive Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            This order was not synced from Konnektive.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Extract Konnektive data
  const {
    konnektive_order_id,
    konnektive_customer_id,
    konnektive_sync_status,
    konnektive_last_sync,
    konnektive_campaign_id,
    konnektive_product_ids
  } = konnektiveData

  const syncStatus = getSyncStatusBadge(konnektive_sync_status)
  const StatusIcon = syncStatus.icon

  const lastSyncDate = konnektive_last_sync
    ? new Date(konnektive_last_sync).toLocaleString()
    : 'Never'

  return (
    <Card className={`border-purple-200 bg-purple-50 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" />
            <span>Konnektive Information</span>
          </div>
          {konnektive_sync_status && (
            <Badge className={syncStatus.className}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {syncStatus.label}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Order ID */}
        {konnektive_order_id && (
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-gray-700">Konnektive Order ID:</span>
            <span className="text-sm font-mono text-gray-600">{konnektive_order_id}</span>
          </div>
        )}

        {/* Customer ID */}
        {konnektive_customer_id && (
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-gray-700">Konnektive Customer ID:</span>
            <span className="text-sm font-mono text-gray-600">{konnektive_customer_id}</span>
          </div>
        )}

        {/* Campaign ID */}
        {konnektive_campaign_id && (
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-gray-700">Campaign ID:</span>
            <span className="text-sm font-mono text-gray-600">{konnektive_campaign_id}</span>
          </div>
        )}

        {/* Product IDs */}
        {konnektive_product_ids && Array.isArray(konnektive_product_ids) && konnektive_product_ids.length > 0 && (
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-gray-700">Konnektive Products:</span>
            <div className="flex flex-wrap gap-1 justify-end">
              {konnektive_product_ids.slice(0, 5).map((productId, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {productId}
                </Badge>
              ))}
              {konnektive_product_ids.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{konnektive_product_ids.length - 5} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Last Sync Time */}
        {konnektive_last_sync && (
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-gray-700">Last Synced:</span>
            <span className="text-sm text-gray-600">{lastSyncDate}</span>
          </div>
        )}

        {/* Sync Status Note */}
        {konnektive_sync_status === 'failed' && (
          <div className="mt-3 p-2 bg-red-100 border border-red-200 rounded">
            <p className="text-xs text-red-800">
              ⚠️ This order had an issue syncing with Konnektive. Check logs for details.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default KonnektiveOrderWidget
