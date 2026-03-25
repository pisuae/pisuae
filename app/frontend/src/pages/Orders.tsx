import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Ban,
  CreditCard,
  Banknote,
  Truck,
  MapPin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import { client } from '@/lib/api';
import { withRetry, withRetryQuiet } from '@/lib/retry';
import { toast } from 'sonner';

interface Order {
  id: number | string;
  product_id: number;
  quantity: number;
  total_price: number;
  status: string;
  payment_method?: string;
  shipping_address?: string;
  phone_number?: string;
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

interface TrackingEvent {
  id: number;
  order_id: number;
  status: string;
  title: string;
  description?: string;
  timestamp?: string;
}

interface OrderWithProduct extends Order {
  product?: Product;
  tracking?: TrackingEvent[];
}

// Full order flow for the timeline (always show all steps)
const ORDER_FLOW_STEPS = [
  {
    status: 'confirmed',
    label: 'Confirmed',
    icon: CheckCircle,
    color: 'blue',
  },
  { status: 'shipped', label: 'Shipped', icon: Truck, color: 'purple' },
  {
    status: 'out_for_delivery',
    label: 'Out for Delivery',
    icon: MapPin,
    color: 'amber',
  },
  {
    status: 'delivered',
    label: 'Delivered',
    icon: CheckCircle,
    color: 'emerald',
  },
];

const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
  pending: {
    icon: Clock,
    color: 'text-amber-400',
    bg: 'bg-amber-500/20 border-amber-500/30',
  },
  confirmed: {
    icon: Package,
    color: 'text-blue-400',
    bg: 'bg-blue-500/20 border-blue-500/30',
  },
  paid: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20 border-emerald-500/30',
  },
  processing: {
    icon: Package,
    color: 'text-blue-400',
    bg: 'bg-blue-500/20 border-blue-500/30',
  },
  shipped: {
    icon: Truck,
    color: 'text-purple-400',
    bg: 'bg-purple-500/20 border-purple-500/30',
  },
  out_for_delivery: {
    icon: MapPin,
    color: 'text-amber-400',
    bg: 'bg-amber-500/20 border-amber-500/30',
  },
  delivered: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20 border-emerald-500/30',
  },
  completed: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20 border-emerald-500/30',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/20 border-red-500/30',
  },
};

const defaultImage =
  'https://mgx-backend-cdn.metadl.com/generate/images/1040407/2026-03-18/c1384985-4f46-41a1-af84-fd758bd4107a.png';

function TrackingTimeline({
  tracking,
  orderStatus,
}: {
  tracking: TrackingEvent[];
  orderStatus: string;
}) {
  const completedStatuses = new Set(tracking.map((t) => t.status));
  const trackingMap: Record<string, TrackingEvent> = {};
  for (const t of tracking) {
    trackingMap[t.status] = t;
  }

  const isCancelled = orderStatus === 'cancelled';

  const formatTimestamp = (ts?: string) => {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 bg-red-500/10 border border-red-500/20 rounded-lg">
        <XCircle className="h-5 w-5 text-red-400 shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-400">Order Cancelled</p>
          <p className="text-xs text-slate-500">
            This order has been cancelled.
          </p>
        </div>
      </div>
    );
  }

  if (orderStatus === 'pending') {
    return (
      <div className="flex items-center gap-2 py-3 px-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <Clock className="h-5 w-5 text-amber-400 shrink-0 animate-pulse" />
        <div>
          <p className="text-sm font-medium text-amber-400">
            Awaiting Confirmation
          </p>
          <p className="text-xs text-slate-500">
            Your order is being reviewed and will be confirmed shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-3">
      {/* Horizontal timeline for desktop, vertical for mobile */}
      {/* Desktop horizontal */}
      <div className="hidden sm:flex items-start justify-between relative">
        {/* Background line */}
        <div className="absolute top-4 left-[10%] right-[10%] h-0.5 bg-slate-700" />
        {/* Progress line */}
        {completedStatuses.size > 0 && (
          <div
            className="absolute top-4 left-[10%] h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 transition-all duration-700"
            style={{
              width: `${Math.min(((completedStatuses.size - 1) / (ORDER_FLOW_STEPS.length - 1)) * 80, 80)}%`,
            }}
          />
        )}

        {ORDER_FLOW_STEPS.map((step, idx) => {
          const isCompleted = completedStatuses.has(step.status);
          const event = trackingMap[step.status];
          const StepIcon = step.icon;

          const colorMap: Record<string, string> = {
            blue: 'bg-blue-500 border-blue-400 shadow-blue-500/30',
            purple: 'bg-purple-500 border-purple-400 shadow-purple-500/30',
            amber: 'bg-amber-500 border-amber-400 shadow-amber-500/30',
            emerald: 'bg-emerald-500 border-emerald-400 shadow-emerald-500/30',
          };

          return (
            <div
              key={step.status}
              className="flex flex-col items-center relative z-10"
              style={{ width: `${100 / ORDER_FLOW_STEPS.length}%` }}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                  isCompleted
                    ? `${colorMap[step.color]} shadow-lg`
                    : 'bg-slate-800 border-slate-600'
                }`}
              >
                <StepIcon
                  className={`h-4 w-4 ${isCompleted ? 'text-white' : 'text-slate-500'}`}
                />
              </div>
              <p
                className={`text-xs font-medium mt-2 text-center ${isCompleted ? 'text-white' : 'text-slate-500'}`}
              >
                {step.label}
              </p>
              {isCompleted && event?.timestamp && (
                <p className="text-[10px] text-slate-400 mt-0.5 text-center">
                  {formatTimestamp(event.timestamp)}
                </p>
              )}
              {isCompleted && event?.description && (
                <p className="text-[10px] text-slate-500 mt-0.5 text-center max-w-[120px] line-clamp-2">
                  {event.description}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile vertical */}
      <div className="sm:hidden space-y-0">
        {ORDER_FLOW_STEPS.map((step, idx) => {
          const isCompleted = completedStatuses.has(step.status);
          const event = trackingMap[step.status];
          const StepIcon = step.icon;
          const isLast = idx === ORDER_FLOW_STEPS.length - 1;

          const colorMap: Record<string, string> = {
            blue: 'bg-blue-500 border-blue-400',
            purple: 'bg-purple-500 border-purple-400',
            amber: 'bg-amber-500 border-amber-400',
            emerald: 'bg-emerald-500 border-emerald-400',
          };

          return (
            <div key={step.status} className="flex gap-3">
              {/* Dot and line */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 shrink-0 transition-all ${
                    isCompleted
                      ? `${colorMap[step.color]}`
                      : 'bg-slate-800 border-slate-600'
                  }`}
                >
                  <StepIcon
                    className={`h-3.5 w-3.5 ${isCompleted ? 'text-white' : 'text-slate-500'}`}
                  />
                </div>
                {!isLast && (
                  <div
                    className={`w-0.5 h-8 ${isCompleted ? 'bg-gradient-to-b from-current to-slate-700' : 'bg-slate-700'}`}
                    style={
                      isCompleted
                        ? {
                            background: `linear-gradient(to bottom, var(--tw-gradient-from), #334155)`,
                          }
                        : undefined
                    }
                  />
                )}
              </div>
              {/* Content */}
              <div className={`pb-4 ${isLast ? 'pb-0' : ''}`}>
                <p
                  className={`text-sm font-medium ${isCompleted ? 'text-white' : 'text-slate-500'}`}
                >
                  {step.label}
                </p>
                {isCompleted && event?.timestamp && (
                  <p className="text-[11px] text-slate-400">
                    {formatTimestamp(event.timestamp)}
                  </p>
                )}
                {isCompleted && event?.description && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {event.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [cartCount, setCartCount] = useState(0);
  const [cancellingId, setCancellingId] = useState<number | string | null>(
    null
  );
  const [expandedOrderId, setExpandedOrderId] = useState<
    number | string | null
  >(null);
  const [trackingLoading, setTrackingLoading] = useState<Set<number | string>>(
    new Set()
  );

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const res = await withRetry(() => client.auth.me());
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
      const res = await withRetry(() =>
        client.entities.orders.query({
          query: {},
          sort: '-created_at',
          limit: 100,
        })
      );
      const items: Order[] = res?.data?.items || [];

      // Enrich with product info
      const enriched: OrderWithProduct[] = await Promise.all(
        items.map(async (order) => {
          try {
            const prodRes = await withRetry(() =>
              client.entities.products.get({ id: String(order.product_id) })
            );
            return { ...order, product: prodRes?.data };
          } catch {
            return { ...order, product: undefined };
          }
        })
      );
      setOrders(enriched);

      // Load bulk tracking for all orders
      const orderIds = items.map((o) => Number(o.id)).filter((id) => !isNaN(id));
      if (orderIds.length > 0) {
        loadBulkTracking(orderIds, enriched);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
  };

  const loadBulkTracking = async (
    orderIds: number[],
    currentOrders: OrderWithProduct[]
  ) => {
    try {
      // Stagger to avoid DNS issues
      await new Promise((r) => setTimeout(r, 500));
      const res = await withRetryQuiet(
        () =>
          client.apiCall.invoke({
            url: '/api/v1/order-tracking/bulk',
            method: 'GET',
            data: { order_ids: orderIds.join(',') },
          }),
        { data: { tracking: {} } } as any
      );
      const trackingMap = res?.data?.tracking || {};

      setOrders((prev) =>
        prev.map((order) => {
          const events = trackingMap[String(order.id)] || trackingMap[Number(order.id)] || [];
          return { ...order, tracking: events };
        })
      );
    } catch {
      // Non-critical, tracking just won't show
    }
  };

  const loadSingleOrderTracking = async (orderId: number | string) => {
    setTrackingLoading((prev) => new Set(prev).add(orderId));
    try {
      const res = await withRetryQuiet(
        () =>
          client.apiCall.invoke({
            url: `/api/v1/order-tracking/order/${orderId}`,
            method: 'GET',
          }),
        { data: { events: [] } } as any
      );
      const events = res?.data?.events || [];
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, tracking: events } : o))
      );
    } catch {
      // ignore
    } finally {
      setTrackingLoading((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const toggleTracking = (orderId: number | string) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
    } else {
      setExpandedOrderId(orderId);
      // Refresh tracking data when expanding
      const order = orders.find((o) => o.id === orderId);
      if (order && (!order.tracking || order.tracking.length === 0)) {
        loadSingleOrderTracking(orderId);
      }
    }
  };

  const loadCartCount = async () => {
    try {
      const res = await withRetry(() =>
        client.entities.cart_items.query({ query: {} })
      );
      const items = res?.data?.items || [];
      setCartCount(
        items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0)
      );
    } catch {
      // ignore
    }
  };

  const cancelOrder = async (orderId: number | string) => {
    setCancellingId(orderId);
    try {
      await withRetry(() =>
        client.entities.orders.update({
          id: String(orderId),
          data: { status: 'cancelled' },
        })
      );
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: 'cancelled', tracking: [] } : o
        )
      );
      toast.success('Order cancelled successfully');
    } catch (err) {
      console.error('Failed to cancel order:', err);
      toast.error('Failed to cancel order. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  const canCancel = (status: string) => {
    return ['pending', 'confirmed', 'paid'].includes(status);
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
          <h2 className="text-2xl font-bold mb-2">
            Sign in to view your orders
          </h2>
          <p className="text-slate-400 mb-6">
            You need to be logged in to see your order history.
          </p>
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
              <div
                key={i}
                className="bg-slate-800/50 rounded-xl h-28 animate-pulse"
              />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
            <p className="text-slate-400 mb-6">
              Start shopping to see your orders here.
            </p>
            <Link to="/products">
              <Button className="bg-blue-600 hover:bg-blue-500 text-white">
                Browse Products
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const status =
                statusConfig[order.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              const isCancelling = cancellingId === order.id;
              const isExpanded = expandedOrderId === order.id;
              const isTrackingLoading = trackingLoading.has(order.id);
              const hasTracking =
                order.tracking && order.tracking.length > 0;
              const showTrackingButton =
                order.status !== 'pending' && order.status !== 'cancelled';

              return (
                <Card
                  key={order.id}
                  className="bg-slate-800/80 border-slate-700/50 overflow-hidden"
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <Link
                        to={`/products/${order.product_id}`}
                        className="shrink-0"
                      >
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
                          <div className="min-w-0">
                            <Link to={`/products/${order.product_id}`}>
                              <h3 className="font-semibold text-white hover:text-blue-400 transition-colors truncate">
                                {order.product?.title || 'Unknown Product'}
                              </h3>
                            </Link>
                            <p className="text-sm text-slate-400 mt-1">
                              Qty: {order.quantity} · Order #
                              {String(order.id).slice(0, 8)}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-slate-500">
                                {formatDate(order.created_at)}
                              </p>
                              {order.payment_method && (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-slate-600 text-slate-400 py-0"
                                >
                                  {order.payment_method === 'cod' ? (
                                    <>
                                      <Banknote className="h-3 w-3 mr-1" />
                                      COD
                                    </>
                                  ) : (
                                    <>
                                      <CreditCard className="h-3 w-3 mr-1" />
                                      Stripe
                                    </>
                                  )}
                                </Badge>
                              )}
                            </div>
                            {order.shipping_address && (
                              <p className="text-xs text-slate-500 mt-1 truncate">
                                📍 {order.shipping_address}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold text-emerald-400">
                              ${order.total_price.toFixed(2)}
                            </p>
                            <Badge
                              className={`mt-1 border ${status.bg} ${status.color}`}
                            >
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {order.status}
                            </Badge>
                          </div>
                        </div>

                        {/* Action buttons row */}
                        <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {/* Cancel button */}
                            {canCancel(order.status) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => cancelOrder(order.id)}
                                disabled={isCancelling}
                                className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/50"
                              >
                                {isCancelling ? (
                                  'Cancelling...'
                                ) : (
                                  <>
                                    <Ban className="h-3.5 w-3.5 mr-1" />
                                    Cancel Order
                                  </>
                                )}
                              </Button>
                            )}
                          </div>

                          {/* Track Order button */}
                          {showTrackingButton && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleTracking(order.id)}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                            >
                              <Truck className="h-3.5 w-3.5 mr-1.5" />
                              {isExpanded ? 'Hide Tracking' : 'Track Order'}
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5 ml-1" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 ml-1" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tracking Timeline - expandable */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-700/50">
                        {isTrackingLoading ? (
                          <div className="flex items-center justify-center py-6">
                            <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            <span className="ml-2 text-sm text-slate-400">
                              Loading tracking info...
                            </span>
                          </div>
                        ) : (
                          <TrackingTimeline
                            tracking={order.tracking || []}
                            orderStatus={order.status}
                          />
                        )}
                      </div>
                    )}
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