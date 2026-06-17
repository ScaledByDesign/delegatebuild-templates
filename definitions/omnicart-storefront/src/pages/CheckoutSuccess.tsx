
import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, ShoppingBag, ArrowRight, Receipt, Truck, Package, MapPin, CreditCard, Mail, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getOrderById } from '@/services/omnicart/orders';
import KonnektiveOrderWidget from '@/components/KonnektiveOrderWidget';
import { formatCurrency } from '@/lib/price';
import { trackPurchase, identifyUser } from '@/hooks/useTracking';
import { useCart } from '@/hooks/useCart';

// Format province code for display (e.g., "us-tx" -> "TX", "TX" -> "TX")
const formatProvinceForDisplay = (province: string | null | undefined): string => {
  if (!province) return '';
  // Handle Medusa ISO 3166-2 format (e.g., "us-tx" -> "TX")
  if (province.includes('-')) {
    return province.split('-').pop()?.toUpperCase() || province.toUpperCase();
  }
  // Already a state code or full name
  return province.toUpperCase();
};

const CheckoutSuccess = () => {
  const [searchParams] = useSearchParams();
  const orderIdFromParam = searchParams.get('order_id');
  const [orderData, setOrderData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(!!orderIdFromParam);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [membershipData, setMembershipData] = useState<{
    has_membership: boolean;
    status: string | null;
    password: string | null;
  } | null>(null);
  const { clearCart } = useCart();
  const cartClearedRef = useRef(false);

  // Clear cart on checkout success page load (safety net)
  // This ensures cart is fully cleared even if it wasn't properly cleared during checkout
  useEffect(() => {
    if (!cartClearedRef.current) {
      cartClearedRef.current = true;
      clearCart();
      console.log('🧹 CheckoutSuccess: Cart cleared on page load');
    }
  }, [clearCart]);

  // Fetch order data if order_id is provided
  useEffect(() => {
    if (orderIdFromParam) {
      setIsLoading(true);
      setFetchError(null);
      getOrderById(orderIdFromParam)
        .then((data) => {
          setOrderData(data);
          setFetchError(null);
        })
        .catch((error) => {
          console.error('Failed to fetch order details:', error);
          setFetchError('We could not retrieve your order details at this time. Your order has been confirmed and you should receive a confirmation email shortly.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [orderIdFromParam]);

  // Fetch membership credentials when order data is loaded
  useEffect(() => {
    if (orderData?.id) {
      import('@/lib/omnicart-client').then(({ omnicartClient }) => {
        omnicartClient.get<{ membership: { has_membership: boolean; status: string | null; password: string | null } }>(
          '/store/membership/status',
          { query: { order_id: orderData.id }, cache: 'no-store' }
        ).then((res) => {
          if (res.membership?.has_membership) {
            setMembershipData(res.membership);
          }
        }).catch((err) => {
          console.warn('Could not fetch membership status:', err);
        });
      });
    }
  }, [orderData]);

  // Track purchase event and identify user when order data is loaded
  useEffect(() => {
    if (orderData && orderData.id) {
      // Track purchase event with full product details for Attentive
      trackPurchase({
        order_id: orderData.id,
        total: orderData.total || 0,
        currency: orderData.currency_code || 'USD',
        user_email: orderData.email,
        user_phone: orderData.shipping_address?.phone || orderData.billing_address?.phone,
        items: (orderData.items || []).map((item: any) => ({
          id: item.product_id || item.id,
          name: item.title || 'Unknown Product',
          price: item.unit_price || 0,
          quantity: item.quantity || 1,
          variant_id: item.variant_id || item.id,
          // Only include optional fields if they have values (Attentive best practice: avoid empty strings)
          image_url: item.thumbnail || undefined,
          category: item.product?.collection?.title || undefined,
        })),
      });

      // Identify user if email is available
      if (orderData.email) {
        identifyUser(orderData.email, {
          email: orderData.email,
          phone: orderData.shipping_address?.phone || orderData.billing_address?.phone || undefined,
          order_id: orderData.id,
          order_total: orderData.total,
          currency: orderData.currency_code,
        });
      }
    }
  }, [orderData]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-grow py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Success Header */}
          <div className="bg-white rounded-lg shadow-sm p-6 md:p-8 mb-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>

            <h1 className="text-2xl md:text-3xl font-bold mb-2">Thank You for Your Order!</h1>
            <p className="text-gray-600 mb-4">
              Your order has been confirmed and is being processed.
            </p>

            {/* Order Number - Only show when data is loaded or show loading skeleton */}
            {isLoading ? (
              <div className="inline-flex items-center gap-2 bg-gray-50 rounded-md px-4 py-2">
                <span className="text-sm text-gray-600">Order Number:</span>
                <div className="h-6 w-24 bg-gray-200 animate-pulse rounded"></div>
              </div>
            ) : orderData?.display_id ? (
              <div className="inline-flex items-center gap-2 bg-gray-50 rounded-md px-4 py-2">
                <span className="text-sm text-gray-600">Order Number:</span>
                <span className="font-semibold text-lg">#{orderData.display_id}</span>
              </div>
            ) : null}

            {fetchError && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">⚠️ {fetchError}</p>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <div className="inline-block">
                <div className="animate-spin h-8 w-8 border-3 border-vnsh-red border-t-transparent rounded-full"></div>
              </div>
              <p className="text-gray-600 mt-4">Loading order details...</p>
            </div>
          ) : orderData ? (
            <>
              {/* Order Items */}
              <div className="bg-white rounded-lg shadow-sm p-6 md:p-8 mb-6">
                <div className="flex items-center gap-2 mb-6">
                  <Package className="h-5 w-5 text-gray-700" />
                  <h2 className="text-xl font-semibold">Order Items</h2>
                </div>

                <div className="space-y-4">
                  {orderData.items?.map((item: any) => (
                    <div key={item.id} className="flex gap-4 pb-4 border-b last:border-b-0">
                      {/* Product Image */}
                      <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-md overflow-hidden">
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-grow">
                        <h3 className="font-medium text-gray-900">{item.title}</h3>
                        {item.variant?.title && item.variant.title !== 'Default' && item.variant.title !== 'Default Title' && (
                          <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                            {item.variant.title.split(' / ').map((part, index) => {
                              // Parse option name and value from "OptionName:Value" format
                              const [key, value] = part.includes(':')
                                ? part.split(':').map(s => s.trim())
                                : ['Option', part.trim()];
                              return (
                                <div key={index}>
                                  <span className="font-normal">{key}:</span> {value}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <p className="text-sm text-gray-600 mt-1">Quantity: {item.quantity}</p>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(item.unit_price * item.quantity, orderData.currency_code)}
                        </p>
                        {item.quantity > 1 && (
                          <p className="text-sm text-gray-600">
                            {formatCurrency(item.unit_price, orderData.currency_code)} each
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-white rounded-lg shadow-sm p-6 md:p-8 mb-6">
                <h2 className="text-xl font-semibold mb-6">Order Summary</h2>

                <div className="space-y-3">
                  <div className="flex justify-between text-gray-700">
                    <span>Subtotal</span>
                    <span>{formatCurrency(orderData.item_subtotal || orderData.subtotal || 0, orderData.currency_code)}</span>
                  </div>

                  {(orderData.shipping_subtotal > 0 || orderData.shipping_total > 0) && (
                    <div className="flex justify-between text-gray-700">
                      <span>Shipping</span>
                      <span>{formatCurrency(orderData.shipping_subtotal || orderData.shipping_total || 0, orderData.currency_code)}</span>
                    </div>
                  )}

                  {orderData.tax_total > 0 && (
                    <div className="flex justify-between text-gray-700">
                      <span>Tax</span>
                      <span>{formatCurrency(orderData.tax_total || 0, orderData.currency_code)}</span>
                    </div>
                  )}

                  {orderData.discount_total > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(orderData.discount_total || 0, orderData.currency_code)}</span>
                    </div>
                  )}

                  <Separator className="my-3" />

                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(orderData.total || 0, orderData.currency_code)}</span>
                  </div>
                </div>
              </div>

              {/* Shipping & Contact Info */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {/* Shipping Address */}
                {orderData.shipping_address && (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <MapPin className="h-5 w-5 text-gray-700" />
                      <h3 className="font-semibold">Shipping Address</h3>
                    </div>
                    <div className="text-gray-700 space-y-1">
                      <p>{orderData.shipping_address.first_name} {orderData.shipping_address.last_name}</p>
                      <p>{orderData.shipping_address.address_1}</p>
                      {orderData.shipping_address.address_2 && <p>{orderData.shipping_address.address_2}</p>}
                      <p>
                        {orderData.shipping_address.city}, {formatProvinceForDisplay(orderData.shipping_address.province)} {orderData.shipping_address.postal_code}
                      </p>
                      <p className="uppercase">{orderData.shipping_address.country_code}</p>
                      {orderData.shipping_address.phone && <p className="pt-2">{orderData.shipping_address.phone}</p>}
                    </div>
                  </div>
                )}

                {/* Contact & Payment Info */}
                <div className="space-y-6">
                  {/* Email */}
                  {orderData.email && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Mail className="h-5 w-5 text-gray-700" />
                        <h3 className="font-semibold">Contact Information</h3>
                      </div>
                      <p className="text-gray-700">{orderData.email}</p>
                      <p className="text-sm text-gray-600 mt-2">
                        A confirmation email has been sent to this address.
                      </p>
                    </div>
                  )}

                  {/* Payment Status */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <CreditCard className="h-5 w-5 text-gray-700" />
                      <h3 className="font-semibold">Payment</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-gray-700">Payment Confirmed</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* FLP / TRN Membership Credentials */}
              {membershipData?.has_membership && (
                <div className="bg-white rounded-lg shadow-sm p-6 md:p-8 mb-6 border-2 border-green-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-green-600" />
                    <h2 className="text-xl font-semibold text-green-800">Your Membership Is Active!</h2>
                  </div>
                  <p className="text-gray-700 mb-4">
                    Your FLP / TRN membership has been activated. Use the password below to access your member portal.
                  </p>
                  <div className="bg-gray-50 rounded-md p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Membership Password</p>
                      <p className="text-2xl font-mono font-bold tracking-wider text-gray-900">
                        {membershipData.password}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(membershipData.password || '');
                      }}
                      className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-3">
                    This password has also been saved to your account. You can find it in your order confirmation email.
                  </p>
                </div>
              )}

              {/* Konnektive Order Widget */}
              {orderData.metadata && (
                <div className="mb-6">
                  <KonnektiveOrderWidget
                    orderId={orderData.id}
                    metadata={orderData.metadata}
                    hideIfNoData={true}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="bg-white rounded-lg shadow-sm p-6 md:p-8">
                <h3 className="font-semibold mb-4">What's Next?</h3>
                <div className="flex justify-center">
                  <Button asChild variant="outline" className="w-full sm:w-auto min-w-[200px]">
                    <Link to="/collections/all">
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      Continue Shopping
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          ) : (
            /* No order data - show simple confirmation */
            <div className="bg-white rounded-lg shadow-sm p-6 md:p-8">
              <p className="text-gray-600 text-center mb-6">
                We've sent a confirmation email with your order details.
              </p>
              <div className="flex justify-center">
                <Button asChild variant="outline" className="w-full sm:w-auto min-w-[200px]">
                  <Link to="/collections/all">
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Continue Shopping
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CheckoutSuccess;
