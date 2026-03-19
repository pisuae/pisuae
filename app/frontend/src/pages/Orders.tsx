import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, Clock, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import { client } from '@/lib/api';

interface Order {
  id: number | string;
  product_id: number;
  quantity: number;
  total_price: number;
  status: string;
  created_at?: string;
}

interface Product {
  id: number;
  title: string;
  price: number;
  image_url?: string;
  category: string;
  condition: string;
}

interface OrderWithProduct extends Order {
  product?: Product;
}

const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
  pending: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30' },
  processing: { icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30' },
  completed: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30' },
  cancelled: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' },
};

const defaultImage = 'https://mgx-backend-cdn.metadl.com/generate/images/1040407/2026-03-18/c1384985-4f46-41a1-af84-fd758bd4107a.png';

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const res = await client.auth.me();
      if (res?.data) {
        setUser(res.data);
        await loadOrders();
        await loadCartCount();
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      const res = await client.entities.orders.query({
        query: {},
        sort: '-created_at',
      });
      const items: Order[] = res?.data?.items || [];

      const enriched: OrderWithProduct[] = await Promise.all(
        items.map(async (order) => {
          try {
            const prodRes = await client.entities.products.get({ id: String(order.product_id) });
            return { ...order, product: prodRes?.data };
          } catch {
            return { ...order, product: undefined };
          }
        })
      );
      setOrders(enriched);
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
  };

  const loadCartCount = async () => {
    try {
      const res = await client.entities.cart_items.query({ query: {} });
      const items = res?.data?.items || [];
      setCartCount(items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0));
    } catch {
      // ignore
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Header cartCount={0} />
        <div className="container mx-auto px-4 py-20 text-center">
          <Package className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sign in to view your orders</h2>
          <p className="text-slate-400 mb-6">You need to be logged in to see your order history.</p>
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
      <Header cartCount={cartCount} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Home
        </Button>

        <h1 className="text-3xl font-bold mb-8">My Orders</h1>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-slate-800/50 rounded-xl h-28 animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
            <p className="text-slate-400 mb-6">Start shopping to see your orders here.</p>
            <Link to="/products">
              <Button className="bg-blue-600 hover:bg-blue-500 text-white">
                Browse Products
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const status = statusConfig[order.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              return (
                <Card key={order.id} className="bg-slate-800/80 border-slate-700/50">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <Link to={`/products/${order.product_id}`} className="shrink-0">
                        <img
                          src={order.product?.image_url || defaultImage}
                          alt={order.product?.title || 'Product'}
                          className="w-20 h-20 rounded-lg object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = defaultImage;
                          }}
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <Link to={`/products/${order.product_id}`}>
                              <h3 className="font-semibold text-white hover:text-blue-400 transition-colors">
                                {order.product?.title || 'Unknown Product'}
                              </h3>
                            </Link>
                            <p className="text-sm text-slate-400 mt-1">
                              Qty: {order.quantity} · Order #{String(order.id).slice(0, 8)}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {formatDate(order.created_at)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-emerald-400">
                              ${order.total_price.toFixed(2)}
                            </p>
                            <Badge className={`mt-1 border ${status.bg} ${status.color}`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {order.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}