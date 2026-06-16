import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2, Share2, Eye, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useWishlist } from '@/hooks/useWishlist';
import { useCart } from '@/hooks/useCart';
import {
  formatWishlistItemPrice,
  getWishlistItemStatus,
  shareWishlist
} from '@/services/medusa/wishlist';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ResponsiveBreadcrumb from '@/components/ResponsiveBreadcrumb';

const Wishlist = () => {
  const { wishlist, isLoading, removeItem, moveItemToCart } = useWishlist();
  const { cart } = useCart();
  const { toast } = useToast();
  const [sharingWishlist, setSharingWishlist] = useState(false);

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'My Account', href: '/account' },
    { label: 'Wishlist', href: '/wishlist' }
  ];

  const handleMoveToCart = async (itemId: string) => {
    if (!cart?.id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Unable to add to cart. Please try again.",
      });
      return;
    }

    try {
      await moveItemToCart(itemId, cart.id);
    } catch (error) {
      console.error('Failed to move item to cart:', error);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeItem(itemId);
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  };

  const handleShareWishlist = async () => {
    if (!wishlist) return;

    setSharingWishlist(true);
    try {
      const { share_url } = await shareWishlist(wishlist.id);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(share_url);
      
      toast({
        title: "Wishlist shared!",
        description: "Share link copied to clipboard.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to share",
        description: "Unable to generate share link.",
      });
    } finally {
      setSharingWishlist(false);
    }
  };

  if (isLoading) {
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

  const wishlistItems = wishlist?.items || [];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <ResponsiveBreadcrumb items={breadcrumbItems} />
          
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <Heart className="h-8 w-8 text-vnsh-red" />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">My Wishlist</h1>
                <p className="text-gray-600">
                  {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'}
                </p>
              </div>
            </div>
            
            {wishlistItems.length > 0 && (
              <Button
                variant="outline"
                onClick={handleShareWishlist}
                disabled={sharingWishlist}
                className="hidden md:flex"
              >
                <Share2 className="h-4 w-4 mr-2" />
                {sharingWishlist ? 'Sharing...' : 'Share Wishlist'}
              </Button>
            )}
          </div>

          {wishlistItems.length === 0 ? (
            <div className="text-center py-16">
              <Heart className="h-16 w-16 text-gray-300 mx-auto mb-6" />
              <h2 className="text-xl font-semibold mb-2">Your wishlist is empty</h2>
              <p className="text-gray-600 mb-6">
                Save items you love to your wishlist and shop them later.
              </p>
              <Button asChild className="bg-vnsh-red hover:bg-[#0f4a1c]">
                <Link to="/collections/all">
                  Start Shopping
                </Link>
              </Button>
            </div>
          ) : (
            <>
              {/* Mobile share button */}
              <div className="md:hidden mb-6">
                <Button
                  variant="outline"
                  onClick={handleShareWishlist}
                  disabled={sharingWishlist}
                  className="w-full"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  {sharingWishlist ? 'Sharing...' : 'Share Wishlist'}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {wishlistItems.map((item) => {
                  const status = getWishlistItemStatus(item);
                  const price = formatWishlistItemPrice(item);
                  
                  return (
                    <Card key={item.id} className="group hover:shadow-lg transition-shadow duration-200">
                      <CardContent className="p-0">
                        <div className="relative">
                          <Link to={`/products/${item.product?.handle}`}>
                            <div className="aspect-square bg-gray-100 rounded-t-lg overflow-hidden">
                              {item.product?.thumbnail ? (
                                <img
                                  src={item.product.thumbnail}
                                  alt={item.product.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="h-12 w-12 text-gray-400" />
                                </div>
                              )}
                            </div>
                          </Link>
                          
                          {/* Status badge */}
                          <div className="absolute top-2 left-2">
                            <Badge 
                              variant={status.status === 'in_stock' ? 'default' : 'secondary'}
                              className={
                                status.status === 'out_of_stock' 
                                  ? 'bg-red-100 text-red-800' 
                                  : status.status === 'low_stock'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                              }
                            >
                              {status.message}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="p-4">
                          <Link to={`/products/${item.product?.handle}`}>
                            <h3 className="font-medium text-gray-900 mb-1 hover:text-vnsh-red transition-colors">
                              {item.product?.title}
                            </h3>
                          </Link>
                          
                          {item.variant?.title && item.variant.title !== 'Default Title' && (
                            <div className="text-sm text-gray-600 mb-2">
                              {item.variant.title.split(' / ').map((part, index) => {
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
                          
                          <p className="text-lg font-semibold text-vnsh-red mb-4">
                            {price}
                          </p>
                          
                          <div className="flex flex-col space-y-2">
                            <Button
                              onClick={() => handleMoveToCart(item.id)}
                              disabled={status.status === 'out_of_stock'}
                              className="w-full bg-vnsh-red hover:bg-[#0f4a1c]"
                              size="sm"
                            >
                              <ShoppingCart className="h-4 w-4 mr-2" />
                              {status.status === 'out_of_stock' ? 'Out of Stock' : 'Add to Cart'}
                            </Button>
                            
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="flex-1"
                              >
                                <Link to={`/products/${item.product?.handle}`}>
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Link>
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveItem(item.id)}
                                className="text-red-600 hover:text-red-700 hover:border-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Wishlist;
