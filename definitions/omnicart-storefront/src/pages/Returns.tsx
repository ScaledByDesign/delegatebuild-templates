
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw, ChevronDown, ChevronUp, HelpCircle, PackageCheck, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  checkReturnEligibility,
  getReturnReasons,
  createReturn,
  getReturnShippingOptions,
  type ReturnItem,
  type ReturnReason
} from '@/services/omnicart/returns';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const Returns = () => {
  const [step, setStep] = useState(1);
  const [orderId, setOrderId] = useState('');
  const [email, setEmail] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Array<{
    item_id: string;
    quantity: number;
    reason_id: string;
    note?: string;
  }>>([]);
  const [returnNote, setReturnNote] = useState('');
  const [selectedShippingOption, setSelectedShippingOption] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for return reasons
  const { data: returnReasons = [] } = useQuery({
    queryKey: ['return-reasons'],
    queryFn: getReturnReasons,
  });

  // Query for order eligibility
  const {
    data: eligibilityData,
    isLoading: isCheckingEligibility,
    error: eligibilityError
  } = useQuery({
    queryKey: ['return-eligibility', orderId],
    queryFn: () => checkReturnEligibility(orderId),
    enabled: !!orderId && step === 2,
    retry: false,
  });

  // Query for shipping options
  const { data: shippingOptions = [] } = useQuery({
    queryKey: ['return-shipping-options'],
    queryFn: () => getReturnShippingOptions('temp'), // Would use actual return ID
    enabled: step === 3,
  });

  // Mutation for creating return
  const createReturnMutation = useMutation({
    mutationFn: createReturn,
    onSuccess: () => {
      toast({
        title: "Return request submitted",
        description: "Your return request has been submitted successfully.",
      });
      setStep(4);
      queryClient.invalidateQueries({ queryKey: ['customer-returns'] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to submit return request. Please try again.",
      });
    },
  });

  const handleLookupOrder = (e: React.FormEvent) => {
    e.preventDefault();

    if (!orderId || !email) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please enter both Order ID and email address.",
      });
      return;
    }

    // Trigger the eligibility check query
    setStep(2);
  };

  // Handle eligibility check results
  React.useEffect(() => {
    if (eligibilityError && step === 2) {
      toast({
        variant: "destructive",
        title: "Order not found",
        description: "We couldn't find an order with that information. Please check and try again.",
      });
      setStep(1);
    }
  }, [eligibilityError, step, toast]);

  const handleItemSelection = (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, {
        item_id: itemId,
        quantity: 1,
        reason_id: '',
        note: ''
      }]);
    } else {
      setSelectedItems(prev => prev.filter(item => item.item_id !== itemId));
    }
  };

  const handleItemUpdate = (itemId: string, field: string, value: string | number) => {
    setSelectedItems(prev => prev.map(item =>
      item.item_id === itemId
        ? { ...item, [field]: value }
        : item
    ));
  };

  const handleSubmitReturn = () => {
    if (selectedItems.length === 0) {
      toast({
        variant: "destructive",
        title: "No items selected",
        description: "Please select at least one item to return.",
      });
      return;
    }

    const hasInvalidItems = selectedItems.some(item => !item.reason_id);
    if (hasInvalidItems) {
      toast({
        variant: "destructive",
        title: "Missing return reasons",
        description: "Please select a return reason for all items.",
      });
      return;
    }

    const returnRequest = {
      order_id: orderId,
      items: selectedItems,
      note: returnNote,
      return_shipping: selectedShippingOption ? { option_id: selectedShippingOption } : undefined
    };

    createReturnMutation.mutate(returnRequest);
  };



  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center mb-6">
            <RotateCcw className="h-6 w-6 text-vnsh-red mr-2" />
            <h1 className="text-2xl md:text-3xl font-bold">Returns & Exchanges</h1>
          </div>
          
          {/* Return Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-200 -z-10"></div>
              
              <div className={`flex flex-col items-center ${step >= 1 ? 'text-vnsh-red' : 'text-gray-400'}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white mb-2 ${step >= 1 ? 'bg-vnsh-red' : 'bg-gray-300'}`}>
                  1
                </div>
                <span className="text-xs font-medium">Order Lookup</span>
              </div>
              
              <div className={`flex flex-col items-center ${step >= 2 ? 'text-vnsh-red' : 'text-gray-400'}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white mb-2 ${step >= 2 ? 'bg-vnsh-red' : 'bg-gray-300'}`}>
                  2
                </div>
                <span className="text-xs font-medium">Select Items</span>
              </div>
              
              <div className={`flex flex-col items-center ${step >= 3 ? 'text-vnsh-red' : 'text-gray-400'}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white mb-2 ${step >= 3 ? 'bg-vnsh-red' : 'bg-gray-300'}`}>
                  3
                </div>
                <span className="text-xs font-medium">Confirmation</span>
              </div>
            </div>
          </div>
          
          {/* Step 1: Order Lookup */}
          {step === 1 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Find Your Order</h2>
              <form onSubmit={handleLookupOrder} className="space-y-4">
                <div>
                  <label htmlFor="orderId" className="block text-sm font-medium text-gray-700 mb-1">
                    Order ID
                  </label>
                  <Input
                    id="orderId"
                    placeholder="VNSH-1234"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                
                <div className="pt-2">
                  <Button
                    type="submit"
                    className="w-full md:w-auto bg-vnsh-red hover:bg-[#0f4a1c]"
                    disabled={isVerifying}
                  >
                    {isVerifying ? "Verifying..." : "Find Order"}
                  </Button>
                </div>
              </form>
              
              <div className="mt-6">
                <Link to="/track-order" className="text-sm text-vnsh-red hover:underline">
                  Don't know your order number? Track your order first.
                </Link>
              </div>
            </div>
          )}
          
          {/* Step 2: Select Items to Return */}
          {step === 2 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              {isCheckingEligibility ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-vnsh-red mx-auto mb-4"></div>
                  <p>Checking return eligibility...</p>
                </div>
              ) : eligibilityData ? (
                eligibilityData.eligible ? (
                  <>
                    <h2 className="text-lg font-semibold mb-4">Select Items to Return</h2>
                    <p className="text-sm text-gray-600 mb-6">
                      Please select the items you would like to return and provide a reason.
                    </p>

                    <div className="space-y-4 mb-6">
                      {eligibilityData.eligible_items.map((item) => {
                        const isSelected = selectedItems.some(si => si.item_id === item.id);
                        const selectedItem = selectedItems.find(si => si.item_id === item.id);

                        return (
                          <Card key={item.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start space-x-3">
                                <Checkbox
                                  id={`item-${item.id}`}
                                  checked={isSelected}
                                  onCheckedChange={(checked) => handleItemSelection(item.id, checked as boolean)}
                                />
                                <div className="flex-1">
                                  <label htmlFor={`item-${item.id}`} className="font-medium cursor-pointer">
                                    {item.title}
                                    {item.variant_title && (
                                      <span className="text-sm text-gray-500 ml-2">({item.variant_title})</span>
                                    )}
                                  </label>
                                  {/* Medusa v2 stores prices in major units (dollars, not cents) */}
                                  <p className="text-sm text-gray-600">
                                    Quantity: {item.returnable_quantity} • ${item.unit_price.toFixed(2)} each
                                  </p>

                                  {isSelected && (
                                    <div className="mt-3 space-y-3">
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                          Quantity to return
                                        </label>
                                        <Input
                                          type="number"
                                          min="1"
                                          max={item.returnable_quantity}
                                          value={selectedItem?.quantity || 1}
                                          onChange={(e) => handleItemUpdate(item.id, 'quantity', parseInt(e.target.value))}
                                          className="w-24"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                          Reason for return
                                        </label>
                                        <Select
                                          value={selectedItem?.reason_id || ''}
                                          onValueChange={(value) => handleItemUpdate(item.id, 'reason_id', value)}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select a reason" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {returnReasons.map((reason) => (
                                              <SelectItem key={reason.id} value={reason.id}>
                                                {reason.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                          Additional notes (optional)
                                        </label>
                                        <Textarea
                                          placeholder="Provide additional details..."
                                          value={selectedItem?.note || ''}
                                          onChange={(e) => handleItemUpdate(item.id, 'note', e.target.value)}
                                          rows={2}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Additional notes about your return (optional)
                      </label>
                      <Textarea
                        placeholder="Please provide any additional information about your return..."
                        value={returnNote}
                        onChange={(e) => setReturnNote(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(1)}
                      >
                        Back
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setStep(3)}
                        disabled={selectedItems.length === 0}
                        className="bg-vnsh-red hover:bg-[#0f4a1c]"
                      >
                        Continue to Shipping
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Return Not Available</h3>
                    <p className="text-gray-600 mb-4">
                      {eligibilityData.reason || 'This order is not eligible for returns.'}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setStep(1)}
                    >
                      Try Another Order
                    </Button>
                  </div>
                )
              ) : null}
            </div>
          )}
          
          {/* Step 3: Confirmation */}
          {step === 3 && (
            <div className="bg-white rounded-lg shadow-sm p-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <PackageCheck className="h-8 w-8 text-green-600" />
              </div>
              
              <h2 className="text-xl font-bold mb-2">Return Request Received</h2>
              <p className="text-gray-600 mb-6">
                We've received your return request. You'll receive a confirmation email with further instructions shortly.
              </p>
              
              <div className="bg-gray-50 rounded-md p-4 mb-6 text-left">
                <h3 className="font-medium mb-2">Next Steps:</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                  <li>Check your email for return instructions.</li>
                  <li>Print the return shipping label.</li>
                  <li>Pack the item(s) in their original packaging if possible.</li>
                  <li>Drop off the package at the carrier location.</li>
                </ol>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild variant="outline">
                  <Link to="/track-order">Track Another Order</Link>
                </Button>
                <Button asChild className="bg-vnsh-red hover:bg-[#0f4a1c]">
                  <Link to="/">Return to Home</Link>
                </Button>
              </div>
            </div>
          )}
          
          {/* Return Policy Information */}
          <div className="mt-8 bg-gray-50 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <ShieldCheck className="h-6 w-6 text-blue-600 mr-2" />
              <h2 className="text-lg font-semibold">Our Return Policy</h2>
            </div>
            
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="return-window">
                <AccordionTrigger className="text-left font-medium">
                  What is the return window?
                </AccordionTrigger>
                <AccordionContent>
                  We accept returns within 30 days of delivery for most items. Custom-made holsters may have different return policies.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="return-condition">
                <AccordionTrigger className="text-left font-medium">
                  What condition should returned items be in?
                </AccordionTrigger>
                <AccordionContent>
                  Items must be in their original condition, unworn/unused with all tags and packaging intact. Items showing signs of wear or customization cannot be returned.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="return-shipping">
                <AccordionTrigger className="text-left font-medium">
                  Who pays for return shipping?
                </AccordionTrigger>
                <AccordionContent>
                  For standard returns, customers are responsible for return shipping costs. If an item is defective or we shipped the wrong item, we'll provide a prepaid return label.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="return-refunds">
                <AccordionTrigger className="text-left font-medium">
                  How long do refunds take?
                </AccordionTrigger>
                <AccordionContent>
                  Once we receive your return, we'll process it within 3-5 business days. After processing, it may take an additional 5-10 business days for the refund to appear on your account depending on your payment method.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="return-exchanges">
                <AccordionTrigger className="text-left font-medium">
                  How do exchanges work?
                </AccordionTrigger>
                <AccordionContent>
                  For exchanges, we recommend returning the original item and placing a new order for the desired item. This ensures you get the replacement as quickly as possible.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                For any questions regarding returns or exchanges, please contact our customer service team at support@vnsh.com.
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Returns;
