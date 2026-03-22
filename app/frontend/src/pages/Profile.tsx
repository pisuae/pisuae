import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Save, ArrowLeft, Bell, Moon, Sun, Globe, Newspaper, Check, Package, ArrowRight, DollarSign, TrendingUp, ShoppingBag, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { client } from '@/lib/api';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

interface UserPreferences {
  id?: number;
  display_name: string;
  theme: string;
  language: string;
  notifications_enabled: boolean;
  newsletter_subscribed: boolean;
}

interface Order {
  id: number;
  total_amount: number;
  status: string;
  created_at: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  processing: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  shipped: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  delivered: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  cancelled: { bg: 'bg-red-500/20', text: 'text-red-400' },
};

const DEFAULT_PREFERENCES: UserPreferences = {
  display_name: '',
  theme: 'dark',
  language: 'en',
  notifications_enabled: true,
  newsletter_subscribed: false,
};

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية (Arabic)' },
  { value: 'fr', label: 'Français (French)' },
  { value: 'es', label: 'Español (Spanish)' },
  { value: 'zh', label: '中文 (Chinese)' },
];

export default function Profile() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [spendingStats, setSpendingStats] = useState({ totalSpent: 0, orderCount: 0, avgOrder: 0 });
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadProfile();
    loadRecentOrders();
  }, []);

  const loadRecentOrders = async () => {
    try {
      // Fetch all orders for spending stats
      const allRes = await client.entities.orders.query({
        query: {},
        sort: '-created_at',
        limit: 100,
      });
      const fetchedOrders: Order[] = allRes?.data?.items || [];
      setAllOrders(fetchedOrders);

      // Set recent 3 orders
      setRecentOrders(fetchedOrders.slice(0, 3));

      // Compute spending stats (exclude cancelled orders)
      const validOrders = fetchedOrders.filter((o) => o.status?.toLowerCase() !== 'cancelled');
      const totalSpent = validOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      const orderCount = validOrders.length;
      const avgOrder = orderCount > 0 ? totalSpent / orderCount : 0;
      setSpendingStats({ totalSpent, orderCount, avgOrder });
    } catch {
      // Silently fail - orders section is supplementary
    } finally {
      setOrdersLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getStatusStyle = (status: string) => {
    return STATUS_STYLES[status.toLowerCase()] || { bg: 'bg-slate-500/20', text: 'text-slate-400' };
  };

  const loadProfile = async () => {
    try {
      const res = await client.auth.me();
      if (!res?.data) {
        toast.error('Please sign in to view your profile');
        navigate('/');
        return;
      }
      setUser({
        id: res.data.id || res.data.sub,
        email: res.data.email || '',
        name: res.data.name || res.data.nickname || '',
        avatar: res.data.picture || res.data.avatar || '',
      });

      // Load preferences from database
      const prefRes = await client.entities.user_preferences.query({ query: {} });
      const items = prefRes?.data?.items || [];
      if (items.length > 0) {
        const pref = items[0];
        setPreferences({
          id: pref.id,
          display_name: pref.display_name || '',
          theme: pref.theme || 'dark',
          language: pref.language || 'en',
          notifications_enabled: pref.notifications_enabled ?? true,
          newsletter_subscribed: pref.newsletter_subscribed ?? false,
        });
      } else {
        // Set display name from auth profile
        setPreferences({
          ...DEFAULT_PREFERENCES,
          display_name: res.data.name || res.data.nickname || '',
        });
      }
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      if (preferences.id) {
        await client.entities.user_preferences.update({
          id: String(preferences.id),
          data: {
            display_name: preferences.display_name,
            theme: preferences.theme,
            language: preferences.language,
            notifications_enabled: preferences.notifications_enabled,
            newsletter_subscribed: preferences.newsletter_subscribed,
            updated_at: now,
          },
        });
      } else {
        const res = await client.entities.user_preferences.create({
          data: {
            display_name: preferences.display_name,
            theme: preferences.theme,
            language: preferences.language,
            notifications_enabled: preferences.notifications_enabled,
            newsletter_subscribed: preferences.newsletter_subscribed,
            created_at: now,
            updated_at: now,
          },
        });
        if (res?.data?.id) {
          setPreferences((prev) => ({ ...prev, id: res.data.id }));
        }
      }
      setHasChanges(false);
      toast.success('Profile updated successfully!');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) return name.slice(0, 2).toUpperCase();
    if (email) return email.slice(0, 2).toUpperCase();
    return 'U';
  };

  const monthlySpending = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; amount: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      months.push({ key, label, amount: 0 });
    }

    const validOrders = allOrders.filter((o) => o.status?.toLowerCase() !== 'cancelled');
    for (const order of validOrders) {
      try {
        const date = new Date(order.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const month = months.find((m) => m.key === key);
        if (month) {
          month.amount += Number(order.total_amount || 0);
        }
      } catch {
        // skip invalid dates
      }
    }

    return months.map((m) => ({
      name: m.label,
      amount: Math.round(m.amount * 100) / 100,
    }));
  }, [allOrders]);

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

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Header />
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <User className="h-16 w-16 text-slate-500" />
          <p className="text-slate-400 text-lg">Please sign in to view your profile</p>
          <Button onClick={() => client.auth.toLogin()} className="bg-blue-600 hover:bg-blue-500">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Profile Header Card */}
        <Card className="bg-slate-900 border-slate-700 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20 border-2 border-blue-500">
                <AvatarImage src={user.avatar} alt={user.name || 'User'} />
                <AvatarFallback className="bg-blue-600 text-white text-xl font-bold">
                  {getInitials(preferences.display_name || user.name, user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white">
                  {preferences.display_name || user.name || 'User'}
                </h1>
                <div className="flex items-center gap-2 mt-1 text-slate-400">
                  <Mail className="h-4 w-4" />
                  <span>{user.email}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Spending Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 truncate">Total Spent</p>
                  {ordersLoading ? (
                    <div className="h-5 w-16 bg-slate-700 rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-lg font-bold text-white truncate">
                      AED {spendingStats.totalSpent.toFixed(0)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                  <ShoppingBag className="h-5 w-5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 truncate">Orders</p>
                  {ordersLoading ? (
                    <div className="h-5 w-10 bg-slate-700 rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-lg font-bold text-white">
                      {spendingStats.orderCount}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-5 w-5 text-purple-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 truncate">Avg. Order</p>
                  {ordersLoading ? (
                    <div className="h-5 w-16 bg-slate-700 rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-lg font-bold text-white truncate">
                      AED {spendingStats.avgOrder.toFixed(0)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Spending Trend */}
        <Card className="bg-slate-900 border-slate-700 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-cyan-400" />
              Monthly Spending
            </CardTitle>
            <CardDescription className="text-slate-400">
              Last 6 months spending trend
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
              </div>
            ) : (
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySpending} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      axisLine={{ stroke: '#475569' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #475569',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '13px',
                      }}
                      formatter={(value: number) => [`AED ${value.toFixed(2)}`, 'Spent']}
                      cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                    />
                    <Bar
                      dataKey="amount"
                      fill="#06b6d4"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Display Name */}
        <Card className="bg-slate-900 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="h-5 w-5 text-blue-400" />
              Display Name
            </CardTitle>
            <CardDescription className="text-slate-400">
              Choose how your name appears across the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-slate-300">
                Display Name
              </Label>
              <Input
                id="displayName"
                value={preferences.display_name}
                onChange={(e) => updatePreference('display_name', e.target.value)}
                placeholder="Enter your display name"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="bg-slate-900 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Globe className="h-5 w-5 text-emerald-400" />
              Preferences
            </CardTitle>
            <CardDescription className="text-slate-400">
              Customize your experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Theme */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {preferences.theme === 'dark' ? (
                  <Moon className="h-5 w-5 text-indigo-400" />
                ) : (
                  <Sun className="h-5 w-5 text-amber-400" />
                )}
                <div>
                  <p className="text-white font-medium">Theme</p>
                  <p className="text-sm text-slate-400">Choose your preferred theme</p>
                </div>
              </div>
              <Select
                value={preferences.theme}
                onValueChange={(value) => updatePreference('theme', value)}
              >
                <SelectTrigger className="w-32 bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="dark" className="text-white hover:bg-slate-700">Dark</SelectItem>
                  <SelectItem value="light" className="text-white hover:bg-slate-700">Light</SelectItem>
                  <SelectItem value="system" className="text-white hover:bg-slate-700">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator className="bg-slate-700" />

            {/* Language */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-cyan-400" />
                <div>
                  <p className="text-white font-medium">Language</p>
                  <p className="text-sm text-slate-400">Select your preferred language</p>
                </div>
              </div>
              <Select
                value={preferences.language}
                onValueChange={(value) => updatePreference('language', value)}
              >
                <SelectTrigger className="w-40 bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value} className="text-white hover:bg-slate-700">
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-slate-900 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-400" />
              Notifications
            </CardTitle>
            <CardDescription className="text-slate-400">
              Manage your notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Push Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-blue-400" />
                <div>
                  <p className="text-white font-medium">Push Notifications</p>
                  <p className="text-sm text-slate-400">Receive order updates and alerts</p>
                </div>
              </div>
              <Switch
                checked={preferences.notifications_enabled}
                onCheckedChange={(checked) => updatePreference('notifications_enabled', checked)}
              />
            </div>

            <Separator className="bg-slate-700" />

            {/* Newsletter */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Newspaper className="h-5 w-5 text-purple-400" />
                <div>
                  <p className="text-white font-medium">Newsletter</p>
                  <p className="text-sm text-slate-400">Get weekly deals and product updates</p>
                </div>
              </div>
              <Switch
                checked={preferences.newsletter_subscribed}
                onCheckedChange={(checked) => updatePreference('newsletter_subscribed', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="bg-slate-900 border-slate-700 mb-6">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-400" />
                Recent Orders
              </CardTitle>
              <CardDescription className="text-slate-400 mt-1">
                Your latest order activity
              </CardDescription>
            </div>
            <Link to="/orders">
              <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 hover:bg-slate-800">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="text-center py-6">
                <Package className="h-10 w-10 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No orders yet</p>
                <Link to="/products">
                  <Button variant="link" className="text-blue-400 hover:text-blue-300 mt-1 text-sm p-0 h-auto">
                    Start shopping →
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => {
                  const style = getStatusStyle(order.status);
                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer"
                      onClick={() => navigate('/orders')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-slate-700 flex items-center justify-center">
                          <Package className="h-4 w-4 text-slate-300" />
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">Order #{order.id}</p>
                          <p className="text-slate-500 text-xs">{formatDate(order.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-white text-sm font-semibold">
                          AED {Number(order.total_amount).toFixed(2)}
                        </span>
                        <Badge className={`${style.bg} ${style.text} border-0 text-xs capitalize`}>
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3 pb-8">
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Saving...
              </>
            ) : hasChanges ? (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Saved
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}