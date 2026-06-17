import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Package, Settings, MapPin, CreditCard, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { useCustomer } from '@/hooks/useCustomer';
import { getCustomerOrders, getOrderStatusText, getFulfillmentStatusText } from '@/services/omnicart/orders';
import KonnektiveOrderWidget from '@/components/KonnektiveOrderWidget';

const Account = () => {
  const { toast } = useToast();
  const { customer, logout, updateProfile } = useCustomer();

  // Initialize profile data from customer context
  const [profileData, setProfileData] = useState({
    firstName: customer?.first_name || '',
    lastName: customer?.last_name || '',
    email: customer?.email || '',
    phone: customer?.phone || ''
  });

  // Update profile data when customer data changes
  React.useEffect(() => {
    if (customer) {
      setProfileData({
        firstName: customer.first_name || '',
        lastName: customer.last_name || '',
        email: customer.email || '',
        phone: customer.phone || ''
      });
    }
  }, [customer]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const success = await updateProfile({
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        email: profileData.email,
        phone: profileData.phone
      });

      if (success) {
        toast({
          title: "Profile updated",
          description: "Your profile information has been saved successfully.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Unable to update profile. Please try again.",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Fetch customer orders from Medusa
  const { data: ordersResponse, isLoading: ordersLoading } = useQuery({
    queryKey: ['customer-orders'],
    queryFn: () => getCustomerOrders(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const orders = ordersResponse?.orders?.map(order => ({
    id: order.id,
    displayId: `#${order.display_id}`,
    date: new Date(order.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    status: getFulfillmentStatusText(order.fulfillment_status),
    // Medusa v2 stores prices in major units (dollars, not cents)
    total: `$${order.total.toFixed(2)}`,
    items: order.items.map(item => item.title).join(', '),
    metadata: order.metadata
  })) || [];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow bg-gray-50">
        {/* Header */}
        <section className="bg-white border-b">
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-gray-600" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-black">
                  Welcome back, {customer?.first_name || 'User'}!
                </h1>
                <p className="text-gray-600">Manage your account settings and preferences</p>
              </div>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="flex items-center gap-2 text-vnsh-red border-vnsh-red hover:bg-vnsh-red hover:text-white"
              >
                <LogOut size={16} />
                Logout
              </Button>
            </div>
          </div>
        </section>

        {/* Account Content */}
        <section className="py-8">
          <div className="container mx-auto px-4">
            <Tabs defaultValue="profile" className="max-w-4xl mx-auto">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="profile" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="orders" className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Orders
                </TabsTrigger>
                <TabsTrigger value="addresses" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Addresses
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </TabsTrigger>
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleProfileUpdate} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">First Name</label>
                          <Input
                            value={profileData.firstName}
                            onChange={(e) => handleInputChange('firstName', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Last Name</label>
                          <Input
                            value={profileData.lastName}
                            onChange={(e) => handleInputChange('lastName', e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Email</label>
                        <Input
                          type="email"
                          value={profileData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Phone</label>
                        <Input
                          type="tel"
                          value={profileData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                        />
                      </div>
                      <Button type="submit" className="bg-[#176326] hover:bg-[#0f4a1c]">
                        Update Profile
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Orders Tab */}
              <TabsContent value="orders" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Order History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {ordersLoading ? (
                      <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="border rounded-lg p-4">
                            <div className="animate-pulse">
                              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                              <div className="h-3 bg-gray-200 rounded w-1/6 mb-4"></div>
                              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : orders.length > 0 ? (
                      <div className="space-y-4">
                        {orders.map((order) => (
                          <div key={order.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-semibold text-black">{order.displayId}</p>
                                <p className="text-sm text-gray-600">{order.date}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-black">{order.total}</p>
                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                  order.status === 'Delivered' || order.status === 'Shipped'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {order.status}
                                </span>
                              </div>
                            </div>
                            <p className="text-gray-700">{order.items}</p>

                            {/* Konnektive Widget for Order */}
                            <KonnektiveOrderWidget
                              orderId={order.id}
                              metadata={order.metadata}
                              hideIfNoData={true}
                            />

                            <div className="flex gap-2 mt-3">
                              <Button variant="outline" size="sm">
                                View Details
                              </Button>
                              <Button variant="outline" size="sm">
                                Track Order
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No orders found</p>
                        <p className="text-sm text-gray-400">Your order history will appear here</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Addresses Tab */}
              <TabsContent value="addresses" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Saved Addresses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold text-black">Home Address</p>
                            <p className="text-gray-600">123 Main Street</p>
                            <p className="text-gray-600">Anytown, ST 12345</p>
                            <p className="text-gray-600">United States</p>
                          </div>
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        </div>
                      </div>
                      <Button className="bg-[#176326] hover:bg-[#0f4a1c]">
                        Add New Address
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Account Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="font-semibold mb-3">Password & Security</h3>
                      <div className="space-y-2">
                        <Button variant="outline" className="w-full justify-start">
                          <CreditCard className="w-4 h-4 mr-2" />
                          Change Password
                        </Button>
                        <Button variant="outline" className="w-full justify-start">
                          Enable Two-Factor Authentication
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-3">Preferences</h3>
                      <div className="space-y-2">
                        <Button variant="outline" className="w-full justify-start">
                          Email Notifications
                        </Button>
                        <Button variant="outline" className="w-full justify-start">
                          SMS Notifications
                        </Button>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <Button variant="destructive" className="w-full">
                        Sign Out
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Account;