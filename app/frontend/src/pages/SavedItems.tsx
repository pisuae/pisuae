import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ArrowLeft, ShoppingCart, Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { client } from '@/lib/api';
import { withRetry } from '@/lib/retry';
import { resolveImageUrl } from '@/lib/image';

interface SavedItem {
  id: number;
  product_id: number;
  created_at?: string;
}

interface Product {
  id: number;
  title: string;
  price: number;
  category: string;
  condition: string;
  image_url?: string;
  stock?: number;
  status: string;
}

const defaultImage = 'https://mgx-backend-cdn.metadl.com/generate/images/1040407/2026-03-18/c1384985-4f46-41a1-af84-fd758bd4107a.png';

export default function SavedItems() {
  const navigate = useNavigate();
  const [savedItems, setSavedItems] = useState<(SavedItem & { product?: Product; imageUrl?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<number | null>(null);

  useEffect(() => {
    loadSavedItems();
  }, []);

  const loadSavedItems = async () => {
    try {
      const user = await withRetry(() => client.auth.me());
      if (!user?.data) {
        toast.error('Please sign in to view saved items');
        navigate('/');
        return;
      }

      const res = await withRetry(() =>
        client.entities.saved_items.query({ query: {}, sort: '-created_at', limit: 50 })
      );
      const items: SavedItem[] = res?.data?.items || [];

      // Load product details for each saved item
      const enriched = await Promise.all(
        items.map(async (item) => {
          try {
            const prodRes = await withRetry(() =>
              client.entities.products.get({ id: String(item.product_id) })
            );
            const product = prodRes?.data || undefined;
            let imageUrl = defaultImage;
            if (product?.image_url) {
              const resolved = await resolveImageUrl(product.image_url);
              if (resolved) imageUrl = resolved;
            }
            return { ...item, product, imageUrl };
          } catch {
            return { ...item, product: undefined, imageUrl: defaultImage };
          }
        })
      );

      setSavedItems(enriched);
    } catch {
      toast.error('Failed to load saved items');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (savedItemId: number) => {
    setRemoving(savedItemId);
    try {
      await withRetry(() =>
        client.entities.saved_items.delete({ id: String(savedItemId) })
      );
      setSavedItems((prev) => prev.filter((item) => item.id !== savedItemId));
      toast.success('Item removed from saved list');
    } catch {
      toast.error('Failed to remove item');
    } finally {
      setRemoving(null);
    }
  };

  const handleAddToCart = async (productId: number) => {
    try {
      const user = await withRetry(() => client.auth.me());
      if (!user?.data) {
        toast.error('Please sign in to add items to cart');
        await client.auth.toLogin();
        return;
      }

      const cartRes = await withRetry(() =>
        client.entities.cart_items.query({ query: { product_id: productId } })
      );
      const existing = cartRes?.data?.items?.[0];

      if (existing) {
        await withRetry(() =>
          client.entities.cart_items.update({
            id: existing.id,
            data: { quantity: (existing.quantity || 0) + 1 },
          })
        );
      } else {
        await withRetry(() =>
          client.entities.cart_items.create({
            data: { product_id: productId, quantity: 1 },
          })
        );
      }
      toast.success('Added to cart!');
    } catch {
      toast.error('Failed to add to cart');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Header />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-lg bg-pink-500/15 flex items-center justify-center">
            <Heart className="h-5 w-5 text-pink-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Saved Items</h1>
            <p className="text-sm text-slate-400">
              {savedItems.length} {savedItems.length === 1 ? 'item' : 'items'} saved to your account
            </p>
          </div>
        </div>

        {savedItems.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="h-16 w-16 text-slate-700 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-300 mb-2">No saved items yet</h2>
            <p className="text-slate-500 mb-6">
              Browse products and tap the heart icon to save items you love
            </p>
            <Link to="/products">
              <Button className="bg-blue-600 hover:bg-blue-500 text-white">
                <Package className="h-4 w-4 mr-2" />
                Browse Products
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {savedItems.map((item) => (
              <Card key={item.id} className="bg-slate-900 border-slate-700 overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center gap-4 p-4">
                    {/* Product Image */}
                    <Link to={item.product ? `/products/${item.product_id}` : '#'} className="shrink-0">
                      <img
                        src={item.imageUrl || defaultImage}
                        alt={item.product?.title || 'Product'}
                        className="w-20 h-20 rounded-lg object-cover bg-slate-800"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = defaultImage;
                        }}
                      />
                    </Link>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <Link
                        to={item.product ? `/products/${item.product_id}` : '#'}
                        className="text-white font-semibold hover:text-blue-400 transition-colors truncate block"
                      >
                        {item.product?.title || `Product #${item.product_id}`}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        {item.product?.category && (
                          <Badge className="bg-slate-700/50 text-slate-300 border-slate-600 text-xs capitalize">
                            {item.product.category}
                          </Badge>
                        )}
                        {item.product?.condition && (
                          <Badge className="bg-slate-700/50 text-slate-300 border-slate-600 text-xs capitalize">
                            {item.product.condition}
                          </Badge>
                        )}
                      </div>
                      {item.product?.price !== undefined && (
                        <p className="text-emerald-400 font-bold mt-1">
                          AED {item.product.price.toFixed(2)}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">Saved {formatDate(item.created_at)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 shrink-0">
                      {item.product && (
                        <Button
                          size="sm"
                          onClick={() => handleAddToCart(item.product_id)}
                          className="bg-blue-600 hover:bg-blue-500 text-white"
                        >
                          <ShoppingCart className="h-4 w-4 mr-1" />
                          Add to Cart
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemove(item.id)}
                        disabled={removing === item.id}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {removing === item.id ? 'Removing...' : 'Remove'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}