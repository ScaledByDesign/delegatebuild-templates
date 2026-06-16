/**
 * Shipping Method Selector Component
 *
 * Displays available shipping options (ShipStation, Manual, etc.)
 * and allows users to select their preferred shipping method.
 */

import React, { useEffect, useState } from 'react'
import { useCart } from '@/providers/cart'
import { getShippingOptions, addShippingMethod } from '@/lib/fulfillment'
import { AlertCircle, Loader, CheckCircle2 } from 'lucide-react'

interface ShippingOption {
  id: string
  name: string
  description?: string
  amount?: number
  calculated?: boolean
  provider?: {
    id: string
    name: string
  }
}

interface ShippingMethodSelectorProps {
  onMethodSelected?: (optionId: string) => void
  showDescription?: boolean
  className?: string
}

/**
 * Shipping Method Selector Component
 */
export function ShippingMethodSelector({
  onMethodSelected,
  showDescription = true,
  className = ''
}: ShippingMethodSelectorProps) {
  const { cart, setCart } = useCart()
  const [options, setOptions] = useState<ShippingOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  // Fetch available shipping options when cart changes
  useEffect(() => {
    if (!cart?.id) {
      setLoading(false)
      return
    }

    loadShippingOptions()
  }, [cart?.id])

  /**
   * Load available shipping options for the current cart
   */
  async function loadShippingOptions() {
    try {
      setLoading(true)
      setError(null)

      const shippingOptions = await getShippingOptions(cart?.id!)
      setOptions(shippingOptions)

      // Set the currently selected option
      const currentOption = cart?.shipping_methods?.[0]?.shipping_option_id
      if (currentOption) {
        setSelectedOptionId(currentOption)
      }
    } catch (err) {
      console.error('Error loading shipping options:', err)
      setError('Failed to load shipping options. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle shipping method selection
   */
  async function handleMethodChange(optionId: string) {
    try {
      setUpdating(true)
      setError(null)

      // Update cart with selected shipping method
      const updatedCart = await addShippingMethod(cart?.id!, optionId)
      setCart?.(updatedCart)
      setSelectedOptionId(optionId)

      // Call callback if provided
      onMethodSelected?.(optionId)
    } catch (err) {
      console.error('Error updating shipping method:', err)
      setError('Failed to update shipping method. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

  /**
   * Format price for display
   */
  // Medusa v2 stores prices in major units (dollars, not cents)
  function formatPrice(amount?: number): string {
    if (amount === undefined || amount === null) {
      return 'Calculated'
    }
    return `$${amount.toFixed(2)}`
  }

  // Loading state
  if (loading) {
    return (
      <div
        className={`shipping-method-selector loading ${className}`}
      >
        <div className="flex items-center justify-center py-8">
          <Loader className="h-5 w-5 animate-spin mr-2" />
          <span>Loading shipping options...</span>
        </div>
      </div>
    )
  }

  // Empty state
  if (options.length === 0) {
    return (
      <div className={`shipping-method-selector empty ${className}`}>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">No Shipping Options Available</h3>
              <p className="text-sm text-amber-800 mt-1">
                Shipping cannot be delivered to your address. Please update your location.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`shipping-method-selector ${className}`}>
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Shipping Options */}
      <div className="space-y-3">
        {options.map((option) => (
          <label
            key={option.id}
            className={`
              shipping-option-item relative flex items-start gap-3 p-4 rounded-lg
              border-2 cursor-pointer transition-all
              ${
                selectedOptionId === option.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }
              ${updating ? 'opacity-50 pointer-events-none' : ''}
            `}
          >
            {/* Radio Button */}
            <input
              type="radio"
              name="shipping-method"
              value={option.id}
              checked={selectedOptionId === option.id}
              onChange={() => handleMethodChange(option.id)}
              disabled={updating}
              className="mt-1 h-4 w-4"
            />

            {/* Option Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-gray-900">
                  {option.name}
                </span>
                <span className={`text-lg font-semibold whitespace-nowrap ${
                  selectedOptionId === option.id
                    ? 'text-blue-600'
                    : 'text-gray-900'
                }`}>
                  {formatPrice(option.amount)}
                </span>
              </div>

              {showDescription && option.description && (
                <p className="text-sm text-gray-600 mt-1">
                  {option.description}
                </p>
              )}

              {/* Provider Badge */}
              {option.provider && (
                <div className="mt-2 inline-block">
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                    {option.provider.name}
                  </span>
                </div>
              )}
            </div>

            {/* Selected Indicator */}
            {selectedOptionId === option.id && (
              <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            )}
          </label>
        ))}
      </div>

      {/* Summary */}
      {selectedOptionId && (
        <div className="mt-6 pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Shipping Total:</span>
            <span className="text-xl font-semibold text-gray-900">
              {formatPrice(
                options.find((opt) => opt.id === selectedOptionId)?.amount
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Shipping Method Summary Component
 *
 * Shows the currently selected shipping method (for order confirmation)
 */
export function ShippingMethodSummary() {
  const { cart } = useCart()
  const [option, setOption] = useState<ShippingOption | null>(null)

  useEffect(() => {
    if (!cart?.id) return

    const loadOption = async () => {
      try {
        const options = await getShippingOptions(cart.id)
        const currentOptionId = cart.shipping_methods?.[0]?.shipping_option_id
        if (currentOptionId) {
          const selectedOption = options.find((opt) => opt.id === currentOptionId)
          setOption(selectedOption || null)
        }
      } catch (err) {
        console.error('Error loading shipping method summary:', err)
      }
    }

    loadOption()
  }, [cart?.id, cart?.shipping_methods])

  if (!option) return null

  return (
    <div className="shipping-method-summary bg-gray-50 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Shipping Method</h3>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-900 font-medium">{option.name}</p>
          {option.description && (
            <p className="text-sm text-gray-600 mt-1">{option.description}</p>
          )}
        </div>
        {/* Medusa v2 stores prices in major units (dollars, not cents) */}
        <p className="text-gray-900 font-semibold whitespace-nowrap ml-4">
          ${(option.amount || 0).toFixed(2)}
        </p>
      </div>
    </div>
  )
}

export default ShippingMethodSelector
