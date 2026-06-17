import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePointsHistory } from '@/hooks/useLoyalty';
import { formatPoints, type PointsTransaction } from '@/services/omnicart/loyalty';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ShoppingCart, 
  Gift, 
  Star, 
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PointsHistoryProps {
  className?: string;
  limit?: number;
}

export const PointsHistory: React.FC<PointsHistoryProps> = ({ 
  className, 
  limit = 10 
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const offset = currentPage * limit;

  const { data, isLoading, error } = usePointsHistory(limit, offset);
  const transactions = data?.transactions || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  const getTransactionIcon = (transaction: PointsTransaction) => {
    switch (transaction.type) {
      case 'earned':
        if (transaction.order_id) return ShoppingCart;
        if (transaction.description.toLowerCase().includes('review')) return Star;
        if (transaction.description.toLowerCase().includes('referral')) return Users;
        if (transaction.description.toLowerCase().includes('birthday')) return Calendar;
        return TrendingUp;
      case 'redeemed':
        return Gift;
      case 'expired':
        return Clock;
      case 'adjusted':
        return TrendingDown;
      default:
        return TrendingUp;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'earned':
        return 'text-green-600';
      case 'redeemed':
        return 'text-blue-600';
      case 'expired':
        return 'text-orange-600';
      case 'adjusted':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTransactionBadgeVariant = (type: string) => {
    switch (type) {
      case 'earned':
        return 'default';
      case 'redeemed':
        return 'secondary';
      case 'expired':
        return 'destructive';
      case 'adjusted':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const formatTransactionDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Points History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="h-6 w-16 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="pt-6 text-center py-12">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Unable to load points history</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5 text-vnsh-red" />
          <span>Points History</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No points transactions yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Start shopping to earn your first points!
            </p>
          </div>
        ) : (
          <>
            {/* Transactions List */}
            <div className="space-y-3">
              {transactions.map((transaction) => {
                const Icon = getTransactionIcon(transaction);
                const colorClass = getTransactionColor(transaction.type);
                const badgeVariant = getTransactionBadgeVariant(transaction.type);
                
                return (
                  <div
                    key={transaction.id}
                    className="flex items-center space-x-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    {/* Icon */}
                    <div className={cn(
                      'p-2 rounded-full',
                      transaction.type === 'earned' ? 'bg-green-100' : 
                      transaction.type === 'redeemed' ? 'bg-blue-100' :
                      transaction.type === 'expired' ? 'bg-orange-100' : 'bg-red-100'
                    )}>
                      <Icon className={cn('h-4 w-4', colorClass)} />
                    </div>

                    {/* Transaction Details */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {transaction.description}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant={badgeVariant} className="text-xs">
                          {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {formatTransactionDate(transaction.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Points */}
                    <div className="text-right">
                      <p className={cn(
                        'font-bold',
                        transaction.points > 0 ? 'text-green-600' : 'text-red-600'
                      )}>
                        {transaction.points > 0 ? '+' : ''}{formatPoints(transaction.points)}
                      </p>
                      <p className="text-xs text-gray-500">points</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-600">
                  Showing {offset + 1}-{Math.min(offset + limit, totalCount)} of {totalCount} transactions
                </p>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <span className="text-sm text-gray-600">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                    disabled={currentPage === totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PointsHistory;
