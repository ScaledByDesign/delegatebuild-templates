
import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Check, Truck, Receipt, FileText, ArrowLeft, Download, Printer } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { getOrderById } from '@/services/omnicart/orders';

const ReceiptPage = () => {
  const { orderId } = useParams();
  const location = useLocation();

  // Try to get order ID from URL params or location state
  const orderIdToFetch = orderId || location.state?.orderId;

  // Fetch order details from Medusa
  const { data: orderData, isLoading, error } = useQuery({
    queryKey: ['order-receipt', orderIdToFetch],
    queryFn: () => getOrderById(orderIdToFetch!),
    enabled: !!orderIdToFetch,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow bg-gray-50 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading receipt...</p>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow bg-gray-50 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center">
              <h1 className="text-2xl font-bold text-red-600 mb-4">Order Not Found</h1>
              <p className="text-gray-600 mb-8">The order you're looking for could not be found.</p>
              <Button asChild>
                <Link to="/">Return to Home</Link>
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Transform order data for display
  const mockOrderDetails = {
    orderId: `#${orderData.display_id}`,
    orderDate: new Date(orderData.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    customer: {
      name: orderData.shipping_address ?
        `${orderData.shipping_address.first_name} ${orderData.shipping_address.last_name}` :
        'Customer',
      email: orderData.customer?.email || 'customer@example.com',
      address: orderData.shipping_address ?
        `${orderData.shipping_address.address_1}\n${orderData.shipping_address.city}, ${orderData.shipping_address.province} ${orderData.shipping_address.postal_code}` :
        'Address not available',
      phone: 'Phone not available'
    },
    items: orderData.items.map(item => ({
      id: item.id,
      name: item.title,
      variant: item.variant,
      // Medusa v2 stores prices in major units (dollars, not cents)
      price: item.unit_price,
      quantity: item.quantity
    })),
    shipping: {
      method: 'Standard Shipping',
      // Medusa v2 stores prices in major units (dollars, not cents)
      cost: orderData.shipping_total,
      estimatedDelivery: '3-5 business days'
    },
    payment: {
      method: 'Credit Card',
      last4: '****',
    },
    // Medusa v2 stores prices in major units (dollars, not cents)
    subtotal: orderData.subtotal,
    tax: orderData.tax_total,
    discount: orderData.discount_total || 0,
    total: orderData.total
  };

  // Function to print receipt
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-8 print:py-0">
        <div className="max-w-3xl mx-auto">
          {/* Back button */}
          <div className="mb-6 print:hidden">
            <Button 
              variant="outline" 
              size="sm"
              asChild 
              className="flex items-center"
            >
              <Link to="/checkout-success">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Order Confirmation
              </Link>
            </Button>
          </div>
          
          <Card className="mb-6 overflow-hidden print:shadow-none">
            <CardHeader className="bg-white border-b p-6 flex flex-row items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center">
                  <Receipt className="mr-2 h-6 w-6 text-vnsh-red" />
                  Receipt
                </h1>
                <p className="text-gray-500 text-sm mt-1">Thank you for your purchase!</p>
              </div>
              <div className="print:hidden flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePrint}
                  className="flex items-center"
                >
                  <Printer className="mr-1 h-4 w-4" /> Print
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center"
                >
                  <Download className="mr-1 h-4 w-4" /> Save PDF
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-b">
                <div className="p-6 border-r border-b md:border-b-0">
                  <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-2">Order Information</h3>
                  <div className="space-y-1">
                    <p className="text-sm"><span className="font-medium">Order ID:</span> {mockOrderDetails.orderId}</p>
                    <p className="text-sm"><span className="font-medium">Date:</span> {mockOrderDetails.orderDate}</p>
                    <p className="text-sm"><span className="font-medium">Payment:</span> {mockOrderDetails.payment.method} (**** {mockOrderDetails.payment.last4})</p>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-2">Shipping Information</h3>
                  <div className="space-y-1">
                    <p className="text-sm"><span className="font-medium">Method:</span> {mockOrderDetails.shipping.method}</p>
                    <p className="text-sm"><span className="font-medium">Estimated Delivery:</span> {mockOrderDetails.shipping.estimatedDelivery}</p>
                    <div className="flex items-center mt-2 text-green-600">
                      <Check className="h-4 w-4 mr-1" />
                      <span className="text-sm font-medium">Processing</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Order Items */}
              <div className="p-6 border-b">
                <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-4">Order Items</h3>
                
                <div className="space-y-4">
                  {mockOrderDetails.items.map(item => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <div className="flex-grow">
                        <p className="font-medium">{item.name}</p>
                        {item.variant?.title && item.variant.title !== 'Default' && item.variant.title !== 'Default Title' && (
                          <div className="text-sm text-gray-600 mt-0.5">
                            {item.variant.title.split(' / ').map((part, index) => {
                              const [key, value] = part.includes(':')
                                ? part.split(':').map(s => s.trim())
                                : ['Option', part.trim()];
                              return (
                                <span key={index} className="mr-2">
                                  {key}: {value}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${item.price.toFixed(2)}</p>
                        <p className="text-sm text-gray-500">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Customer Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-b">
                <div className="p-6 border-r border-b md:border-b-0">
                  <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-2">Customer</h3>
                  <div className="space-y-1">
                    <p className="text-sm">{mockOrderDetails.customer.name}</p>
                    <p className="text-sm">{mockOrderDetails.customer.email}</p>
                    <p className="text-sm">{mockOrderDetails.customer.phone}</p>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-2">Shipping Address</h3>
                  <p className="text-sm whitespace-pre-line">{mockOrderDetails.customer.address}</p>
                </div>
              </div>
              
              {/* Payment Summary */}
              <div className="p-6">
                <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-4">Payment Summary</h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span>${mockOrderDetails.subtotal.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping</span>
                    <span>${mockOrderDetails.shipping.cost.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax</span>
                    <span>${mockOrderDetails.tax.toFixed(2)}</span>
                  </div>
                  
                  {mockOrderDetails.discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-${mockOrderDetails.discount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <Separator className="my-3" />
                  
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>${mockOrderDetails.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="p-6 bg-gray-50 border-t print:hidden">
              <div className="w-full space-y-3">
                <Button asChild className="w-full bg-vnsh-green hover:bg-[#0f4a1c]">
                  <Link to="/track-order">
                    <Truck className="mr-2 h-4 w-4" />
                    Track Your Order
                  </Link>
                </Button>
                
                <Button asChild variant="outline" className="w-full">
                  <Link to="/returns">
                    <FileText className="mr-2 h-4 w-4" />
                    Return or Exchange Items
                  </Link>
                </Button>
                
                <Button asChild variant="outline" className="w-full">
                  <Link to="/collections/products">Continue Shopping</Link>
                </Button>
              </div>
            </CardFooter>
          </Card>
          
          {/* Print-specific footer */}
          <div className="hidden print:block text-center text-sm text-gray-500 mt-8">
            <p>Thank you for shopping with VNSH!</p>
            <p>For any questions, please contact support@vnsh.com</p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ReceiptPage;
