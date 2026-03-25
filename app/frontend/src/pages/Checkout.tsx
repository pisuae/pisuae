import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Banknote, MapPin, Phone, ShoppingBag, Truck, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { client } from '@/lib/api';
import { withRetry } from '@/lib/retry';

interface CheckoutItem {
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
}

interface CheckoutItemWithProduct extends CheckoutItem {
  product?: Product;
}

const defaultImage = 'https://mgx-backend-cdn.metadl.com/generate/images/1040407/2026-03-18/c1384985-4f46-41a1-af84-fd758bd4107a.png';

export default function Checkout() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CheckoutItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'stripe'>('cod');
  const [shippingAddress, setShippingAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    loadCheckoutItems();
  }, []);

  const loadCheckoutItems = async () => {
    try {
      const user = await withRetry(() => client.auth.me());
      if (!user?.data) {
        toast.error('Please sign in to checkout');
        await client.auth.toLogin();
        return;
      }

      // Read selected items from sessionStorage
      const stored = sessionStorage.getItem('checkout_items');
      if (!stored) {
        // Fallback: load all cart items
        const res = await withRetry(() => client.entities.cart_items.query({ query: {} }));
        const cartItems: CheckoutItem[] = (res?.data?.items || []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
        }));
        if (cartItems.length === 0) {
          navigate('/cart');
          return;
        }
        await enrichItems(cartItems);
        return;
      }

      const selectedItems: CheckoutItem[] = JSON.parse(stored);
      if (selectedItems.length === 0) {
        navigate('/cart');
        return;
      }
      await enrichItems(selectedItems);
    } catch (err) {
      console.error('Failed to load checkout items:', err);
      toast.error('Failed to load checkout');
      navigate('/cart');
    } finally {
      setLoading(false);
    }
  };

  const enrichItems = async (checkoutItems: CheckoutItem[]) => {
    const enriched: CheckoutItemWithProduct[] = await Promise.all(
      checkoutItems.map(async (item) => {
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
    setItems(enriched);
  };

  const totalPrice = items.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity,
    0
  );
  const shippingCost = totalPrice >= 50 ? 0 : 5.99;
  const grandTotal = totalPrice + shippingCost;
  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const validateForm = () => {
    if (!shippingAddress.trim()) {
      toast.error('Please enter your shipping address');
      return false;
    }
    if (!phoneNumber.trim()) {
      toast.error('Please enter your phone number');
      return false;
    }
    if (phoneNumber.trim().length < 7) {
      toast.error('Please enter a valid phone number');
      return false;
    }
    return true;
  };

  const handleCODCheckout = async () => {
    if (!validateForm()) return;
    setProcessing(true);
    try {
      const payload = items.map((item) => ({
        cart_item_id: Number(item.id),
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      const res = await withRetry(() =>
        client.apiCall.invoke({
          url: '/api/v1/payment/checkout/cod',
          method: 'POST',
          data: {
            items: payload,
            shipping_address: shippingAddress.trim(),
            phone_number: phoneNumber.trim(),
          },
        })
      );

      if (res?.data?.order_ids) {
        sessionStorage.removeItem('checkout_items');
        toast.success('Order placed successfully! Pay on delivery.');
        navigate('/orders');
      } else {
        toast.error('Failed to place order. Please try again.');
      }
    } catch (err) {
      console.error('COD checkout failed:', err);
      toast.error('Checkout failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleStripeCheckout = async () => {
    if (!validateForm()) return;
    setProcessing(true);
    try {
      const payload = items.map((item) => ({
        cart_item_id: Number(item.id),
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      const res = await withRetry(() =>
        client.apiCall.invoke({
          url: '/api/v1/payment/checkout/stripe',
          method: 'POST',
          data: {
            items: payload,
            shipping_address: shippingAddress.trim(),
            phone_number: phoneNumber.trim(),
            success_url: `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${window.location.origin}/cart`,
          },
        })
      );

      // Check for error responses from the backend
      const status = res?.status ?? res?.statusCode;
      if (typeof status === 'number' && status >= 400) {
        const detail =
          res?.data?.detail ||
          res?.data?.message ||
          (typeof res?.data === 'string' ? res.data : null);
        console.error('Stripe checkout error response:', res);
        toast.error(detail || 'Payment failed. Please try again.');
        return;
      }

      // Handle successful response - check nested data structure
      const checkoutUrl = res?.data?.url || res?.data?.data?.url;
      const sessionId = res?.data?.session_id || res?.data?.data?.session_id;

      if (checkoutUrl) {
        sessionStorage.removeItem('checkout_items');
        try {
          window.location.href = checkoutUrl;
        } catch {
          window.open(checkoutUrl, '_blank');
        }
      } else if (sessionId) {
        // Session created but no URL - might be embedded mode
        sessionStorage.removeItem('checkout_items');
        toast.error('Payment session created but redirect URL is missing. Please contact support.');
        console.error('Stripe session without URL:', res);
      } else {
        console.error('Stripe checkout unexpected response:', JSON.stringify(res?.data));
        toast.error('Failed to create payment session. Please try again.');
      }
    } catch (err: unknown) {
      console.error('Stripe checkout failed:', err);
      // Extract meaningful error message
      let errorMsg = 'Payment setup failed. Please try again.';
      if (err && typeof err === 'object') {
        const errObj = err as Record<string, unknown>;
        const detail =
          errObj.detail ??
          errObj.message ??
          (errObj.data && typeof errObj.data === 'object'
            ? (errObj.data as Record<string, unknown>).detail ??
              (errObj.data as Record<string, unknown>).message
            : undefined);
        if (typeof detail === 'string' && detail.length > 0 && detail.length < 200) {
          errorMsg = detail;
        }
        // Check for Stripe-specific errors
        const statusCode = errObj.status ?? errObj.statusCode;
        if (typeof statusCode === 'number') {
          if (statusCode === 401 || statusCode === 403) {
            errorMsg = 'Authentication error. Please sign in again.';
          } else if (statusCode === 400) {
            errorMsg = typeof detail === 'string' ? detail : 'Invalid checkout request. Please check your cart.';
          }
        }
      }
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        if (msg.includes('dns') || msg.includes('network') || msg.includes('timeout') || msg.includes('fetch failed')) {
          errorMsg = 'Network error. The server may be starting up. Please wait a moment and try again.';
        }
      }
      toast.error(errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckout = () => {
    if (paymentMethod === 'cod') {
      handleCODCheckout();
    } else {
      handleStripeCheckout();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Header cartCount={0} />
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-800/50 rounded-xl h-24 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header cartCount={0} />

      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/cart')}
          className="text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Cart
        </Button>

        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Shipping & Payment */}
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping Information */}
            <Card className="bg-slate-800/80 border-slate-700/50">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-blue-400" />
                  <h2 className="text-lg font-bold">Shipping Information</h2>
                </div>
                <Separator className="bg-slate-700" />
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="address" className="text-sm text-slate-300 mb-2 block">
                      <MapPin className="h-3.5 w-3.5 inline mr-1" />
                      Shipping Address *
                    </Label>
                    <Input
                      id="address"
                      placeholder="Enter your full delivery address..."
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-sm text-slate-300 mb-2 block">
                      <Phone className="h-3.5 w-3.5 inline mr-1" />
                      Phone Number *
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+971 XX XXX XXXX"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card className="bg-slate-800/80 border-slate-700/50">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-emerald-400" />
                  <h2 className="text-lg font-bold">Payment Method</h2>
                </div>
                <Separator className="bg-slate-700" />
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Cash on Delivery */}
                  <button
                    onClick={() => setPaymentMethod('cod')}
                    className={`relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-200 ${
                      paymentMethod === 'cod'
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                        : 'border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800/50'
                    }`}
                  >
                    {paymentMethod === 'cod' && (
                      <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <div className={`flex h-14 w-14 items-center justify-center rounded-full ${
                      paymentMethod === 'cod' ? 'bg-emerald-500/20' : 'bg-slate-800'
                    }`}>
                      <Banknote className={`h-7 w-7 ${paymentMethod === 'cod' ? 'text-emerald-400' : 'text-slate-400'}`} />
                    </div>
                    <div className="text-center">
                      <p className={`font-semibold ${paymentMethod === 'cod' ? 'text-emerald-400' : 'text-white'}`}>
                        Cash on Delivery
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Pay when you receive</p>
                    </div>
                  </button>

                  {/* Stripe Online Payment */}
                  <button
                    onClick={() => setPaymentMethod('stripe')}
                    className={`relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-200 ${
                      paymentMethod === 'stripe'
                        ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10'
                        : 'border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800/50'
                    }`}
                  >
                    {paymentMethod === 'stripe' && (
                      <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <div className={`flex h-14 w-14 items-center justify-center rounded-full ${
                      paymentMethod === 'stripe' ? 'bg-blue-500/20' : 'bg-slate-800'
                    }`}>
                      <CreditCard className={`h-7 w-7 ${paymentMethod === 'stripe' ? 'text-blue-400' : 'text-slate-400'}`} />
                    </div>
                    <div className="text-center">
                      <p className={`font-semibold ${paymentMethod === 'stripe' ? 'text-blue-400' : 'text-white'}`}>
                        Pay Online
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Credit/Debit Card via Stripe</p>
                    </div>
                  </button>
                </div>

                {paymentMethod === 'cod' && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                    <p className="text-sm text-amber-300">
                      💵 You will pay <span className="font-bold">${grandTotal.toFixed(2)}</span> in cash when your order is delivered.
                    </p>
                  </div>
                )}
                {paymentMethod === 'stripe' && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <p className="text-sm text-blue-300">
                      🔒 You will be redirected to Stripe's secure checkout page to complete payment.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Items Summary */}
            <Card className="bg-slate-800/80 border-slate-700/50">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-slate-400" />
                  <h2 className="text-lg font-bold">Order Items ({totalItemCount})</h2>
                </div>
                <Separator className="bg-slate-700" />
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4">
                      <img
                        src={item.product?.image_url || defaultImage}
                        alt={item.product?.title || 'Product'}
                        className="w-14 h-14 rounded-lg object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = defaultImage;
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {item.product?.title || 'Unknown Product'}
                        </p>
                        <p className="text-xs text-slate-400">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-semibold text-emerald-400">
                        ${((item.product?.price || 0) * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Order Summary */}
          <div>
            <Card className="bg-slate-800/80 border-slate-700/50 sticky top-24">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-lg font-bold">Order Summary</h2>
                <Separator className="bg-slate-700" />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Items ({totalItemCount})</span>
                    <span className="text-white">${totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Shipping</span>
                    <span className="text-emerald-400">
                      {shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Payment</span>
                    <span className="text-white capitalize">
                      {paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online (Stripe)'}
                    </span>
                  </div>
                </div>
                <Separator className="bg-slate-700" />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-emerald-400">${grandTotal.toFixed(2)}</span>
                </div>

                <Button
                  onClick={handleCheckout}
                  disabled={processing}
                  className={`w-full h-12 text-base text-white ${
                    paymentMethod === 'cod'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-blue-600 hover:bg-blue-500'
                  } disabled:opacity-50`}
                >
                  {processing ? (
                    'Processing...'
                  ) : paymentMethod === 'cod' ? (
                    <>
                      <Banknote className="h-5 w-5 mr-2" />
                      Place COD Order
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-5 w-5 mr-2" />
                      Pay with Stripe
                    </>
                  )}
                </Button>

                <p className="text-xs text-slate-500 text-center">
                  {totalPrice < 50 && 'Free shipping on orders over $50'}
                  {totalPrice >= 50 && '✓ You qualify for free shipping!'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}