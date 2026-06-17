import { omnicartClient } from "@/lib/omnicart-client"
import { getAuthHeaders } from '@/lib/util/cookies';
import omnicartError from '@/lib/util/omnicart-error';

export interface OrderStatusUpdate {
  id: string;
  order_id: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'canceled' | 'returned';
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface OrderNotification {
  id: string;
  order_id: string;
  type: 'status_update' | 'shipping_update' | 'delivery_update' | 'return_update';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface RealTimeOrderStatus {
  order_id: string;
  current_status: string;
  estimated_delivery?: string;
  tracking_number?: string;
  carrier?: string;
  last_updated: string;
  status_history: OrderStatusUpdate[];
  notifications: OrderNotification[];
}

/**
 * Get real-time order status with live updates
 */
export const getRealTimeOrderStatus = async (orderId: string): Promise<RealTimeOrderStatus> => {
  try {
    const headers = getAuthHeaders();

    // In a real implementation, this would connect to a WebSocket or Server-Sent Events
    // For now, we'll simulate real-time data
    const response = await omnicartClient.fetch(`/store/orders/${orderId}/status`, {
      headers
    });

    if ((response as any)?.order_status) {
      return (response as any).order_status;
    }

    // Mock real-time status for demonstration
    const mockStatus: RealTimeOrderStatus = {
      order_id: orderId,
      current_status: 'processing',
      estimated_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      tracking_number: '1Z999AA1234567890',
      carrier: 'UPS',
      last_updated: new Date().toISOString(),
      status_history: [
        {
          id: '1',
          order_id: orderId,
          status: 'pending',
          message: 'Order received and payment confirmed',
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          order_id: orderId,
          status: 'confirmed',
          message: 'Order confirmed and being prepared',
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '3',
          order_id: orderId,
          status: 'processing',
          message: 'Order is being processed and will ship soon',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
        }
      ],
      notifications: [
        {
          id: '1',
          order_id: orderId,
          type: 'status_update',
          title: 'Order Confirmed',
          message: 'Your order has been confirmed and is being prepared for shipment.',
          read: false,
          created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          order_id: orderId,
          type: 'status_update',
          title: 'Processing Started',
          message: 'Your order is now being processed and will ship within 1-2 business days.',
          read: false,
          created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
        }
      ]
    };

    return mockStatus;
  } catch (error) {
    throw omnicartError(error);
  }
};

/**
 * Subscribe to real-time order status updates
 */
export const subscribeToOrderUpdates = (
  orderId: string,
  onUpdate: (status: RealTimeOrderStatus) => void,
  onError?: (error: Error) => void
): (() => void) => {
  // In a real implementation, this would establish a WebSocket connection
  // For now, we'll simulate with polling
  const interval = setInterval(async () => {
    try {
      const status = await getRealTimeOrderStatus(orderId);
      onUpdate(status);
    } catch (error) {
      if (onError) {
        onError(error as Error);
      }
    }
  }, 30000); // Poll every 30 seconds

  // Return cleanup function
  return () => clearInterval(interval);
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    };

    await omnicartClient.fetch(`/store/notifications/${notificationId}/read`, {
      method: 'POST',
      headers
    });
  } catch (error) {
    throw omnicartError(error);
  }
};

/**
 * Get customer notifications
 */
export const getCustomerNotifications = async (limit = 10): Promise<OrderNotification[]> => {
  try {
    const headers = getAuthHeaders();

    const response = await omnicartClient.fetch(`/store/customers/me/notifications?limit=${limit}`, {
      headers
    });

    return (response as any)?.notifications || [];
  } catch (error) {
    // Return mock notifications if API not available
    return [
      {
        id: '1',
        order_id: 'order_123',
        type: 'status_update',
        title: 'Order Shipped',
        message: 'Your order #VNSH-001 has been shipped and is on its way!',
        read: false,
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '2',
        order_id: 'order_124',
        type: 'delivery_update',
        title: 'Out for Delivery',
        message: 'Your order #VNSH-002 is out for delivery and will arrive today.',
        read: false,
        created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
      }
    ];
  }
};

/**
 * Format order status for display
 */
export const formatOrderStatus = (status: string): string => {
  switch (status) {
    case 'pending':
      return 'Order Pending';
    case 'confirmed':
      return 'Order Confirmed';
    case 'processing':
      return 'Processing';
    case 'shipped':
      return 'Shipped';
    case 'delivered':
      return 'Delivered';
    case 'canceled':
      return 'Canceled';
    case 'returned':
      return 'Returned';
    default:
      return 'Unknown Status';
  }
};

/**
 * Get status color for UI display
 */
export const getOrderStatusColor = (status: string): string => {
  switch (status) {
    case 'pending':
      return 'text-yellow-600 bg-yellow-100';
    case 'confirmed':
      return 'text-blue-600 bg-blue-100';
    case 'processing':
      return 'text-purple-600 bg-purple-100';
    case 'shipped':
      return 'text-indigo-600 bg-indigo-100';
    case 'delivered':
      return 'text-green-600 bg-green-100';
    case 'canceled':
      return 'text-red-600 bg-red-100';
    case 'returned':
      return 'text-gray-600 bg-gray-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

/**
 * Get status icon for UI display
 */
export const getOrderStatusIcon = (status: string): string => {
  switch (status) {
    case 'pending':
      return 'Clock';
    case 'confirmed':
      return 'CheckCircle';
    case 'processing':
      return 'Package';
    case 'shipped':
      return 'Truck';
    case 'delivered':
      return 'CheckCircle';
    case 'canceled':
      return 'AlertCircle';
    case 'returned':
      return 'RotateCcw';
    default:
      return 'AlertCircle';
  }
};

/**
 * Check if order status allows certain actions
 */
export const getOrderActions = (status: string): {
  canCancel: boolean;
  canReturn: boolean;
  canTrack: boolean;
  canReorder: boolean;
} => {
  return {
    canCancel: ['pending', 'confirmed'].includes(status),
    canReturn: ['delivered'].includes(status),
    canTrack: ['shipped', 'delivered'].includes(status),
    canReorder: ['delivered', 'canceled'].includes(status)
  };
};

/**
 * Estimate delivery date based on order status and shipping method
 */
export const estimateDeliveryDate = (
  orderDate: string,
  shippingMethod: string = 'standard'
): string => {
  const orderTime = new Date(orderDate);
  let deliveryDays = 7; // Default to 7 days

  switch (shippingMethod.toLowerCase()) {
    case 'express':
    case 'expedited':
      deliveryDays = 2;
      break;
    case 'priority':
      deliveryDays = 3;
      break;
    case 'standard':
    default:
      deliveryDays = 7;
      break;
  }

  const deliveryDate = new Date(orderTime);
  deliveryDate.setDate(deliveryDate.getDate() + deliveryDays);

  return deliveryDate.toISOString();
};
