import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  BarChart3, TrendingUp, DollarSign, Eye, Package, ArrowLeft,
  ShoppingCart, Calendar, Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Header from '@/components/Header';
import { client } from '@/lib/api';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

interface Order {
  id: number;
  user_id: string;
  product_id: number;
  seller_id?: string;
  quantity: number;
  total_price: number;
  status: string;
  created_at?: string;
}

interface Product {
  id: number;
  title: string;
  price: number;
  category: string;
  stock?: number;
  status: string;
  created_at?: string;
}

interface ProductView {
  id: number;
  product_id: number;
  seller_id: string;
  viewer_ip?: string;
  viewed_at?: string;
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl">
      <p className="text-slate-300 text-xs mb-1">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <p key={idx} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' && entry.name.toLowerCase().includes('revenue')
            ? `$${entry.value.toFixed(2)}`
            : entry.value}
        </p>
      ))}
    </div>
  );
};

function getDateRange(range: TimeRange): Date {
  const now = new Date();
  switch (range) {
    case '7d': return new Date(now.getTime() - 7 * 86400000);
    case '30d': return new Date(now.getTime() - 30 * 86400000);
    case '90d': return new Date(now.getTime() - 90 * 86400000);
    case 'all': return new Date(2020, 0, 1);
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function groupByDate(items: { date: string; value: number }[]): { date: string; value: number }[] {
  const map = new Map<string, number>();
  items.forEach(({ date, value }) => {
    map.set(date, (map.get(date) || 0) + value);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date: formatDate(date), value }));
}

export default function VendorAnalytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [views, setViews] = useState<ProductView[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [commissionRate, setCommissionRate] = useState(15);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const userRes = await client.auth.me();
      if (!userRes?.data) {
        navigate('/vendor/signup');
        return;
      }
      const userId = userRes.data.id;

      // Load vendor info
      const vendorRes = await client.entities.vendors.query({ query: {} });
      const vendors = vendorRes?.data?.items || [];
      if (vendors.length === 0) {
        navigate('/vendor/signup');
        return;
      }
      setCommissionRate(vendors[0].commission_rate || 15);

      // Load orders where seller_id matches (use /all endpoint to get all orders, then filter)
      const ordersRes = await client.entities.orders.queryAll({
        query: { seller_id: userId },
        sort: '-created_at',
        limit: 2000,
      });
      setOrders(ordersRes?.data?.items || []);

      // Load products
      const prodRes = await client.entities.products.query({
        query: { seller_id: userId },
        limit: 200,
      });
      setProducts(prodRes?.data?.items || []);

      // Load product views
      const viewsRes = await client.entities.product_views.queryAll({
        query: { seller_id: userId },
        sort: '-viewed_at',
        limit: 2000,
      });
      setViews(viewsRes?.data?.items || []);
    } catch (err) {
      console.error('Failed to load analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter data by time range
  const filteredOrders = useMemo(() => {
    const cutoff = getDateRange(timeRange);
    return orders.filter((o) => {
      if (!o.created_at) return timeRange === 'all';
      return new Date(o.created_at) >= cutoff;
    });
  }, [orders, timeRange]);

  const filteredViews = useMemo(() => {
    const cutoff = getDateRange(timeRange);
    return views.filter((v) => {
      if (!v.viewed_at) return timeRange === 'all';
      return new Date(v.viewed_at) >= cutoff;
    });
  }, [views, timeRange]);

  // Compute stats
  const totalRevenue = useMemo(() => filteredOrders.reduce((s, o) => s + o.total_price, 0), [filteredOrders]);
  const netRevenue = useMemo(() => totalRevenue * (100 - commissionRate) / 100, [totalRevenue, commissionRate]);
  const totalOrderCount = filteredOrders.length;
  const totalViewCount = filteredViews.length;
  const conversionRate = totalViewCount > 0 ? ((totalOrderCount / totalViewCount) * 100) : 0;

  // Revenue over time chart data
  const revenueChartData = useMemo(() => {
    const items = filteredOrders
      .filter((o) => o.created_at)
      .map((o) => ({
        date: o.created_at!.split('T')[0],
        value: o.total_price * (100 - commissionRate) / 100,
      }));
    return groupByDate(items);
  }, [filteredOrders, commissionRate]);

  // Orders over time chart data
  const ordersChartData = useMemo(() => {
    const items = filteredOrders
      .filter((o) => o.created_at)
      .map((o) => ({ date: o.created_at!.split('T')[0], value: 1 }));
    return groupByDate(items);
  }, [filteredOrders]);

  // Views over time chart data
  const viewsChartData = useMemo(() => {
    const items = filteredViews
      .filter((v) => v.viewed_at)
      .map((v) => ({ date: v.viewed_at!.split('T')[0], value: 1 }));
    return groupByDate(items);
  }, [filteredViews]);

  // Top selling products
  const topProducts = useMemo(() => {
    const productSales = new Map<number, { title: string; quantity: number; revenue: number }>();
    filteredOrders.forEach((o) => {
      const existing = productSales.get(o.product_id);
      const prod = products.find((p) => p.id === o.product_id);
      const title = prod?.title || `Product #${o.product_id}`;
      if (existing) {
        existing.quantity += o.quantity;
        existing.revenue += o.total_price;
      } else {
        productSales.set(o.product_id, { title, quantity: o.quantity, revenue: o.total_price });
      }
    });
    return Array.from(productSales.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredOrders, products]);

  // Category distribution
  const categoryData = useMemo(() => {
    const catMap = new Map<string, number>();
    filteredOrders.forEach((o) => {
      const prod = products.find((p) => p.id === o.product_id);
      const cat = prod?.category || 'other';
      catMap.set(cat, (catMap.get(cat) || 0) + o.total_price);
    });
    return Array.from(catMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [filteredOrders, products]);

  // Combined chart data (revenue + views)
  const combinedChartData = useMemo(() => {
    const dateMap = new Map<string, { revenue: number; views: number; orders: number }>();
    
    filteredOrders.filter((o) => o.created_at).forEach((o) => {
      const date = formatDate(o.created_at!.split('T')[0]);
      const existing = dateMap.get(date) || { revenue: 0, views: 0, orders: 0 };
      existing.revenue += o.total_price * (100 - commissionRate) / 100;
      existing.orders += 1;
      dateMap.set(date, existing);
    });

    filteredViews.filter((v) => v.viewed_at).forEach((v) => {
      const date = formatDate(v.viewed_at!.split('T')[0]);
      const existing = dateMap.get(date) || { revenue: 0, views: 0, orders: 0 };
      existing.views += 1;
      dateMap.set(date, existing);
    });

    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        revenue: Math.round(data.revenue * 100) / 100,
        views: data.views,
        orders: data.orders,
      }));
  }, [filteredOrders, filteredViews, commissionRate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link to="/vendor/dashboard">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white h-8 w-8">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <BarChart3 className="h-6 w-6 text-blue-400" />
              <h1 className="text-2xl font-bold">Sales Analytics</h1>
            </div>
            <p className="text-slate-400 text-sm ml-11">Track your sales performance, revenue trends, and visitor insights</p>
          </div>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-[160px] bg-slate-800 border-slate-700 text-white">
              <Calendar className="h-4 w-4 mr-2 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-white">
              <SelectItem value="7d" className="hover:bg-slate-700">Last 7 days</SelectItem>
              <SelectItem value="30d" className="hover:bg-slate-700">Last 30 days</SelectItem>
              <SelectItem value="90d" className="hover:bg-slate-700">Last 90 days</SelectItem>
              <SelectItem value="all" className="hover:bg-slate-700">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Net Revenue</p>
                <p className="text-xl font-bold text-emerald-400">${netRevenue.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-500/10">
                <DollarSign className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Gross Revenue</p>
                <p className="text-xl font-bold text-blue-400">${totalRevenue.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-purple-500/10">
                <ShoppingCart className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Orders</p>
                <p className="text-xl font-bold text-purple-400">{totalOrderCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-500/10">
                <Eye className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Product Views</p>
                <p className="text-xl font-bold text-cyan-400">{totalViewCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-500/10">
                <TrendingUp className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Conversion</p>
                <p className="text-xl font-bold text-amber-400">{conversionRate.toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Trend Chart */}
        <Card className="bg-slate-800/50 border-slate-700/50 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenueChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <BarChart3 className="h-12 w-12 mb-3" />
                <p>No revenue data for this period</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueChartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `$${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Net Revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Orders & Views Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <ShoppingCart className="h-5 w-5 text-purple-400" />
                Orders Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordersChartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <ShoppingCart className="h-10 w-10 mb-2" />
                  <p className="text-sm">No orders yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ordersChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <Eye className="h-5 w-5 text-cyan-400" />
                Product Views Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              {viewsChartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Eye className="h-10 w-10 mb-2" />
                  <p className="text-sm">No views tracked yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={viewsChartData}>
                    <defs>
                      <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      name="Views"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      fill="url(#colorViews)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Products & Category Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top Selling Products */}
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <Award className="h-5 w-5 text-amber-400" />
                Top Selling Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Package className="h-10 w-10 mb-2" />
                  <p className="text-sm">No sales data yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((product, idx) => {
                    const maxRevenue = topProducts[0]?.revenue || 1;
                    const barWidth = (product.revenue / maxRevenue) * 100;
                    return (
                      <div key={product.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 w-5">#{idx + 1}</span>
                            <span className="text-sm text-white truncate max-w-[180px]">{product.title}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-slate-400">{product.quantity} sold</span>
                            <span className="text-emerald-400 font-semibold">${product.revenue.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-700/50 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Distribution */}
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5 text-blue-400" />
                Revenue by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <BarChart3 className="h-10 w-10 mb-2" />
                  <p className="text-sm">No category data yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0];
                        return (
                          <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl">
                            <p className="text-white text-sm font-medium capitalize">{data.name}</p>
                            <p className="text-emerald-400 text-sm">${Number(data.value).toFixed(2)}</p>
                          </div>
                        );
                      }}
                    />
                    <Legend
                      formatter={(value) => <span className="text-slate-300 text-xs capitalize">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders Table */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <ShoppingCart className="h-5 w-5 text-purple-400" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <ShoppingCart className="h-10 w-10 mb-2" />
                <p className="text-sm">No orders in this period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Order ID</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Product</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Qty</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Total</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Your Earning</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.slice(0, 10).map((order) => {
                      const prod = products.find((p) => p.id === order.product_id);
                      const earning = order.total_price * (100 - commissionRate) / 100;
                      const statusColor = order.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : order.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-400'
                          : order.status === 'cancelled'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-slate-600/20 text-slate-400';
                      return (
                        <tr key={order.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                          <td className="py-3 px-4 text-sm text-slate-300">#{order.id}</td>
                          <td className="py-3 px-4 text-sm text-white truncate max-w-[200px]">
                            {prod?.title || `Product #${order.product_id}`}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-300">{order.quantity}</td>
                          <td className="py-3 px-4 text-sm text-white font-medium">${order.total_price.toFixed(2)}</td>
                          <td className="py-3 px-4 text-sm text-emerald-400 font-medium">${earning.toFixed(2)}</td>
                          <td className="py-3 px-4">
                            <Badge className={`text-xs ${statusColor}`}>{order.status}</Badge>
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-400">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredOrders.length > 10 && (
                  <p className="text-center text-xs text-slate-500 mt-3">
                    Showing 10 of {filteredOrders.length} orders
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}