import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { client } from '@/lib/api';
import { withRetry } from '@/lib/retry';
import { formatPrice } from '@/lib/currency';

interface CartItem {
  id: number | string;
  product_id: number;
  quantity: number;
}

interface Product {
  id: number;
  title: string;
  price: number;
  image_url?: string;
  category: string;
  condition: string;
  stock?: number;
}

interface CartItemWithProduct extends CartItem {
  product?: Product;
}

const defaultImage = 'https://mgx-backend-cdn.metadl.com/generate/images/1040407/2026-03-18/c1384985-4f46-41a1-af84-fd758bd4107a.png';

export default function Cart() {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const res = await withRetry(() => client.auth.me());
      if (res?.data) {
        setUser(res.data);
        await loadCart();
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loadCart = async () => {
    try {
      const res = await withRetry(() => client.entities.cart_items.query({ query: {} }));
      const items: CartItem[] = res?.data?.items || [];

      const enriched: CartItemWithProduct[] = await Promise.all(
        items.map(async (item) => {
          try {
            const prodRes = await withRetry(() =>
              client.entities.products.get({ id: String(item.product_id) })
            );
            return { ...item, product: prodRes?.data };
          } catch {
            return { ...item, product: undefined };
          }
        })
      );
      setCartItems(enriched);
      // Select all items by default
      setSelectedIds(new Set(enriched.map((item) => item.id)));
    } catch (err) {
      console.error('Failed to load cart:', err);
    }
  };

  const toggleSelect = (id: number | string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === cartItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cartItems.map((item) => item.id)));
    }
  };

  const updateQuantity = async (cartItem: CartItemWithProduct, delta: number) => {
    const newQty = cartItem.quantity + delta;
    if (newQty <= 0) {
      await removeItem(cartItem);
      return;
    }
    try {
      await withRetry(() =>
        client.entities.cart_items.update({
          id: String(cartItem.id),
          data: { quantity: newQty },
        })
      );
      setCartItems((prev) =>
        prev.map((item) => (item.id === cartItem.id ? { ...item, quantity: newQty } : item))
      );
    } catch (err) {
      console.error('Failed to update quantity:', err);
      toast.error('Failed to update quantity. Please try again.');
    }
  };

  const removeItem = async (cartItem: CartItemWithProduct) => {
    try {
      await withRetry(() =>
        client.entities.cart_items.delete({ id: String(cartItem.id) })
      );
      setCartItems((prev) => prev.filter((item) => item.id !== cartItem.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(cartItem.id);
        return next;
      });
      toast.success('Item removed from cart');
    } catch (err) {
      console.error('Failed to remove item:', err);
      toast.error('Failed to remove item. Please try again.');
    }
  };

  const removeSelected = async () => {
    if (selectedIds.size === 0) return;
    const toRemove = cartItems.filter((item) => selectedIds.has(item.id));
    for (const item of toRemove) {
      try {
        await withRetry(() =>
          client.entities.cart_items.delete({ id: String(item.id) })
        );
      } catch {
        // continue
      }
    }
    setCartItems((prev) => prev.filter((item) => !selectedIds.has(item.id)));
    setSelectedIds(new Set());
    toast.success(`Removed ${toRemove.length} item(s) from cart`);
  };

  // Only selected items count toward totals
  const selectedItems = cartItems.filter((item) => selectedIds.has(item.id));
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const selectedCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const selectedPrice = selectedItems.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity,
    0
  );
  const shippingCost = selectedPrice >= 50 ? 0 : selectedPrice > 0 ? 5.99 : 0;
  const allSelected = cartItems.length > 0 && selectedIds.size === cartItems.length;

  const handleCheckout = () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one item to checkout');
      return;
    }
    // Store selected item IDs in sessionStorage for the checkout page
    const selectedCartData = selectedItems.map((item) => ({
      id: item.id,
      product_id: item.product_id,
      quantity: item.quantity,
    }));
    sessionStorage.setItem('checkout_items', JSON.stringify(selectedCartData));
    navigate('/checkout');
  };

  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Header cartCount={0} />
        <div className="container mx-auto px-4 py-20 text-center">
          <ShoppingBag className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sign in to view your cart</h2>
          <p className="text-slate-400 mb-6">You need to be logged in to manage your cart.</p>
          <Button
            onClick={() => client.auth.toLogin()}
            className="bg-blue-600 hover:bg-blue-500 text-white"
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header cartCount={totalItems} />

      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Continue Shopping
        </Button>

        <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-slate-800/50 rounded-xl h-24 animate-pulse" />
            ))}
          </div>
        ) : cartItems.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
            <p className="text-slate-400 mb-6">Browse our products and add items to your cart.</p>
            <Link to="/products">
              <Button className="bg-blue-600 hover:bg-blue-500 text-white">
                Browse Products
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {/* Select All / Remove Selected bar */}
              <div className="flex items-center justify-between bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-700/50">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors"
                >
                  {allSelected ? (
                    <CheckSquare className="h-5 w-5 text-blue-400" />
                  ) : (
                    <Square className="h-5 w-5 text-slate-500" />
                  )}
                  <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
                  <span className="text-slate-500">({selectedIds.size}/{cartItems.length})</span>
                </button>
                {selectedIds.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeSelected}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove Selected
                  </Button>
                )}
              </div>

              {cartItems.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <Card
                    key={item.id}
                    className={`border transition-all duration-200 ${
                      isSelected
                        ? 'bg-slate-800/80 border-blue-500/30'
                        : 'bg-slate-800/40 border-slate-700/30 opacity-70'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {/* Checkbox */}
                        <div className="flex items-center shrink-0">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(item.id)}
                            className="border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                        </div>

                        <Link to={`/products/${item.product_id}`} className="shrink-0">
                          <img
                            src={item.product?.image_url || defaultImage}
                            alt={item.product?.title || 'Product'}
                            className="w-24 h-24 rounded-lg object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = defaultImage;
                            }}
                          />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link to={`/products/${item.product_id}`}>
                            <h3 className="font-semibold text-white hover:text-blue-400 transition-colors truncate">
                              {item.product?.title || 'Unknown Product'}
                            </h3>
                          </Link>
                          <p className="text-sm text-slate-400 capitalize mt-1">
                            {item.product?.category} · {item.product?.condition}
                          </p>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {formatPrice(item.product?.price || 0)} each
                          </p>
                          <p className="text-lg font-bold text-emerald-400 mt-2">
                            {formatPrice((item.product?.price || 0) * item.quantity)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end justify-between">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item)}
                            className="text-slate-400 hover:text-red-400 hover:bg-red-400/10 h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <div className="flex items-center border border-slate-700 rounded-lg overflow-hidden">
                            <button
                              onClick={() => updateQuantity(item, -1)}
                              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="px-3 py-1 text-sm text-white bg-slate-800 min-w-[2rem] text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item, 1)}
                              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Order Summary */}
            <div>
              <Card className="bg-slate-800/80 border-slate-700/50 sticky top-24">
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-lg font-bold">Order Summary</h2>
                  <Separator className="bg-slate-700" />
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Selected Items ({selectedCount})</span>
                      <span className="text-white">{formatPrice(selectedPrice)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Shipping</span>
                      <span className="text-emerald-400">
                        {selectedPrice === 0
                          ? '--'
                          : shippingCost === 0
                          ? 'Free'
                          : formatPrice(shippingCost)}
                      </span>
                    </div>
                  </div>
                  <Separator className="bg-slate-700" />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-emerald-400">
                      {formatPrice(selectedPrice + shippingCost)}
                    </span>
                  </div>
                  <Button
                    onClick={handleCheckout}
                    disabled={selectedIds.size === 0}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12 text-base disabled:opacity-50"
                  >
                    Proceed to Checkout ({selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''})
                  </Button>
                  <p className="text-xs text-slate-500 text-center">
                    Free shipping on orders over AED 50
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}