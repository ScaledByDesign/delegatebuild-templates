/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, XCircle, Clock } from 'lucide-react';

export type InventoryLevel = 'in_stock' | 'low_stock' | 'out_of_stock' | 'pre_order' | 'backorder';

interface InventoryStatusProps {
  level: InventoryLevel;
  quantity?: number;
  lowStockThreshold?: number;
  showQuantity?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const InventoryStatus: React.FC<InventoryStatusProps> = ({
  level,
  quantity,
  lowStockThreshold = 5,
  showQuantity = false,
  size = 'md',
  className = ""
}) => {
  const getStatusConfig = () => {
    switch (level) {
      case 'in_stock':
        return {
          label: 'In Stock',
          variant: 'default' as const,
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        };
      case 'low_stock':
        return {
          label: 'Low Stock',
          variant: 'secondary' as const,
          icon: AlertCircle,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200'
        };
      case 'out_of_stock':
        return {
          label: 'Out of Stock',
          variant: 'destructive' as const,
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      case 'pre_order':
        return {
          label: 'Pre-Order',
          variant: 'outline' as const,
          icon: Clock,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        };
      case 'backorder':
        return {
          label: 'Backorder',
          variant: 'outline' as const,
          icon: Clock,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200'
        };
      default:
        return {
          label: 'Unknown',
          variant: 'outline' as const,
          icon: AlertCircle,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          badge: 'text-xs px-2 py-1',
          icon: 12,
          text: 'text-xs'
        };
      case 'lg':
        return {
          badge: 'text-sm px-3 py-2',
          icon: 18,
          text: 'text-sm'
        };
      case 'md':
      default:
        return {
          badge: 'text-sm px-2.5 py-1.5',
          icon: 14,
          text: 'text-sm'
        };
    }
  };

  const config = getStatusConfig();
  const sizeClasses = getSizeClasses();
  const Icon = config.icon;

  const getQuantityText = () => {
    if (!showQuantity || quantity === undefined) return '';
    
    if (quantity === 0) return ' (0 left)';
    if (level === 'low_stock') return ` (${quantity} left)`;
    if (quantity <= 10) return ` (${quantity} left)`;
    return ' (10+ available)';
  };

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <Badge 
        variant={config.variant}
        className={`
          ${sizeClasses.badge} 
          ${config.bgColor} 
          ${config.borderColor} 
          ${config.color}
          border
          flex items-center gap-1
        `}
      >
        <Icon size={sizeClasses.icon} />
        <span className={sizeClasses.text}>
          {config.label}
          {getQuantityText()}
        </span>
      </Badge>
    </div>
  );
};

// Helper function to determine inventory level from quantity
export const getInventoryLevel = (
  quantity: number,
  lowStockThreshold: number = 5,
  _allowBackorder: boolean = false,
  isPreOrder: boolean = false
): InventoryLevel => {
  if (isPreOrder) return 'pre_order';
  // Zero quantity means out of stock - do not allow backorders for products without inventory
  if (quantity === 0) {
    return 'out_of_stock';
  }
  if (quantity <= lowStockThreshold) return 'low_stock';
  return 'in_stock';
};

export default InventoryStatus;
