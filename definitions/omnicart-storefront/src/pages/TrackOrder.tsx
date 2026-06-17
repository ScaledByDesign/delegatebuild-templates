import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Package, AlertCircle, CheckCircle, Clock, ExternalLink, MapPin, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { getOrderById, getOrderStatusText, getFulfillmentStatusText } from '@/services/omnicart/orders';
import {
  trackPackage,
  getTrackingUrl,
  detectShippingProvider,
  getStatusColor,
  formatTrackingStatus,
  type TrackingInfo
} from '@/services/shipping/trackingService';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import RealTimeOrderStatus from '@/components/RealTimeOrderStatus';
import KonnektiveOrderWidget from '@/components/KonnektiveOrderWidget';

interface OrderData {
  id: string;
  display_id: string;
  status: string;
  created_at: string;
  items: Array<{
    title: string;
    quantity: number;
  }>;
  shipping_address?: {
    first_name: string;
    last_name: string;
  };
  total: number;
}

const TrackOrder = () => {
  const [orderId, setOrderId] = useState('');
  const [searchOrderId, setSearchOrderId] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [searchTrackingNumber, setSearchTrackingNumber] = useState('');
  const { toast } = useToast();

  // Query for order data using Medusa
  const { data: orderData, isLoading: orderLoading, error: orderError } = useQuery({
    queryKey: ['order', searchOrderId],
    queryFn: () => getOrderById(searchOrderId),
    enabled: !!searchOrderId,
    retry: false,
  });

  // Query for tracking data
  const { data: trackingData, isLoading: trackingLoading, error: trackingError } = useQuery({
    queryKey: ['tracking', searchTrackingNumber],
    queryFn: () => trackPackage(searchTrackingNumber),
    enabled: !!searchTrackingNumber,
    retry: false,
  });

  const handleTrackOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim()) {
      toast({
        variant: "destructive",
        title: "Order ID required",
        description: "Please enter an order ID to track.",
      });
      return;
    }
    setSearchOrderId(orderId.trim());
  };

  const handleTrackPackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingNumber.trim()) {
      toast({
        variant: "destructive",
        title: "Tracking number required",
        description: "Please enter a tracking number to track.",
      });
      return;
    }

    const provider = detectShippingProvider(trackingNumber.trim());
    if (provider === 'unknown') {
      toast({
        variant: "destructive",
        title: "Invalid tracking number",
        description: "Please check your tracking number format and try again.",
      });
      return;
    }

    setSearchTrackingNumber(trackingNumber.trim());
  };

  // Handle query errors
  React.useEffect(() => {
    if (orderError && searchOrderId) {
      toast({
        variant: "destructive",
        title: "Order not found",
        description: "Please check your order ID and try again.",
      });
    }
  }, [orderError, searchOrderId, toast]);

  React.useEffect(() => {
    if (trackingError && searchTrackingNumber) {
      toast({
        variant: "destructive",
        title: "Tracking not found",
        description: "Unable to retrieve tracking information. Please try again later.",
      });
    }
  }, [trackingError, searchTrackingNumber, toast]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'placed':
        return <Clock className="h-6 w-6 text-blue-500" />;
      case 'processing':
        return <Package className="h-6 w-6 text-orange-500" />;
      case 'shipped':
        return <Truck className="h-6 w-6 text-blue-600" />;
      case 'delivered':
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case 'cancelled':
        return <AlertCircle className="h-6 w-6 text-red-600" />;
      default:
        return <Clock className="h-6 w-6 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold mb-6">Track Your Order</h1>
          
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <form onSubmit={handleTrackOrder} className="space-y-4">
              <div>
                <label htmlFor="orderId" className="block text-sm font-medium text-gray-700 mb-1">
                  Order ID
                </label>
                <div className="flex gap-2">
                  <Input
                    id="orderId"
                    placeholder="Enter your order ID (e.g., VNSH-1234)"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" className="bg-vnsh-red hover:bg-[#0f4a1c]" disabled={orderLoading}>
                    {orderLoading ? "Tracking..." : "Track Order"}
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Your order ID can be found in your confirmation email or receipt
                </p>
              </div>
            </form>

            <Separator className="my-6" />

            <form onSubmit={handleTrackPackage} className="space-y-4">
              <div>
                <label htmlFor="trackingNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Tracking Number
                </label>
                <div className="flex gap-2">
                  <Input
                    id="trackingNumber"
                    placeholder="Enter tracking number (UPS, FedEx, USPS, DHL)"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" className="bg-vnsh-red hover:bg-[#0f4a1c]" disabled={trackingLoading}>
                    {trackingLoading ? "Tracking..." : "Track Package"}
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Track your package directly with the shipping carrier
                </p>
              </div>
            </form>
            
            {orderData && (
              <div className="mt-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Order Information</h2>
                    <dl className="space-y-1">
                      <div className="flex">
                        <dt className="w-32 text-sm text-gray-500">Order ID:</dt>
                        <dd className="text-sm font-medium">#{orderData.display_id}</dd>
                      </div>
                      <div className="flex">
                        <dt className="w-32 text-sm text-gray-500">Order Date:</dt>
                        <dd className="text-sm">{new Date(orderData.created_at).toLocaleDateString()}</dd>
                      </div>
                      <div className="flex">
                        <dt className="w-32 text-sm text-gray-500">Status:</dt>
                        <dd className="text-sm font-medium flex items-center">
                          {getStatusIcon(orderData.fulfillment_status)}
                          <span className="ml-2">{getFulfillmentStatusText(orderData.fulfillment_status)}</span>
                        </dd>
                      </div>
                      <div className="flex">
                        <dt className="w-32 text-sm text-gray-500">Total:</dt>
                        {/* Medusa v2 stores prices in major units (dollars, not cents) */}
                        <dd className="text-sm font-medium">${orderData.total.toFixed(2)}</dd>
                      </div>
                    </dl>
                  </div>
                  
                  {orderData.shipping_address && (
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Shipping Address</h2>
                      <div className="text-sm">
                        <p>{orderData.shipping_address.first_name} {orderData.shipping_address.last_name}</p>
                        <p>{orderData.shipping_address.address_1}</p>
                        {orderData.shipping_address.address_2 && <p>{orderData.shipping_address.address_2}</p>}
                        <p>{orderData.shipping_address.city}, {orderData.shipping_address.province} {orderData.shipping_address.postal_code}</p>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Konnektive Order Widget */}
                <KonnektiveOrderWidget
                  orderId={orderData.id}
                  metadata={orderData.metadata}
                  hideIfNoData={true}
                />

                <Separator />

                <div>
                  <h2 className="text-lg font-semibold mb-4">Order Items</h2>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderData.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.title}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          {/* Medusa v2 stores prices in major units (dollars, not cents) */}
                          <TableCell className="text-right">${item.unit_price.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {orderData.fulfillment_status === 'fulfilled' && (
                  <div className="text-center mt-4">
                    <Button asChild variant="outline" className="mx-auto">
                      <Link to="/returns">Need to return an item?</Link>
                    </Button>
                  </div>
                )}
              </div>
            )}

            {trackingData && (
              <div className="mt-8 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Package Tracking</span>
                      <Badge className={getStatusColor(trackingData.status)}>
                        {formatTrackingStatus(trackingData.status)}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Tracking Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <Package className="h-8 w-8 mx-auto mb-2 text-vnsh-red" />
                        <p className="text-sm font-medium">Tracking Number</p>
                        <p className="text-xs text-gray-600">{trackingData.trackingNumber}</p>
                      </div>
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <Truck className="h-8 w-8 mx-auto mb-2 text-vnsh-red" />
                        <p className="text-sm font-medium">Carrier</p>
                        <p className="text-xs text-gray-600">{trackingData.carrier}</p>
                      </div>
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <Calendar className="h-8 w-8 mx-auto mb-2 text-vnsh-red" />
                        <p className="text-sm font-medium">Est. Delivery</p>
                        <p className="text-xs text-gray-600">
                          {trackingData.estimatedDelivery
                            ? new Date(trackingData.estimatedDelivery).toLocaleDateString()
                            : 'TBD'
                          }
                        </p>
                      </div>
                    </div>

                    {/* Tracking Timeline */}
                    <div>
                      <h3 className="font-semibold mb-4">Tracking History</h3>
                      <div className="space-y-4">
                        {trackingData.events.map((event, index) => (
                          <div key={event.id} className="flex items-start space-x-4">
                            <div className="flex-shrink-0">
                              <div className={`w-3 h-3 rounded-full ${
                                index === 0 ? 'bg-vnsh-red' : 'bg-gray-300'
                              }`} />
                              {index < trackingData.events.length - 1 && (
                                <div className="w-0.5 h-8 bg-gray-200 ml-1 mt-1" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-gray-900">
                                  {event.description}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(event.timestamp).toLocaleString()}
                                </p>
                              </div>
                              {event.location && (
                                <p className="text-xs text-gray-600 flex items-center mt-1">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {event.location}
                                </p>
                              )}
                              {event.details && (
                                <p className="text-xs text-gray-500 mt-1">{event.details}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* External Tracking Link */}
                    <div className="pt-4 border-t">
                      <Button
                        asChild
                        variant="outline"
                        className="w-full"
                      >
                        <a
                          href={getTrackingUrl(detectShippingProvider(trackingData.trackingNumber), trackingData.trackingNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center"
                        >
                          View on {trackingData.carrier} Website
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Real-time Order Status Section */}
          {searchOrderId && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Real-time Order Status</h2>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Live Updates
                </Badge>
              </div>
              <RealTimeOrderStatus
                orderId={searchOrderId}
                showNotifications={true}
                autoRefresh={true}
                refreshInterval={30000}
              />
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Where can I find my Order ID?</h3>
                <p className="text-sm text-gray-600">Your Order ID is included in your order confirmation email and receipt. It begins with "VNSH-" followed by numbers.</p>
              </div>
              <div>
                <h3 className="font-medium">How long does shipping take?</h3>
                <p className="text-sm text-gray-600">Standard shipping typically takes 3-5 business days. Expedited shipping options are available at checkout.</p>
              </div>
              <div>
                <h3 className="font-medium">Can I change my shipping address?</h3>
                <p className="text-sm text-gray-600">Please contact customer service immediately if you need to change your shipping address. We can only make changes if the order hasn't shipped yet.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default TrackOrder;
