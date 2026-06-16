import React, { useState } from 'react';
import { Gift, CreditCard, Check, Mail, Calendar, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  purchaseGiftCard,
  checkGiftCardBalance,
  getCustomerGiftCards,
  getGiftCardDenominations,
  formatGiftCardValue,
  isValidGiftCardCode,
  type PurchaseGiftCardRequest
} from '@/services/medusa/giftCards';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const GiftCards = () => {
  const [selectedAmount, setSelectedAmount] = useState<number>(5000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [message, setMessage] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [balanceCheckCode, setBalanceCheckCode] = useState('');
  const { toast } = useToast();

  const denominations = getGiftCardDenominations();

  // Query for customer's gift cards
  const { data: customerGiftCards = [] } = useQuery({
    queryKey: ['customer-gift-cards'],
    queryFn: getCustomerGiftCards,
  });

  // Mutation for purchasing gift card
  const purchaseGiftCardMutation = useMutation({
    mutationFn: purchaseGiftCard,
    onSuccess: (data) => {
      toast({
        title: "Gift card purchased successfully!",
        description: `Gift card code: ${data.gift_card_code}`,
      });
      // Reset form
      setRecipientEmail('');
      setSenderName('');
      setMessage('');
      setDeliveryDate('');
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to purchase gift card. Please try again.",
      });
    },
  });

  // Mutation for checking balance
  const checkBalanceMutation = useMutation({
    mutationFn: checkGiftCardBalance,
    onSuccess: (data) => {
      toast({
        title: "Gift card balance",
        description: `Balance: ${formatGiftCardValue(data.balance)}`,
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gift card not found or invalid code.",
      });
    },
  });

  const handlePurchase = () => {
    const amount = customAmount ? parseFloat(customAmount) * 100 : selectedAmount;
    
    if (amount < 1000) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Minimum gift card amount is $10.00",
      });
      return;
    }

    if (amount > 50000) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Maximum gift card amount is $500.00",
      });
      return;
    }

    const request: PurchaseGiftCardRequest = {
      value: amount,
      region_id: 'reg_us', // Would get from region context
      recipient_email: recipientEmail || undefined,
      sender_name: senderName || undefined,
      message: message || undefined,
      delivery_date: deliveryDate || undefined,
    };

    purchaseGiftCardMutation.mutate(request);
  };

  const handleCheckBalance = () => {
    if (!balanceCheckCode) {
      toast({
        variant: "destructive",
        title: "Missing code",
        description: "Please enter a gift card code.",
      });
      return;
    }

    if (!isValidGiftCardCode(balanceCheckCode)) {
      toast({
        variant: "destructive",
        title: "Invalid format",
        description: "Please enter a valid gift card code (e.g., GC-ABC123).",
      });
      return;
    }

    checkBalanceMutation.mutate(balanceCheckCode);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <Gift className="h-12 w-12 text-vnsh-red mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Gift Cards</h1>
            <p className="text-gray-600">
              Give the perfect gift with VNS Holster gift cards. Perfect for any occasion.
            </p>
          </div>

          <Tabs defaultValue="purchase" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="purchase">Purchase Gift Card</TabsTrigger>
              <TabsTrigger value="balance">Check Balance</TabsTrigger>
              <TabsTrigger value="my-cards">My Gift Cards</TabsTrigger>
            </TabsList>

            {/* Purchase Gift Card Tab */}
            <TabsContent value="purchase" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CreditCard className="h-5 w-5 mr-2" />
                    Purchase Gift Card
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Amount Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Select Amount
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      {denominations.map((amount) => (
                        <Button
                          key={amount}
                          variant={selectedAmount === amount ? "default" : "outline"}
                          onClick={() => {
                            setSelectedAmount(amount);
                            setCustomAmount('');
                          }}
                          className={selectedAmount === amount ? "bg-vnsh-red hover:bg-[#0f4a1c]" : ""}
                        >
                          {formatGiftCardValue(amount)}
                        </Button>
                      ))}
                    </div>
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Custom amount"
                        value={customAmount}
                        onChange={(e) => {
                          setCustomAmount(e.target.value);
                          setSelectedAmount(0);
                        }}
                        type="number"
                        min="10"
                        max="500"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Recipient Information */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Recipient Information (Optional)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Recipient Email
                        </label>
                        <Input
                          placeholder="recipient@example.com"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          type="email"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Your Name
                        </label>
                        <Input
                          placeholder="Your name"
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Personal Message
                      </label>
                      <Textarea
                        placeholder="Add a personal message..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Delivery Date (Optional)
                      </label>
                      <Input
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Gift Card Details</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Gift cards never expire</li>
                      <li>• Can be used for any VNS Holster products</li>
                      <li>• Remaining balance can be used for future purchases</li>
                      <li>• Digital delivery via email</li>
                    </ul>
                  </div>

                  <Button
                    onClick={handlePurchase}
                    disabled={purchaseGiftCardMutation.isPending}
                    className="w-full bg-vnsh-red hover:bg-[#0f4a1c]"
                    size="lg"
                  >
                    {purchaseGiftCardMutation.isPending ? "Processing..." : "Purchase Gift Card"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Check Balance Tab */}
            <TabsContent value="balance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Check className="h-5 w-5 mr-2" />
                    Check Gift Card Balance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gift Card Code
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter gift card code (e.g., GC-ABC123)"
                        value={balanceCheckCode}
                        onChange={(e) => setBalanceCheckCode(e.target.value.toUpperCase())}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleCheckBalance}
                        disabled={checkBalanceMutation.isPending}
                        className="bg-vnsh-red hover:bg-[#0f4a1c]"
                      >
                        {checkBalanceMutation.isPending ? "Checking..." : "Check Balance"}
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Enter your gift card code to check the remaining balance
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* My Gift Cards Tab */}
            <TabsContent value="my-cards" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Gift className="h-5 w-5 mr-2" />
                    My Gift Cards
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {customerGiftCards.length > 0 ? (
                    <div className="space-y-4">
                      {customerGiftCards.map((giftCard) => (
                        <div key={giftCard.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-mono text-sm font-medium">
                              {giftCard.code}
                            </div>
                            <Badge variant={giftCard.balance > 0 ? "default" : "secondary"}>
                              {giftCard.balance > 0 ? "Active" : "Used"}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Balance:</span>
                              <span className="ml-2 font-medium">
                                {formatGiftCardValue(giftCard.balance)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Original Value:</span>
                              <span className="ml-2 font-medium">
                                {formatGiftCardValue(giftCard.value)}
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            Created: {new Date(giftCard.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">You don't have any gift cards yet.</p>
                      <Button
                        onClick={() => {
                          const tabs = document.querySelector('[value="purchase"]') as HTMLElement;
                          tabs?.click();
                        }}
                        variant="outline"
                        className="mt-4"
                      >
                        Purchase Gift Card
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default GiftCards;
