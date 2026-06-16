import { medusaClient } from "@/lib/medusa-client"
import { getAuthHeaders } from '@/lib/util/cookies';
import medusaError from '@/lib/util/medusa-error';

export interface ReturnItem {
  item_id: string;
  quantity: number;
  reason_id?: string;
  note?: string;
}

export interface ReturnReason {
  id: string;
  label: string;
  description?: string;
}

export interface ReturnRequest {
  order_id: string;
  items: ReturnItem[];
  return_shipping?: {
    option_id: string;
  };
  note?: string;
  receive_now?: boolean;
}

export interface Return {
  id: string;
  status: 'requested' | 'received' | 'requires_action' | 'canceled';
  order_id: string;
  items: Array<{
    id: string;
    item_id: string;
    quantity: number;
    reason_id?: string;
    note?: string;
    received_quantity?: number;
  }>;
  shipping_method?: {
    id: string;
    name: string;
    price: number;
  };
  refund_amount?: number;
  created_at: string;
  updated_at: string;
}

export interface Exchange {
  id: string;
  order_id: string;
  return_id: string;
  additional_items: Array<{
    variant_id: string;
    quantity: number;
  }>;
  difference_due?: number;
  status: 'requested' | 'confirmed' | 'canceled';
  created_at: string;
}

/**
 * Get available return reasons
 */
export const getReturnReasons = async (): Promise<ReturnReason[]> => {
  try {
    // Mock return reasons - in a real implementation, this would come from Medusa
    return [
      { id: 'defective', label: 'Defective/Damaged', description: 'Item arrived damaged or defective' },
      { id: 'wrong_item', label: 'Wrong Item', description: 'Received incorrect item' },
      { id: 'not_as_described', label: 'Not as Described', description: 'Item does not match description' },
      { id: 'size_fit', label: 'Size/Fit Issue', description: 'Item does not fit properly' },
      { id: 'quality', label: 'Quality Issue', description: 'Item quality below expectations' },
      { id: 'changed_mind', label: 'Changed Mind', description: 'No longer want the item' },
      { id: 'other', label: 'Other', description: 'Other reason (please specify)' }
    ];
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Check if an order is eligible for returns
 */
export const checkReturnEligibility = async (orderId: string): Promise<{
  eligible: boolean;
  reason?: string;
  eligible_items: Array<{
    id: string;
    title: string;
    variant_title?: string;
    quantity: number;
    returnable_quantity: number;
    unit_price: number;
  }>;
}> => {
  try {
    const headers = getAuthHeaders();
    
    // In a real implementation, this would check with Medusa API
    // For now, we'll simulate the response
    const response = await medusaClient.fetch(`/store/orders/${orderId}`, {
      headers
    });

    if (!(response as any)?.order) {
      throw new Error('Order not found');
    }

    const order = (response as any).order;
    const now = new Date();
    const orderDate = new Date(order.created_at);
    const daysSinceOrder = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

    // Check return window (typically 30 days)
    if (daysSinceOrder > 30) {
      return {
        eligible: false,
        reason: 'Return window has expired (30 days)',
        eligible_items: []
      };
    }

    // Check order status
    if (order.status !== 'completed') {
      return {
        eligible: false,
        reason: 'Order must be completed before returns can be processed',
        eligible_items: []
      };
    }

    // Get eligible items
    const eligible_items = order.items.map((item: any) => ({
      id: item.id,
      title: item.title,
      variant_title: item.variant?.title,
      quantity: item.quantity,
      returnable_quantity: item.quantity - (item.returned_quantity || 0),
      unit_price: item.unit_price
    })).filter((item: any) => item.returnable_quantity > 0);

    return {
      eligible: eligible_items.length > 0,
      reason: eligible_items.length === 0 ? 'No items available for return' : undefined,
      eligible_items
    };
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Create a return request
 */
export const createReturn = async (returnRequest: ReturnRequest): Promise<Return> => {
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    };

    const response = await medusaClient.fetch('/store/returns', {
      method: 'POST',
      headers,
      body: JSON.stringify(returnRequest)
    });

    return (response as any)?.return;
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Get return by ID
 */
export const getReturn = async (returnId: string): Promise<Return> => {
  try {
    const headers = getAuthHeaders();

    const response = await medusaClient.fetch(`/store/returns/${returnId}`, {
      headers
    });

    return (response as any)?.return;
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Get returns for a customer
 */
export const getCustomerReturns = async (): Promise<Return[]> => {
  try {
    const headers = getAuthHeaders();

    const response = await medusaClient.fetch('/store/customers/me/returns', {
      headers
    });

    return (response as any)?.returns || [];
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Cancel a return
 */
export const cancelReturn = async (returnId: string): Promise<Return> => {
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    };

    const response = await medusaClient.fetch(`/store/returns/${returnId}/cancel`, {
      method: 'POST',
      headers
    });

    return (response as any)?.return;
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Create an exchange
 */
export const createExchange = async (exchangeData: {
  order_id: string;
  return_items: ReturnItem[];
  additional_items: Array<{
    variant_id: string;
    quantity: number;
  }>;
}): Promise<Exchange> => {
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    };

    const response = await medusaClient.fetch('/store/swaps', {
      method: 'POST',
      headers,
      body: JSON.stringify(exchangeData)
    });

    return (response as any)?.swap;
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Get return shipping options
 */
export const getReturnShippingOptions = async (returnId: string): Promise<Array<{
  id: string;
  name: string;
  price: number;
  estimated_days?: number;
}>> => {
  try {
    const headers = getAuthHeaders();

    const response = await medusaClient.fetch(`/store/returns/${returnId}/shipping-methods`, {
      headers
    });

    return (response as any)?.shipping_methods || [];
  } catch (error) {
    // Return mock shipping options if API not available
    return [
      { id: 'standard', name: 'Standard Return Shipping', price: 0, estimated_days: 7 },
      { id: 'expedited', name: 'Expedited Return Shipping', price: 1500, estimated_days: 3 }
    ];
  }
};

/**
 * Format return status for display
 */
export const formatReturnStatus = (status: Return['status']): string => {
  switch (status) {
    case 'requested':
      return 'Return Requested';
    case 'received':
      return 'Return Received';
    case 'requires_action':
      return 'Action Required';
    case 'canceled':
      return 'Canceled';
    default:
      return 'Unknown';
  }
};

/**
 * Get status color for UI display
 */
export const getReturnStatusColor = (status: Return['status']): string => {
  switch (status) {
    case 'requested':
      return 'text-blue-600 bg-blue-100';
    case 'received':
      return 'text-green-600 bg-green-100';
    case 'requires_action':
      return 'text-orange-600 bg-orange-100';
    case 'canceled':
      return 'text-gray-600 bg-gray-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};
