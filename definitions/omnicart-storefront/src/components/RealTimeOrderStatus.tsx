import React, { useState, useEffect } from 'react';
import { Bell, Clock, CheckCircle, Package, Truck, AlertCircle, RotateCcw, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getRealTimeOrderStatus,
  subscribeToOrderUpdates,
  markNotificationAsRead,
  formatOrderStatus,
  getOrderStatusColor,
  getOrderActions,
  type RealTimeOrderStatus as OrderStatusType,
  type OrderNotification
} from '@/services/omnicart/orderStatus';

interface RealTimeOrderStatusProps {
  orderId: string;
  showNotifications?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const StatusIcon = ({ status }: { status: string }) => {
  const iconProps = { className: "h-5 w-5" };
  
  switch (status) {
    case 'pending':
      return <Clock {...iconProps} className="h-5 w-5 text-yellow-600" />;
    case 'confirmed':
      return <CheckCircle {...iconProps} className="h-5 w-5 text-blue-600" />;
    case 'processing':
      return <Package {...iconProps} className="h-5 w-5 text-purple-600" />;
    case 'shipped':
      return <Truck {...iconProps} className="h-5 w-5 text-indigo-600" />;
    case 'delivered':
      return <CheckCircle {...iconProps} className="h-5 w-5 text-green-600" />;
    case 'canceled':
      return <AlertCircle {...iconProps} className="h-5 w-5 text-red-600" />;
    case 'returned':
      return <RotateCcw {...iconProps} className="h-5 w-5 text-gray-600" />;
    default:
      return <AlertCircle {...iconProps} className="h-5 w-5 text-gray-600" />;
  }
};

export const RealTimeOrderStatus: React.FC<RealTimeOrderStatusProps> = ({
  orderId,
  showNotifications = true,
  autoRefresh = true,
  refreshInterval = 30000
}) => {
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for real-time order status
  const { 
    data: orderStatus, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['real-time-order-status', orderId],
    queryFn: () => getRealTimeOrderStatus(orderId),
    enabled: !!orderId,
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchIntervalInBackground: true,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!orderId || !autoRefresh) return;

    const unsubscribe = subscribeToOrderUpdates(
      orderId,
      (updatedStatus) => {
        // Update the query cache with new data
        queryClient.setQueryData(['real-time-order-status', orderId], updatedStatus);
        
        // Show toast notification for status changes
        const latestUpdate = updatedStatus.status_history[updatedStatus.status_history.length - 1];
        if (latestUpdate) {
          toast({
            title: "Order Status Updated",
            description: latestUpdate.message,
          });
        }
      },
      (error) => {
        console.error('Real-time order status error:', error);
      }
    );

    return unsubscribe;
  }, [orderId, autoRefresh, queryClient, toast]);

  const handleNotificationDismiss = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      setDismissedNotifications(prev => new Set(prev).add(notificationId));
      toast({
        title: "Notification marked as read",
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Status refreshed",
      description: "Order status has been updated.",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-vnsh-red"></div>
            <span className="ml-2">Loading order status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600">Failed to load order status</p>
            <Button variant="outline" onClick={handleRefresh} className="mt-2">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!orderStatus) {
    return null;
  }

  const actions = getOrderActions(orderStatus.current_status);
  const visibleNotifications = orderStatus.notifications.filter(
    notification => !dismissedNotifications.has(notification.id) && !notification.read
  );

  return (
    <div className="space-y-6">
      {/* Current Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Order Status</span>
            <div className="flex items-center space-x-2">
              <Badge className={getOrderStatusColor(orderStatus.current_status)}>
                <StatusIcon status={orderStatus.current_status} />
                <span className="ml-1">{formatOrderStatus(orderStatus.current_status)}</span>
              </Badge>
              <Button variant="ghost" size="sm" onClick={handleRefresh}>
                Refresh
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Order ID</p>
              <p className="text-sm text-gray-600">{orderStatus.order_id}</p>
            </div>
            {orderStatus.estimated_delivery && (
              <div>
                <p className="text-sm font-medium text-gray-700">Estimated Delivery</p>
                <p className="text-sm text-gray-600">
                  {new Date(orderStatus.estimated_delivery).toLocaleDateString()}
                </p>
              </div>
            )}
            {orderStatus.tracking_number && (
              <div>
                <p className="text-sm font-medium text-gray-700">Tracking Number</p>
                <p className="text-sm text-gray-600">{orderStatus.tracking_number}</p>
              </div>
            )}
          </div>

          <div className="mt-4 text-xs text-gray-500">
            Last updated: {new Date(orderStatus.last_updated).toLocaleString()}
          </div>
        </CardContent>
      </Card>

      {/* Status History */}
      <Card>
        <CardHeader>
          <CardTitle>Status History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {orderStatus.status_history.map((update, index) => (
              <div key={update.id} className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className={`w-3 h-3 rounded-full ${
                    index === orderStatus.status_history.length - 1 ? 'bg-vnsh-red' : 'bg-gray-300'
                  }`} />
                  {index < orderStatus.status_history.length - 1 && (
                    <div className="w-0.5 h-8 bg-gray-200 ml-1 mt-1" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {formatOrderStatus(update.status)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(update.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{update.message}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      {showNotifications && visibleNotifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="h-5 w-5 mr-2" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {visibleNotifications.map((notification) => (
                <div key={notification.id} className="flex items-start justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-900">{notification.title}</h4>
                    <p className="text-sm text-blue-700 mt-1">{notification.message}</p>
                    <p className="text-xs text-blue-600 mt-1">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleNotificationDismiss(notification.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-2">
            {actions.canTrack && (
              <Button variant="outline" size="sm">
                Track Package
              </Button>
            )}
            {actions.canCancel && (
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                Cancel Order
              </Button>
            )}
            {actions.canReturn && (
              <Button variant="outline" size="sm">
                Return Items
              </Button>
            )}
            {actions.canReorder && (
              <Button variant="outline" size="sm">
                Reorder
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RealTimeOrderStatus;
