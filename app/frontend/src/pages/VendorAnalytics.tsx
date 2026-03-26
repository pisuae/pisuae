import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  BarChart3, TrendingUp, DollarSign, Eye, Package, ArrowLeft,
  ShoppingCart, Calendar, Award, RefreshCw, Download, ArrowUpRight,
  ArrowDownRight, Minus, Clock, Target, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Header from '@/components/Header';
import { client } from '@/lib/api';
import { resilientAuth, resilientQuery, resilientQueryAll } from '@/lib/resilient-client';
import { toast } from 'sonner';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, ComposedChart, RadialBarChart, RadialBar,
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
const STATUS_COLORS: Record<string, string> = {
  completed: '#10b981',
  pending: '#f59e0b',
  cancelled: '#ef4444',
  processing: '#3b82f6',
  shipped: '#8b5cf6',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-600/50 rounded-xl p-3 shadow-2xl">
      <p className="text-slate-400 text-xs mb-1.5 font-medium">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <p key={idx} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' && (entry.name.toLowerCase().includes('revenue') || entry.name.toLowerCase().includes('aov') || entry.name.toLowerCase().includes('earning'))
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
    .map(([date, value]) => ({ date: formatDate(date), value: Math.round(value * 100) / 100 }));
}

function calcGrowth(current: number, previous: number): { value: number; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0) return { value: current > 0 ? 100 : 0, direction: current > 0 ? 'up' : 'flat' };
  const pct = ((current - previous) / previous) * 100;
  return { value: Math.abs(pct), direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
}

function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function VendorAnalytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [views, setViews] = useState<ProductView[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [commissionRate, setCommissionRate] = useState(15);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAllData = useCallback(async (showToast = false) => {
    try {
      const userData = await resilientAuth();
      if (!userData) {
        navigate('/vendor/signup');
        return;
      }
      const userId = userData.id;

      const vendorRes = await resilientQuery('vendors', { query: {} });
      const vendors = vendorRes?.data?.items || [];
      if (vendors.length === 0) {
        navigate('/vendor/signup');
        return;
      }
      setCommissionRate(vendors[0].commission_rate || 15);

      const ordersRes = await resilientQueryAll('orders', {
        query: { seller_id: userId },
        sort: '-created_at',
        limit: 2000,
      });
      setOrders(ordersRes?.data?.items || []);

      const prodRes = await resilientQuery('products', {
        query: { seller_id: userId },
        limit: 200,
      });
      setProducts(prodRes?.data?.items || []);

      const viewsRes = await resilientQueryAll('product_views', {
        query: { seller_id: userId },
        sort: '-viewed_at',
        limit: 2000,
      });
      setViews(viewsRes?.data?.items || []);
      setLastUpdated(new Date());
      if (showToast) toast.success('Analytics data refreshed');
    } catch (err) {
      console.error('Failed to load analytics data:', err);
      if (showToast) toast.error('Failed to refresh data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadAllData(false);
      }, 30000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, loadAllData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData(true);
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

  // Previous period data for growth comparison
  const previousOrders = useMemo(() => {
    const cutoff = getDateRange(timeRange);
    const rangeDays = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const prevCutoff = new Date(cutoff.getTime() - rangeDays * 86400000);
    return orders.filter((o) => {
      if (!o.created_at) return false;
      const d = new Date(o.created_at);
      return d >= prevCutoff && d < cutoff;
    });
  }, [orders, timeRange]);

  const previousViews = useMemo(() => {
    const cutoff = getDateRange(timeRange);
    const rangeDays = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const prevCutoff = new Date(cutoff.getTime() - rangeDays * 86400000);
    return views.filter((v) => {
      if (!v.viewed_at) return false;
      const d = new Date(v.viewed_at);
      return d >= prevCutoff && d < cutoff;
    });
  }, [views, timeRange]);

  // Compute stats
  const totalRevenue = useMemo(() => filteredOrders.reduce((s, o) => s + o.total_price, 0), [filteredOrders]);
  const netRevenue = useMemo(() => totalRevenue * (100 - commissionRate) / 100, [totalRevenue, commissionRate]);
  const totalOrderCount = filteredOrders.length;
  const totalViewCount = filteredViews.length;
  const conversionRate = totalViewCount > 0 ? ((totalOrderCount / totalViewCount) * 100) : 0;
  const avgOrderValue = totalOrderCount > 0 ? totalRevenue / totalOrderCount : 0;
  const totalItemsSold = useMemo(() => filteredOrders.reduce((s, o) => s + o.quantity, 0), [filteredOrders]);

  // Previous period stats for growth
  const prevRevenue = useMemo(() => previousOrders.reduce((s, o) => s + o.total_price, 0), [previousOrders]);
  const prevOrderCount = previousOrders.length;
  const prevViewCount = previousViews.length;
  const prevAOV = prevOrderCount > 0 ? prevRevenue / prevOrderCount : 0;

  const revenueGrowth = calcGrowth(totalRevenue, prevRevenue);
  const orderGrowth = calcGrowth(totalOrderCount, prevOrderCount);
  const viewGrowth = calcGrowth(totalViewCount, prevViewCount);
  const aovGrowth = calcGrowth(avgOrderValue, prevAOV);

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

  // AOV over time
  const aovChartData = useMemo(() => {
    const dateRevenue = new Map<string, { total: number; count: number }>();
    filteredOrders.filter((o) => o.created_at).forEach((o) => {
      const date = o.created_at!.split('T')[0];
      const existing = dateRevenue.get(date) || { total: 0, count: 0 };
      existing.total += o.total_price;
      existing.count += 1;
      dateRevenue.set(date, existing);
    });
    return Array.from(dateRevenue.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date: formatDate(date),
        value: Math.round((data.total / data.count) * 100) / 100,
      }));
  }, [filteredOrders]);

  // Combined overview chart
  const combinedChartData = useMemo(() => {
    const dateMap = new Map<string, { revenue: number; views: number; orders: number }>();
    filteredOrders.filter((o) => o.created_at).forEach((o) => {
      const date = o.created_at!.split('T')[0];
      const existing = dateMap.get(date) || { revenue: 0, views: 0, orders: 0 };
      existing.revenue += o.total_price * (100 - commissionRate) / 100;
      existing.orders += 1;
      dateMap.set(date, existing);
    });
    filteredViews.filter((v) => v.viewed_at).forEach((v) => {
      const date = v.viewed_at!.split('T')[0];
      const existing = dateMap.get(date) || { revenue: 0, views: 0, orders: 0 };
      existing.views += 1;
      dateMap.set(date, existing);
    });
    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date: formatDate(date),
        revenue: Math.round(data.revenue * 100) / 100,
        views: data.views,
        orders: data.orders,
      }));
  }, [filteredOrders, filteredViews, commissionRate]);

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
      .slice(0, 8);
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

  // Order status distribution
  const statusData = useMemo(() => {
    const statusMap = new Map<string, number>();
    filteredOrders.forEach((o) => {
      statusMap.set(o.status, (statusMap.get(o.status) || 0) + 1);
    });
    return Array.from(statusMap.entries())
      .map(([name, value]) => ({ name, value, fill: STATUS_COLORS[name] || '#64748b' }));
  }, [filteredOrders]);

  // Export handlers
  const handleExportOrders = () => {
    const headers = ['Order ID', 'Product', 'Quantity', 'Total Price', 'Your Earning', 'Status', 'Date'];
    const rows = filteredOrders.map((o) => {
      const prod = products.find((p) => p.id === o.product_id);
      const earning = o.total_price * (100 - commissionRate) / 100;
      return [
        `#${o.id}`,
        `"${prod?.title || `Product #${o.product_id}`}"`,
        String(o.quantity),
        `$${o.total_price.toFixed(2)}`,
        `$${earning.toFixed(2)}`,
        o.status,
        o.created_at ? new Date(o.created_at).toLocaleDateString() : '-',
      ];
    });
    exportCSV(`vendor-orders-${timeRange}.csv`, headers, rows);
    toast.success(`Exported ${rows.length} orders to CSV`);
  };

  const handleExportSummary = () => {
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Net Revenue', `$${netRevenue.toFixed(2)}`],
      ['Gross Revenue', `$${totalRevenue.toFixed(2)}`],
      ['Total Orders', String(totalOrderCount)],
      ['Total Items Sold', String(totalItemsSold)],
      ['Product Views', String(totalViewCount)],
      ['Conversion Rate', `${conversionRate.toFixed(1)}%`],
      ['Average Order Value', `$${avgOrderValue.toFixed(2)}`],
      ['Commission Rate', `${commissionRate}%`],
      ['Time Period', timeRange === 'all' ? 'All Time' : `Last ${timeRange}`],
      ['Report Date', new Date().toLocaleDateString()],
    ];
    exportCSV(`vendor-summary-${timeRange}.csv`, headers, rows);
    toast.success('Summary report exported');
  };

  const GrowthIndicator = ({ growth }: { growth: { value: number; direction: 'up' | 'down' | 'flat' } }) => {
    if (growth.direction === 'flat') return <Minus className="h-3 w-3 text-slate-500" />;
    const Icon = growth.direction === 'up' ? ArrowUpRight : ArrowDownRight;
    const color = growth.direction === 'up' ? 'text-emerald-400' : 'text-red-400';
    return (
      <span className={`flex items-center gap-0.5 text-xs font-medium ${color}`}>
        <Icon className="h-3 w-3" />
        {growth.value.toFixed(1)}%
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Header />
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-700 border-t-blue-500" />
            <BarChart3 className="absolute inset-0 m-auto h-5 w-5 text-blue-400" />
          </div>
          <p className="text-slate-400 text-sm animate-pulse">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link to="/vendor/dashboard">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white h-8 w-8">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  Sales Analytics
                </h1>
              </div>
            </div>
            <p className="text-slate-500 text-sm ml-[76px]">
              Track performance, revenue trends, and visitor insights
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Auto-refresh toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`border-slate-700 text-xs h-8 ${autoRefresh ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'text-slate-400 hover:text-white'}`}
            >
              <Clock className="h-3 w-3 mr-1" />
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh'}
            </Button>
            {/* Manual refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="border-slate-700 text-slate-400 hover:text-white text-xs h-8"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {/* Export dropdown */}
            <Select onValueChange={(v) => v === 'orders' ? handleExportOrders() : handleExportSummary()}>
              <SelectTrigger className="w-[120px] bg-slate-800 border-slate-700 text-slate-300 text-xs h-8">
                <Download className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Export" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                <SelectItem value="orders" className="hover:bg-slate-700 text-xs">Orders CSV</SelectItem>
                <SelectItem value="summary" className="hover:bg-slate-700 text-xs">Summary CSV</SelectItem>
              </SelectContent>
            </Select>
            {/* Time range */}
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <SelectTrigger className="w-[140px] bg-slate-800 border-slate-700 text-white text-xs h-8">
                <Calendar className="h-3 w-3 mr-1 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                <SelectItem value="7d" className="hover:bg-slate-700 text-xs">Last 7 days</SelectItem>
                <SelectItem value="30d" className="hover:bg-slate-700 text-xs">Last 30 days</SelectItem>
                <SelectItem value="90d" className="hover:bg-slate-700 text-xs">Last 90 days</SelectItem>
                <SelectItem value="all" className="hover:bg-slate-700 text-xs">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Last updated */}
        <div className="flex items-center gap-2 mb-6 text-xs text-slate-500">
          <Clock className="h-3 w-3" />
          Last updated: {lastUpdated.toLocaleTimeString()}
          {autoRefresh && <Badge className="bg-blue-500/10 text-blue-400 text-[10px] px-1.5 py-0">LIVE</Badge>}
        </div>

        {/* Summary Stats - Enhanced with growth indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {[
            { label: 'Net Revenue', value: `$${netRevenue.toFixed(2)}`, icon: DollarSign, color: 'emerald', gradient: 'from-emerald-500/20 to-emerald-500/5', growth: revenueGrowth },
            { label: 'Gross Revenue', value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, color: 'blue', gradient: 'from-blue-500/20 to-blue-500/5', growth: revenueGrowth },
            { label: 'Orders', value: String(totalOrderCount), icon: ShoppingCart, color: 'purple', gradient: 'from-purple-500/20 to-purple-500/5', growth: orderGrowth },
            { label: 'Views', value: String(totalViewCount), icon: Eye, color: 'cyan', gradient: 'from-cyan-500/20 to-cyan-500/5', growth: viewGrowth },
            { label: 'Avg. Order', value: `$${avgOrderValue.toFixed(2)}`, icon: Target, color: 'amber', gradient: 'from-amber-500/20 to-amber-500/5', growth: aovGrowth },
            { label: 'Conversion', value: `${conversionRate.toFixed(1)}%`, icon: TrendingUp, color: 'pink', gradient: 'from-pink-500/20 to-pink-500/5', growth: { value: 0, direction: 'flat' as const } },
          ].map((stat) => (
            <Card key={stat.label} className={`bg-gradient-to-br ${stat.gradient} border-slate-700/30 hover:border-slate-600/50 transition-all duration-300 group`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-${stat.color}-500/10 group-hover:bg-${stat.color}-500/20 transition-colors`}>
                    <stat.icon className={`h-4 w-4 text-${stat.color}-400`} />
                  </div>
                  <GrowthIndicator growth={stat.growth} />
                </div>
                <p className={`text-lg font-bold text-${stat.color}-400`}>{stat.value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Tabs */}
        <Tabs defaultValue="overview" className="mb-6">
          <TabsList className="bg-slate-800/50 border border-slate-700/50 mb-4">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 text-xs">
              Overview
            </TabsTrigger>
            <TabsTrigger value="revenue" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-xs">
              Revenue
            </TabsTrigger>
            <TabsTrigger value="orders" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400 text-xs">
              Orders
            </TabsTrigger>
            <TabsTrigger value="traffic" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 text-xs">
              Traffic
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab - Combined chart */}
          <TabsContent value="overview">
            <Card className="bg-slate-800/30 border-slate-700/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2 text-sm">
                  <Layers className="h-4 w-4 text-blue-400" />
                  Revenue, Orders & Views Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {combinedChartData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                    <BarChart3 className="h-12 w-12 mb-3 opacity-30" />
                    <p className="text-sm">No data for this period</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={combinedChartData}>
                      <defs>
                        <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                      <YAxis yAxisId="left" stroke="#64748b" fontSize={11} tickFormatter={(v) => `$${v}`} />
                      <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={11} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} fill="url(#gradRevenue)" />
                      <Bar yAxisId="right" dataKey="orders" name="Orders" fill="#8b5cf6" radius={[3, 3, 0, 0]} opacity={0.7} />
                      <Line yAxisId="right" type="monotone" dataKey="views" name="Views" stroke="#06b6d4" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-800/30 border-slate-700/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    Net Revenue Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {revenueChartData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                      <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                      <p className="text-sm">No revenue data</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={revenueChartData}>
                        <defs>
                          <linearGradient id="colorRev2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `$${v}`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="value" name="Net Revenue" stroke="#10b981" strokeWidth={2} fill="url(#colorRev2)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-slate-800/30 border-slate-700/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-amber-400" />
                    Average Order Value
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {aovChartData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                      <Target className="h-10 w-10 mb-2 opacity-30" />
                      <p className="text-sm">No AOV data</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={aovChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `$${v}`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="value" name="AOV" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-800/30 border-slate-700/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white flex items-center gap-2 text-sm">
                    <ShoppingCart className="h-4 w-4 text-purple-400" />
                    Orders Over Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ordersChartData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                      <ShoppingCart className="h-10 w-10 mb-2 opacity-30" />
                      <p className="text-sm">No orders yet</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={ordersChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" name="Orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-slate-800/30 border-slate-700/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white flex items-center gap-2 text-sm">
                    <BarChart3 className="h-4 w-4 text-blue-400" />
                    Order Status Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statusData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                      <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                      <p className="text-sm">No status data</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                          {statusData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0];
                            return (
                              <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-600/50 rounded-xl p-3 shadow-2xl">
                                <p className="text-white text-sm font-medium capitalize">{d.name}</p>
                                <p className="text-slate-300 text-sm">{String(d.value)} orders</p>
                              </div>
                            );
                          }}
                        />
                        <Legend formatter={(value) => <span className="text-slate-300 text-xs capitalize">{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Traffic Tab */}
          <TabsContent value="traffic">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-800/30 border-slate-700/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white flex items-center gap-2 text-sm">
                    <Eye className="h-4 w-4 text-cyan-400" />
                    Product Views Over Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {viewsChartData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                      <Eye className="h-10 w-10 mb-2 opacity-30" />
                      <p className="text-sm">No views tracked yet</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={viewsChartData}>
                        <defs>
                          <linearGradient id="colorViews2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="value" name="Views" stroke="#06b6d4" strokeWidth={2} fill="url(#colorViews2)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-slate-800/30 border-slate-700/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white flex items-center gap-2 text-sm">
                    <BarChart3 className="h-4 w-4 text-blue-400" />
                    Revenue by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                      <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                      <p className="text-sm">No category data</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                          {categoryData.map((_, idx) => (
                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0];
                            return (
                              <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-600/50 rounded-xl p-3 shadow-2xl">
                                <p className="text-white text-sm font-medium capitalize">{d.name}</p>
                                <p className="text-emerald-400 text-sm">${Number(d.value).toFixed(2)}</p>
                              </div>
                            );
                          }}
                        />
                        <Legend formatter={(value) => <span className="text-slate-300 text-xs capitalize">{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Top Products */}
        <Card className="bg-slate-800/30 border-slate-700/30 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2 text-sm">
              <Award className="h-4 w-4 text-amber-400" />
              Top Selling Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Package className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">No sales data yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {topProducts.map((product, idx) => {
                  const maxRevenue = topProducts[0]?.revenue || 1;
                  const barWidth = (product.revenue / maxRevenue) * 100;
                  return (
                    <div key={product.id} className="bg-slate-800/50 rounded-lg p-3 hover:bg-slate-700/30 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white"
                            style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                          >
                            {idx + 1}
                          </div>
                          <span className="text-sm text-white truncate max-w-[200px]">{product.title}</span>
                        </div>
                        <span className="text-emerald-400 font-semibold text-sm">${product.revenue.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-700/30 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all duration-700"
                            style={{ width: `${barWidth}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-500 whitespace-nowrap">{product.quantity} sold</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders Table */}
        <Card className="bg-slate-800/30 border-slate-700/30">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2 text-sm">
              <ShoppingCart className="h-4 w-4 text-purple-400" />
              Recent Orders
            </CardTitle>
            {filteredOrders.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleExportOrders} className="text-slate-400 hover:text-white text-xs h-7">
                <Download className="h-3 w-3 mr-1" />
                Export
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <ShoppingCart className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">No orders in this period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">ID</th>
                      <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Product</th>
                      <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Qty</th>
                      <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total</th>
                      <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Earning</th>
                      <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.slice(0, 15).map((order) => {
                      const prod = products.find((p) => p.id === order.product_id);
                      const earning = order.total_price * (100 - commissionRate) / 100;
                      const statusColor = order.status === 'completed'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                        : order.status === 'pending'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                          : order.status === 'cancelled'
                            ? 'bg-red-500/15 text-red-400 border-red-500/20'
                            : 'bg-slate-600/15 text-slate-400 border-slate-500/20';
                      return (
                        <tr key={order.id} className="border-b border-slate-800/50 hover:bg-slate-700/10 transition-colors">
                          <td className="py-2.5 px-3 text-xs text-slate-400">#{order.id}</td>
                          <td className="py-2.5 px-3 text-xs text-white truncate max-w-[180px]">
                            {prod?.title || `Product #${order.product_id}`}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-slate-300">{order.quantity}</td>
                          <td className="py-2.5 px-3 text-xs text-white font-medium">${order.total_price.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-xs text-emerald-400 font-medium">${earning.toFixed(2)}</td>
                          <td className="py-2.5 px-3">
                            <Badge className={`text-[10px] border ${statusColor}`}>{order.status}</Badge>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-slate-500">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredOrders.length > 15 && (
                  <p className="text-center text-[11px] text-slate-600 mt-3">
                    Showing 15 of {filteredOrders.length} orders
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