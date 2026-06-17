import { omnicartClient } from "@/lib/omnicart-client"

export interface OmnicartOrder {
  id: string;
  display_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  total: number;
  subtotal: number;
  tax_total: number;
  shipping_total: number;
  discount_total?: number;
  metadata?: Record<string, unknown> | null;
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    unit_price: number;
    total: number;
    variant?: {
      id: string;
      title: string;
    };
    product?: {
      id: string;
      title: string;
      handle: string;
    };
  }>;
  shipping_address?: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2?: string;
    city: string;
    province: string;
    postal_code: string;
    country_code: string;
  };
  billing_address?: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2?: string;
    city: string;
    province: string;
    postal_code: string;
    country_code: string;
  };
  customer?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  payment_status: string;
  fulfillment_status: string;
}

export interface OrdersResponse {
  orders: OmnicartOrder[];
  count: number;
  offset: number;
  limit: number;
}

/**
 * Get order by ID
 */
export const getOrderById = async (orderId: string, retryCount = 0): Promise<OmnicartOrder> => {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second

  try {
    // Try simple request first (no fields/expand) to see if order exists
    const response = await omnicartClient.get<{ order: OmnicartOrder }>(
      `/store/orders/${orderId}`,
      {
        query: {
          fields: '*items,*items.variant,*items.product,+items.thumbnail',
        },
        cache: "no-store",
      }
    );

    return response.order;
  } catch (error: any) {
    console.error(`Error fetching order (attempt ${retryCount + 1}/${maxRetries + 1}):`, error);

    // If it's a 500 error and we haven't exceeded retries, wait and try again
    if (error?.message?.includes('500') && retryCount < maxRetries) {
      console.log(`Retrying in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return getOrderById(orderId, retryCount + 1);
    }

    throw new Error('Order not found or could not be retrieved');
  }
};

/**
 * Get customer orders
 */
export const getCustomerOrders = async (
  customerId?: string,
  limit: number = 10,
  offset: number = 0
): Promise<OrdersResponse> => {
  try {
    const params: any = {
      limit,
      offset,
      expand: 'items,items.variant,items.product,shipping_address,customer'
    };

    if (customerId) {
      params.customer_id = customerId;
    }

    const response = await omnicartClient.get<OrdersResponse>(
      `/store/orders`,
      {
        query: params,
        cache: "no-store",
      }
    );

    return {
      orders: response.orders,
      count: response.count || 0,
      offset: response.offset || 0,
      limit: response.limit || limit
    };
  } catch (error) {
    console.error('Error fetching customer orders:', error);
    throw new Error('Failed to fetch orders');
  }
};

/**
 * Get order status display text
 */
export const getOrderStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    'pending': 'Pending',
    'completed': 'Completed',
    'archived': 'Archived',
    'canceled': 'Canceled',
    'requires_action': 'Requires Action'
  };
  
  return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
};

/**
 * Get fulfillment status display text
 */
export const getFulfillmentStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    'not_fulfilled': 'Processing',
    'partially_fulfilled': 'Partially Shipped',
    'fulfilled': 'Shipped',
    'partially_shipped': 'Partially Shipped',
    'shipped': 'Shipped',
    'delivered': 'Delivered'
  };
  
  return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
};

/**
 * Get payment status display text
 */
export const getPaymentStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    'not_paid': 'Payment Pending',
    'awaiting': 'Payment Pending',
    'captured': 'Paid',
    'partially_refunded': 'Partially Refunded',
    'refunded': 'Refunded',
    'canceled': 'Payment Canceled'
  };
  
  return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
};
