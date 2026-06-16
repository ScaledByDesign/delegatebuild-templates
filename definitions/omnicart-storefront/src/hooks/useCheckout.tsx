import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  getCheckoutCart,
  updateCartEmail,
  updateShippingAddress,
  updateBillingAddress,
  getCartShippingOptions,
  addCartShippingMethod,
  createCartPaymentSessions,
  setCartPaymentSession,
  authorizeCartPaymentSession,
  completeCartCheckout,
  calculateCartTaxes,
  batchUpdateCart,
  type ShippingAddress,
  type BillingAddress,
  type CheckoutCart,
  type ShippingOption,
  type PaymentSession
} from '@/lib/data/checkout'
import { getCartId } from '@/lib/util/cookies'

export interface CheckoutStep {
  id: number
  name: string
  completed: boolean
  current: boolean
}

export interface CheckoutState {
  currentStep: number
  steps: CheckoutStep[]
  cart: CheckoutCart | null
  shippingOptions: ShippingOption[]
  paymentSessions: PaymentSession[]
  isLoading: boolean
  error: string | null
}

export const useCheckout = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const cartId = getCartId()

  const [currentStep, setCurrentStep] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const steps: CheckoutStep[] = [
    { id: 1, name: 'Information', completed: false, current: currentStep === 1 },
    { id: 2, name: 'Shipping', completed: false, current: currentStep === 2 },
    { id: 3, name: 'Payment', completed: false, current: currentStep === 3 },
    { id: 4, name: 'Review', completed: false, current: currentStep === 4 }
  ]

  // Fetch checkout cart
  const { 
    data: cart, 
    isLoading: cartLoading, 
    error: cartError 
  } = useQuery({
    queryKey: ['checkout-cart', cartId],
    queryFn: getCheckoutCart,
    enabled: !!cartId,
    refetchOnWindowFocus: false
  })

  // Fetch shipping options
  const { 
    data: shippingOptions = [], 
    isLoading: shippingLoading 
  } = useQuery({
    queryKey: ['shipping-options', cartId],
    queryFn: () => getCartShippingOptions(cartId!),
    enabled: !!cartId && !!cart?.shipping_address,
    refetchOnWindowFocus: false
  })

  // Update email mutation
  const updateEmailMutation = useMutation({
    mutationFn: ({ email }: { email: string }) => 
      updateCartEmail(cartId!, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkout-cart', cartId] })
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to update email')
    }
  })

  // Update shipping address mutation
  const updateShippingMutation = useMutation({
    mutationFn: ({ address }: { address: ShippingAddress }) =>
      updateShippingAddress(cartId!, address),
    onSuccess: async () => {
      // Calculate taxes after shipping address is set (determines tax jurisdiction)
      try {
        await calculateCartTaxes(cartId!)
      } catch (e) {
        // Log but don't fail - tax calculation errors shouldn't block checkout
        console.warn('Tax calculation error:', e)
      }
      queryClient.invalidateQueries({ queryKey: ['checkout-cart', cartId] })
      queryClient.invalidateQueries({ queryKey: ['shipping-options', cartId] })
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to update shipping address')
    }
  })

  // Update billing address mutation
  const updateBillingMutation = useMutation({
    mutationFn: ({ address }: { address: BillingAddress }) => 
      updateBillingAddress(cartId!, address),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkout-cart', cartId] })
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to update billing address')
    }
  })

  // Batch update mutation - combines email, address, and tax calculation
  // Uses optimistic updates for instant UI feedback
  const batchUpdateMutation = useMutation({
    mutationFn: (updates: {
      email?: string
      shipping_address?: ShippingAddress
      billing_address?: BillingAddress
    }) => batchUpdateCart(cartId!, updates),
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['checkout-cart', cartId] })

      // Snapshot previous value
      const previousCart = queryClient.getQueryData(['checkout-cart', cartId])

      // Optimistically update cart
      queryClient.setQueryData(['checkout-cart', cartId], (old: any) => ({
        ...old,
        ...updates
      }))

      return { previousCart }
    },
    onSuccess: (data) => {
      // Update cart with server response
      if (data.cart) {
        queryClient.setQueryData(['checkout-cart', cartId], data.cart)
      }

      // Update shipping options if included
      if (data.shipping_options?.length > 0) {
        queryClient.setQueryData(['shipping-options', cartId], data.shipping_options)
      }
    },
    onError: (err: any, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(['checkout-cart', cartId], context?.previousCart)
      setError(err.message || 'Failed to update cart')
    }
  })

  // Add shipping method mutation
  const addShippingMethodMutation = useMutation({
    mutationFn: ({ shippingOptionId }: { shippingOptionId: string }) =>
      addCartShippingMethod(cartId!, shippingOptionId),
    onSuccess: async () => {
      // Recalculate taxes after shipping method is added (shipping has tax too)
      try {
        await calculateCartTaxes(cartId!)
      } catch (e) {
        console.warn('Tax calculation error:', e)
      }
      queryClient.invalidateQueries({ queryKey: ['checkout-cart', cartId] })
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to add shipping method')
    }
  })

  // Create payment sessions mutation
  const createPaymentSessionsMutation = useMutation({
    mutationFn: () => createCartPaymentSessions(cartId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkout-cart', cartId] })
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to create payment sessions')
    }
  })

  // Set payment session mutation
  const setPaymentSessionMutation = useMutation({
    mutationFn: ({ providerId }: { providerId: string }) =>
      setCartPaymentSession(cartId!, providerId),
    onSuccess: async (_data, variables) => {
      // Try to authorize immediately for providers that don't require client-side details (e.g., manual)
      try {
        await authorizeCartPaymentSession(cartId!, variables.providerId)
      } catch (e) {
        // Ignore if provider requires client-side collection (e.g., stripe)
      }
      queryClient.invalidateQueries({ queryKey: ['checkout-cart', cartId] })
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to set payment session')
    }
  })

  // Complete checkout mutation
  const completeCheckoutMutation = useMutation({
    mutationFn: () => completeCartCheckout(cartId!),
    onSuccess: (order) => {
      // Clear cart queries
      queryClient.removeQueries({ queryKey: ['cart'] })
      queryClient.removeQueries({ queryKey: ['checkout-cart'] })
      
      // Navigate to success page
      navigate(`/checkout/success?order=${(order as any)?.id}`);
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to complete checkout')
    }
  })

  // Helper functions
  const goToStep = (step: number) => {
    if (step >= 1 && step <= 4) {
      setCurrentStep(step)
      setError(null)
    }
  }

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
      setError(null)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setError(null)
    }
  }

  const updateEmail = (email: string) => {
    updateEmailMutation.mutate({ email })
  }

  const updateShipping = (address: ShippingAddress) => {
    updateShippingMutation.mutate({ address })
  }

  const updateBilling = (address: BillingAddress) => {
    updateBillingMutation.mutate({ address })
  }

  // Optimized batch update - combines email, shipping, billing, and tax calculation
  const batchUpdate = (updates: {
    email?: string
    shipping_address?: ShippingAddress
    billing_address?: BillingAddress
  }) => {
    batchUpdateMutation.mutate(updates)
  }

  const selectShippingMethod = (shippingOptionId: string) => {
    addShippingMethodMutation.mutate({ shippingOptionId })
  }

  const initializePayment = () => {
    createPaymentSessionsMutation.mutate()
  }

  const selectPaymentMethod = (providerId: string) => {
    setPaymentSessionMutation.mutate({ providerId })
  }

  const completeOrder = () => {
    completeCheckoutMutation.mutate()
  }

  const isLoading = cartLoading ||
    updateEmailMutation.isPending ||
    updateShippingMutation.isPending ||
    updateBillingMutation.isPending ||
    batchUpdateMutation.isPending ||
    addShippingMethodMutation.isPending ||
    createPaymentSessionsMutation.isPending ||
    setPaymentSessionMutation.isPending ||
    completeCheckoutMutation.isPending

  // Check if cart exists
  useEffect(() => {
    if (!cartId) {
      navigate('/cart')
    }
  }, [cartId, navigate])

  // Update steps completion status
  const updatedSteps = steps.map(step => ({
    ...step,
    completed: step.id < currentStep,
    current: step.id === currentStep
  }))

  return {
    // State
    currentStep,
    steps: updatedSteps,
    cart,
    shippingOptions,
    paymentSessions: cart?.payment_sessions || [],
    isLoading,
    error: error || cartError?.message,

    // Actions
    goToStep,
    nextStep,
    prevStep,
    updateEmail,
    updateShipping,
    updateBilling,
    batchUpdate, // Optimized batch update
    selectShippingMethod,
    initializePayment,
    selectPaymentMethod,
    completeOrder,

    // Utilities
    clearError: () => setError(null),
    canProceedToShipping: !!cart?.email && !!cart?.shipping_address,
    canProceedToPayment: !!cart?.shipping_methods?.length,
    canCompleteOrder: !!cart?.payment_sessions?.some(ps => ps.status === 'authorized')
  }
}
