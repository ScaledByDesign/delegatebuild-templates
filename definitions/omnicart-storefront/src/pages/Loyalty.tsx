import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLoyaltyManagement, usePointsEarningRules } from '@/hooks/useLoyalty';
import { formatPoints } from '@/services/omnicart/loyalty';
import LoyaltyDashboard from '@/components/LoyaltyDashboard';
import RewardsCatalog from '@/components/RewardsCatalog';
import PointsHistory from '@/components/PointsHistory';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ResponsiveBreadcrumb from '@/components/ResponsiveBreadcrumb';
import { 
  Award, 
  Gift, 
  Clock, 
  ShoppingCart, 
  Star, 
  Users, 
  Calendar,
  Info
} from 'lucide-react';

const Loyalty = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { account, isLoadingAccount } = useLoyaltyManagement();
  const { data: earningRules } = usePointsEarningRules();

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'My Account', href: '/account' },
    { label: 'Loyalty Program', href: '/loyalty' }
  ];

  const getEarningRuleIcon = (eventType: string) => {
    switch (eventType) {
      case 'purchase':
        return ShoppingCart;
      case 'signup':
        return Users;
      case 'review':
        return Star;
      case 'referral':
        return Users;
      case 'birthday':
        return Calendar;
      default:
        return Award;
    }
  };

  if (isLoadingAccount) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-vnsh-red"></div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <ResponsiveBreadcrumb items={breadcrumbItems} />
          
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <Award className="h-8 w-8 text-vnsh-red" />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">VNS Loyalty Program</h1>
                <p className="text-gray-600">
                  Earn points, unlock rewards, and enjoy exclusive benefits
                </p>
              </div>
            </div>
            
            {account && (
              <div className="hidden md:flex items-center space-x-4">
                <Badge variant="outline" className="text-vnsh-red border-vnsh-red">
                  {formatPoints(account.points_balance)} Points
                </Badge>
                <Badge 
                  variant="secondary" 
                  style={{ 
                    backgroundColor: `${account.tier.color}20`,
                    color: account.tier.color,
                    borderColor: account.tier.color
                  }}
                >
                  {account.tier.name} Member
                </Badge>
              </div>
            )}
          </div>

          {/* Mobile Points Display */}
          {account && (
            <div className="md:hidden mb-6 flex space-x-2">
              <Badge variant="outline" className="text-vnsh-red border-vnsh-red flex-1 justify-center py-2">
                {formatPoints(account.points_balance)} Points
              </Badge>
              <Badge 
                variant="secondary" 
                className="flex-1 justify-center py-2"
                style={{ 
                  backgroundColor: `${account.tier.color}20`,
                  color: account.tier.color,
                  borderColor: account.tier.color
                }}
              >
                {account.tier.name} Member
              </Badge>
            </div>
          )}

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="dashboard" className="flex items-center space-x-2">
                <Award className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="rewards" className="flex items-center space-x-2">
                <Gift className="h-4 w-4" />
                <span className="hidden sm:inline">Rewards</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">History</span>
              </TabsTrigger>
              <TabsTrigger value="earn" className="flex items-center space-x-2">
                <Info className="h-4 w-4" />
                <span className="hidden sm:inline">How to Earn</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-6">
              <LoyaltyDashboard />
            </TabsContent>

            <TabsContent value="rewards" className="space-y-6">
              <RewardsCatalog />
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <PointsHistory limit={15} />
            </TabsContent>

            <TabsContent value="earn" className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-xl font-semibold mb-6">How to Earn Points</h3>
                  
                  {earningRules && earningRules.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {earningRules.map((rule) => {
                        const Icon = getEarningRuleIcon(rule.event_type);
                        
                        return (
                          <div
                            key={rule.id}
                            className="flex items-center space-x-4 p-4 rounded-lg border border-gray-200 hover:border-vnsh-red transition-colors"
                          >
                            <div className="p-3 bg-vnsh-red/10 rounded-full">
                              <Icon className="h-6 w-6 text-vnsh-red" />
                            </div>
                            
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{rule.name}</h4>
                              <p className="text-sm text-gray-600">
                                {rule.points_per_dollar && `${rule.points_per_dollar} point per $1 spent`}
                                {rule.fixed_points && `${rule.fixed_points} points`}
                                {rule.multiplier && `${rule.multiplier}x multiplier`}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Earning rules information not available</p>
                    </div>
                  )}

                  {/* Program Benefits */}
                  <div className="mt-8 pt-8 border-t border-gray-200">
                    <h4 className="text-lg font-semibold mb-4">Program Benefits</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <h5 className="font-medium text-vnsh-red">Earning Points</h5>
                        <ul className="space-y-1 text-gray-600">
                          <li>• Earn points on every purchase</li>
                          <li>• Bonus points for product reviews</li>
                          <li>• Birthday and anniversary bonuses</li>
                          <li>• Referral rewards</li>
                        </ul>
                      </div>
                      
                      <div className="space-y-2">
                        <h5 className="font-medium text-vnsh-red">Tier Benefits</h5>
                        <ul className="space-y-1 text-gray-600">
                          <li>• Higher tier = more points per dollar</li>
                          <li>• Exclusive tier-only rewards</li>
                          <li>• Free shipping thresholds</li>
                          <li>• Early access to sales</li>
                        </ul>
                      </div>
                    </div>
                  </div>
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

export default Loyalty;
