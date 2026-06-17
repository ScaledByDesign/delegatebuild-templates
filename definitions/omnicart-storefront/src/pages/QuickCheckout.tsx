import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle, Lock, Award, CreditCard, ShoppingBag, CreditCard as CardIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { getProducts, OmnicartProduct } from '@/services/omnicart/products';

const quickCheckoutSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(10, "Phone number is required"),
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  zip: z.string().min(5, "ZIP code is required"),
  differentBillingAddress: z.boolean().optional(),
  shippingAddress: z.string().min(5, "Shipping address is required").optional(),
  shippingCity: z.string().min(2, "Shipping city is required").optional(),
  shippingState: z.string().min(2, "Shipping state is required").optional(),
  shippingZip: z.string().min(5, "Shipping ZIP code is required").optional(),
  productOption: z.string(),
  extendedWarranty: z.boolean().optional(),
  priorityShipping: z.boolean().optional(),
  shippingInsurance: z.boolean().optional(),
  paymentMethod: z.enum(["credit", "paypal", "applepay"]),
});

type QuickCheckoutValues = z.infer<typeof quickCheckoutSchema>;

const QuickCheckout = () => {
  const [seconds, setSeconds] = useState(59);
  const [minutes, setMinutes] = useState(9);
  const [hours, setHours] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  useEffect(() => {
    const timer = setInterval(() => {
      if (seconds > 0) {
        setSeconds(seconds - 1);
      } else {
        if (minutes > 0) {
          setMinutes(minutes - 1);
          setSeconds(59);
        } else {
          if (hours > 0) {
            setHours(hours - 1);
            setMinutes(59);
            setSeconds(59);
          } else {
            clearInterval(timer);
            toast({
              title: "Reservation expired",
              description: "Your product reservation has expired. Please try again.",
              variant: "destructive"
            });
          }
        }
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [seconds, minutes, hours, toast]);
  
  // Fetch products from Medusa
  const { data: medusaResponse } = useQuery({
    queryKey: ['quick-checkout-products'],
    queryFn: () => getProducts({ limit: 10 }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Transform Medusa products to product options
  const productOptions = medusaResponse?.products?.map((product: OmnicartProduct) => {
    const cheapestVariant = product.variants?.reduce((cheapest, variant) => {
      const variantPrice = variant.calculated_price?.calculated_amount ?? variant.prices?.[0]?.amount ?? 0;
      const cheapestPrice = cheapest?.calculated_price?.calculated_amount ?? cheapest?.prices?.[0]?.amount ?? Infinity;
      return variantPrice < cheapestPrice ? variant : cheapest;
    });

    // Medusa v2 stores prices in major units (dollars, not cents)
    const priceAmount = cheapestVariant?.calculated_price?.calculated_amount ?? cheapestVariant?.prices?.[0]?.amount ?? 0;
    return {
      id: product.id,
      name: product.title,
      price: priceAmount || 0,
      freeShipping: true // Default to free shipping
    };
  }) || [];
  
  const form = useForm<QuickCheckoutValues>({
    resolver: zodResolver(quickCheckoutSchema),
    defaultValues: {
      email: "",
      phone: "",
      firstName: "",
      lastName: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      differentBillingAddress: false,
      shippingAddress: "",
      shippingCity: "",
      shippingState: "",
      shippingZip: "",
      productOption: "laser-standard",
      extendedWarranty: false,
      priorityShipping: false,
      shippingInsurance: false,
      paymentMethod: "credit",
    }
  });
  
  const calculateOrderSummary = () => {
    const selectedProduct = productOptions.find(
      p => p.id === form.getValues("productOption")
    ) || productOptions[0];
    
    let total = selectedProduct.price;
    
    if (form.getValues("extendedWarranty")) {
      total += 9.97;
    }
    
    if (form.getValues("priorityShipping")) {
      total += 9.97;
    }
    
    if (form.getValues("shippingInsurance")) {
      total += 1.97;
    }
    
    return {
      productPrice: selectedProduct.price,
      shipping: 0,
      total: total,
    };
  };
  
  const summary = calculateOrderSummary();
  
  const onSubmit = (data: QuickCheckoutValues) => {
    console.log("Quick checkout form submitted:", data);
    
    toast({
      title: "Order placed successfully!",
      description: "Your order has been placed and will be processed shortly.",
    });
    
    setTimeout(() => {
      navigate("/checkout-success");
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="bg-black text-white p-3 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <Link to="/" className="text-xl font-bold flex items-center">
            <ShoppingBag className="mr-2 h-5 w-5" />
            VNSH
          </Link>
          
          <div className="text-sm hidden md:block">
            Questions? 1-888-555-1885
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-1 bg-white p-4 rounded-md shadow-sm">
            <h1 className="text-xl md:text-2xl font-bold">
              Complete Your VNSH Laser Strike System Order
            </h1>
          </div>
          
          <div className="text-center mb-4 bg-white p-3 rounded-md shadow-sm">
            <div className="flex flex-col items-center">
              <div className="font-bold text-lg mb-1">Time Remaining:</div>
              <div className="bg-gray-800 text-white rounded-md px-5 py-3 font-mono text-2xl md:text-3xl font-bold tracking-wider">
                {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
              </div>
              <p className="text-sm text-gray-700 mt-2">
                Your reservation is secure for the next 10 minutes. Complete your order now to avoid losing your spot.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8">
              <Card className="overflow-visible shadow-sm">
                <CardContent className="p-6">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <FormField
                        control={form.control}
                        name="productOption"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="grid grid-cols-1 md:grid-cols-2 gap-3"
                            >
                              {productOptions.map((option) => (
                                <div key={option.id} className="flex items-start space-x-2 p-3 border rounded-md hover:bg-gray-50">
                                  <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                                  <div className="flex-grow">
                                    <Label htmlFor={option.id} className="flex items-center cursor-pointer">
                                      {option.name}
                                    </Label>
                                    {option.freeShipping && (
                                      <div className="text-xs font-bold text-red-500 mt-1">FREE SHIPPING</div>
                                    )}
                                  </div>
                                  <div className="font-bold">${option.price.toFixed(2)}</div>
                                </div>
                              ))}
                            </RadioGroup>
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-between items-center mt-4 bg-gray-50 p-3 rounded-md border">
                        <div className="space-y-1">
                          <div className="text-sm text-gray-600">Selected Option:</div>
                          <div className="font-semibold">
                            {productOptions.find(p => p.id === form.watch("productOption"))?.name}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Total:</div>
                          <div className="text-xl font-bold text-green-700">${summary.total.toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <FormField
                          control={form.control}
                          name="extendedWarranty"
                          render={({ field }) => (
                            <FormItem className="flex items-start space-x-2 p-3 border rounded-md">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  id="extended-warranty"
                                />
                              </FormControl>
                              <div className="space-y-1">
                                <Label htmlFor="extended-warranty" className="text-sm font-medium cursor-pointer">
                                  Product Warranty
                                </Label>
                                <p className="text-xs text-gray-600">
                                  Lifetime replacement for $9.97
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="priorityShipping"
                          render={({ field }) => (
                            <FormItem className="flex items-start space-x-2 p-3 border rounded-md">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  id="priority-ship"
                                />
                              </FormControl>
                              <div className="space-y-1">
                                <Label htmlFor="priority-ship" className="text-sm font-medium cursor-pointer">
                                  Priority Mail
                                </Label>
                                <p className="text-xs text-gray-600">
                                  Faster delivery for $9.97
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="shippingInsurance"
                          render={({ field }) => (
                            <FormItem className="flex items-start space-x-2 p-3 border rounded-md">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  id="shipping-insurance"
                                />
                              </FormControl>
                              <div className="space-y-1">
                                <Label htmlFor="shipping-insurance" className="text-sm font-medium cursor-pointer">
                                  Shipping Insurance
                                </Label>
                                <p className="text-xs text-gray-600">
                                  Protect your order for $1.97
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="mt-6">
                        <div className="bg-green-50 border-b border-green-100 p-3 -mx-6">
                          <h2 className="font-semibold text-lg">2. Your Information</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 px-0.5">
                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email *</FormLabel>
                                <FormControl>
                                  <Input placeholder="your@email.com" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone *</FormLabel>
                                <FormControl>
                                  <Input placeholder="(123) 456-7890" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="firstName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>First Name *</FormLabel>
                                <FormControl>
                                  <Input placeholder="John" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="lastName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Last Name *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Doe" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <div className="mt-6">
                        <div className="bg-green-50 border-b border-green-100 p-3 -mx-6">
                          <h2 className="font-semibold text-lg">3. Select Payment Method</h2>
                        </div>
                        
                        <FormField
                          control={form.control}
                          name="paymentMethod"
                          render={({ field }) => (
                            <FormItem className="space-y-0 mt-4">
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="grid grid-cols-1 md:grid-cols-3 gap-3 px-0.5"
                              >
                                <div className={`flex flex-col items-center p-4 border rounded-md cursor-pointer hover:bg-gray-50 ${field.value === "credit" ? "border-green-500 bg-green-50" : ""}`}>
                                  <RadioGroupItem value="credit" id="credit" className="sr-only" />
                                  <CardIcon className="h-8 w-8 mb-2 text-blue-600" />
                                  <Label htmlFor="credit" className="cursor-pointer font-medium text-sm">Credit Card</Label>
                                  <p className="text-xs text-center text-gray-500 mt-1">Visa, Mastercard, Amex</p>
                                </div>
                                
                                <div className={`flex flex-col items-center p-4 border rounded-md cursor-pointer hover:bg-gray-50 ${field.value === "paypal" ? "border-green-500 bg-green-50" : ""}`}>
                                  <RadioGroupItem value="paypal" id="paypal" className="sr-only" />
                                  <div className="h-8 w-8 mb-2 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-700">
                                      <path d="M7 11a4 4 0 0 0 4 4h1a4 4 0 0 0 0-8h-5" />
                                      <path d="M21 12V8a4 4 0 0 0-4-4h-1a4 4 0 0 0-4 4v1" />
                                    </svg>
                                  </div>
                                  <Label htmlFor="paypal" className="cursor-pointer font-medium text-sm">PayPal</Label>
                                  <p className="text-xs text-center text-gray-500 mt-1">Fast & secure</p>
                                </div>
                                
                                <div className={`flex flex-col items-center p-4 border rounded-md cursor-pointer hover:bg-gray-50 ${field.value === "applepay" ? "border-green-500 bg-green-50" : ""}`}>
                                  <RadioGroupItem value="applepay" id="applepay" className="sr-only" />
                                  <div className="h-8 w-8 mb-2 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-800">
                                      <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" />
                                      <path d="M10 2c1 .5 2 2 2 5" />
                                    </svg>
                                  </div>
                                  <Label htmlFor="applepay" className="cursor-pointer font-medium text-sm">Apple Pay</Label>
                                  <p className="text-xs text-center text-gray-500 mt-1">iOS devices only</p>
                                </div>
                              </RadioGroup>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="mt-6">
                        <div className="bg-green-50 border-b border-green-100 p-3 -mx-6">
                          <h2 className="font-semibold text-lg">4. Billing Address</h2>
                        </div>
                        
                        <div className="space-y-4 mt-4 px-0.5">
                          <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Address *</FormLabel>
                                <FormControl>
                                  <Input placeholder="123 Main St" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>City *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Anytown" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="state"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>State *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="CA" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="zip"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Zip *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="12345" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <FormField
                            control={form.control}
                            name="differentBillingAddress"
                            render={({ field }) => (
                              <FormItem className="flex items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    id="different-billing"
                                  />
                                </FormControl>
                                <div className="space-y-1">
                                  <Label htmlFor="different-billing" className="cursor-pointer">
                                    Shipping is Different than Billing Address
                                  </Label>
                                </div>
                              </FormItem>
                            )}
                          />
                          
                          {form.watch("differentBillingAddress") && (
                            <div className="mt-4 space-y-4 border-t pt-4">
                              <h3 className="font-medium text-md">Shipping Address</h3>
                              
                              <FormField
                                control={form.control}
                                name="shippingAddress"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Shipping Address *</FormLabel>
                                    <FormControl>
                                      <Input placeholder="123 Main St" {...field} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={form.control}
                                name="shippingCity"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Shipping City *</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Anytown" {...field} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="shippingState"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Shipping State *</FormLabel>
                                      <FormControl>
                                        <Input placeholder="CA" {...field} />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                
                                <FormField
                                  control={form.control}
                                  name="shippingZip"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Shipping Zip *</FormLabel>
                                      <FormControl>
                                        <Input placeholder="12345" {...field} />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {form.watch("paymentMethod") === "credit" && (
                        <div className="mt-6">
                          <div className="bg-green-50 border-b border-green-100 p-3 -mx-6">
                            <h2 className="font-semibold text-lg">5. Card Information</h2>
                          </div>
                          
                          <div className="space-y-4 mt-4 px-0.5">
                            <div>
                              <Label htmlFor="card-number">Card Number *</Label>
                              <Input id="card-number" placeholder="**** **** **** ****" />
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <Label htmlFor="card-month">Month *</Label>
                                <Input id="card-month" placeholder="MM" />
                              </div>
                              
                              <div>
                                <Label htmlFor="card-year">Year *</Label>
                                <Input id="card-year" placeholder="YY" />
                              </div>
                              
                              <div>
                                <Label htmlFor="card-cvv">CVV *</Label>
                                <Input id="card-cvv" placeholder="***" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <Button 
                        type="submit" 
                        className="w-full py-6 text-lg font-bold bg-[#9DF01A] hover:bg-[#8ad916] text-black mt-6"
                      >
                        Complete My Order Now - ${summary.total.toFixed(2)}
                      </Button>

                      <div className="flex flex-wrap justify-around items-center gap-2 mt-4 text-center">
                        <div className="flex items-center">
                          <Lock className="h-4 w-4 text-green-700 mr-1" />
                          <span className="text-xs">Secure Checkout</span>
                        </div>
                        <div className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-700 mr-1" />
                          <span className="text-xs">Money-Back Guarantee</span>
                        </div>
                        <div className="flex items-center">
                          <Award className="h-4 w-4 text-green-700 mr-1" />
                          <span className="text-xs">Top-Rated Product</span>
                        </div>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>
            
            <div className="lg:col-span-4">
              <Card className="sticky top-20">
                <div className="bg-yellow-50 p-3 border-b">
                  <h2 className="font-semibold text-center">
                    Why Shooters Love Our<br />
                    Laser Strike System
                  </h2>
                </div>
                <CardContent className="p-4 max-h-[calc(100vh-250px)] overflow-y-auto">
                  <div className="space-y-3">
                    <div className="border-l-4 border-yellow-400 pl-3 py-1 italic text-sm">
                      "We've already saved $100s in ammo!"
                      <div className="text-xs mt-1 font-bold">⭐⭐⭐⭐⭐ - Amanda S.</div>
                    </div>
                    
                    <div className="border-l-4 border-yellow-400 pl-3 py-1 italic text-sm">
                      "Excellent training system, super easy to use."
                      <div className="text-xs mt-1 font-bold">⭐⭐⭐⭐⭐ - James R.</div>
                    </div>
                    
                    <div className="border-l-4 border-yellow-400 pl-3 py-1 italic text-sm">
                      "If you're still wondering if this is worth it, the answer is YES."
                      <div className="text-xs mt-1 font-bold">⭐⭐⭐⭐⭐ - Sarah F.</div>
                    </div>
                    
                    <div className="border-l-4 border-yellow-400 pl-3 py-1 italic text-sm">
                      "Awesome, just like shooting at the range minus the noise."
                      <div className="text-xs mt-1 font-bold">⭐⭐⭐⭐⭐ - Michael H.</div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t">
                    <h3 className="font-medium text-md">Key Benefits:</h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start">
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
                        <span>Save thousands on ammo costs</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
                        <span>Practice anywhere, anytime</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
                        <span>Improve accuracy & draw speed</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2 mt-0.5" />
                        <span>100% safe & quiet training</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-2">
                    <div className="text-center">
                      <div className="flex justify-center mb-1">
                        <Award className="h-6 w-6 text-yellow-500" />
                      </div>
                      <h3 className="font-bold text-xs">90-Day Money Back</h3>
                    </div>
                    
                    <div className="text-center">
                      <div className="flex justify-center mb-1">
                        <Lock className="h-6 w-6 text-gray-600" />
                      </div>
                      <h3 className="font-bold text-xs">Secure Payment</h3>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-gray-100 py-2 border-t text-center text-xs text-gray-600 mt-8">
        <div className="container mx-auto">
          © 2025 VNSH.com. All Rights Reserved. 
          <div className="mt-1">
            <Link to="/pages/terms-disclaimer" className="hover:underline">Terms</Link>
            {" | "}
            <Link to="/pages/privacy-policy" className="hover:underline">Privacy</Link>
            {" | "}
            <Link to="/pages/shipping-policy" className="hover:underline">Shipping</Link>
            {" | "}
            <Link to="/pages/return-policy" className="hover:underline">Refunds</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default QuickCheckout;
