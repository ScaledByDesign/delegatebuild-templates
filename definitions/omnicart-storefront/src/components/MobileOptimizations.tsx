import React, { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

// Enhanced touch target component
interface TouchTargetProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export const TouchTarget: React.FC<TouchTargetProps> = ({
  children,
  className = "",
  onClick,
  disabled = false
}) => {
  return (
    <button
      className={`
        min-h-[44px] min-w-[44px] 
        flex items-center justify-center
        touch-manipulation
        active:scale-95 
        transition-transform duration-150 ease-out
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      onClick={onClick}
      disabled={disabled}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {children}
    </button>
  );
};

// Mobile-optimized swipe gesture component
interface SwipeableProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  className?: string;
}

export const Swipeable: React.FC<SwipeableProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  className = ""
}) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > threshold;
    const isRightSwipe = distance < -threshold;

    if (isLeftSwipe && onSwipeLeft) {
      onSwipeLeft();
    }
    if (isRightSwipe && onSwipeRight) {
      onSwipeRight();
    }
  };

  return (
    <div
      className={`touch-pan-y relative w-full max-w-full ${className}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </div>
  );
};

// Mobile-optimized modal/drawer component
interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  position?: 'bottom' | 'top' | 'left' | 'right';
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  children,
  title,
  position = 'bottom'
}) => {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isOpen && isMobile) {
      // Prevent body scroll when drawer is open
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen, isMobile]);

  if (!isOpen) return null;

  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'top-0 left-0 right-0 transform translate-y-0';
      case 'left':
        return 'top-0 left-0 bottom-0 transform translate-x-0';
      case 'right':
        return 'top-0 right-0 bottom-0 transform translate-x-0';
      case 'bottom':
      default:
        return 'bottom-0 left-0 right-0 transform translate-y-0';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div
        className={`
          fixed bg-white z-50 shadow-lg
          transition-transform duration-300 ease-out
          ${getPositionClasses()}
          ${position === 'bottom' || position === 'top' ? 'max-h-[80vh]' : 'max-w-[80vw]'}
        `}
      >
        {/* Handle for bottom drawer */}
        {position === 'bottom' && (
          <div className="flex justify-center py-2">
            <div className="w-12 h-1 bg-gray-300 rounded-full" />
          </div>
        )}
        
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">{title}</h2>
            <TouchTarget onClick={onClose} className="p-2">
              <span className="text-xl">×</span>
            </TouchTarget>
          </div>
        )}
        
        {/* Content */}
        <div className="overflow-y-auto max-h-full">
          {children}
        </div>
      </div>
    </>
  );
};

// Mobile-optimized infinite scroll component
interface MobileInfiniteScrollProps {
  children: React.ReactNode;
  hasMore: boolean;
  loadMore: () => void;
  loading?: boolean;
  threshold?: number;
}

export const MobileInfiniteScroll: React.FC<MobileInfiniteScrollProps> = ({
  children,
  hasMore,
  loadMore,
  loading = false,
  threshold = 200
}) => {
  useEffect(() => {
    const handleScroll = () => {
      if (loading || !hasMore) return;

      const scrollTop = window.pageYOffset;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.offsetHeight;

      if (scrollTop + windowHeight >= docHeight - threshold) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, hasMore, loadMore, threshold]);

  return (
    <div>
      {children}
      {loading && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-vnsh-red"></div>
        </div>
      )}
    </div>
  );
};

// Mobile-optimized pull-to-refresh component
interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  threshold = 80
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && startY > 0) {
      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, currentY - startY);
      setPullDistance(Math.min(distance, threshold * 1.5));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
    setStartY(0);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateY(${pullDistance * 0.5}px)`,
        transition: pullDistance === 0 ? 'transform 0.3s ease-out' : 'none'
      }}
    >
      {/* Pull indicator */}
      {pullDistance > 0 && (
        <div
          className="flex justify-center items-center py-2 text-gray-500"
          style={{
            opacity: Math.min(pullDistance / threshold, 1),
            transform: `translateY(-${Math.max(0, threshold - pullDistance)}px)`
          }}
        >
          {isRefreshing ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-vnsh-red"></div>
          ) : pullDistance >= threshold ? (
            <span>Release to refresh</span>
          ) : (
            <span>Pull to refresh</span>
          )}
        </div>
      )}
      
      {children}
    </div>
  );
};
