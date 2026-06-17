
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ResponsiveBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

const ResponsiveBreadcrumb = ({ items, className }: ResponsiveBreadcrumbProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    // Return a simplified version for mobile
    return (
      <div className={`bg-vnsh-lightgray py-2 ${className || ''}`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center text-xs">
            <Link to="/" className="text-gray-500 hover:text-vnsh-red">
              <Home size={14} />
            </Link>
            <ChevronRight size={12} className="mx-1 text-gray-400" />
            <span className="text-gray-700 truncate">
              {items[items.length - 1]?.label || ''}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-vnsh-lightgray py-3 ${className || ''}`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center text-sm">
          {items.map((item, index) => (
            <React.Fragment key={index}>
              {index > 0 && <ChevronRight size={16} className="mx-2 text-gray-400" />}
              {item.href ? (
                <Link to={item.href} className="text-gray-500 hover:text-vnsh-red">
                  {item.label}
                </Link>
              ) : (
                <span className="text-gray-700 truncate">{item.label}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResponsiveBreadcrumb;

// Also exported as a named export so either import style resolves
// (`import ResponsiveBreadcrumb from ...` or `import { ResponsiveBreadcrumb } from ...`).
export { ResponsiveBreadcrumb };
