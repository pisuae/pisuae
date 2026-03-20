import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ArrowRight, CheckCircle, Percent, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { client } from '@/lib/api';

const PLATFORM_COMMISSION = 15;

export default function VendorSignup() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingVendor, setExistingVendor] = useState<any>(null);
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthAndVendor();
  }, []);

  const checkAuthAndVendor = async () => {
    try {
      const res = await client.auth.me();
      if (res?.data) {
        setUser(res.data);
        // Check if already a vendor
        const vendorRes = await client.entities.vendors.query({ query: {} });
        const vendors = vendorRes?.data?.items || [];
        if (vendors.length > 0) {
          setExistingVendor(vendors[0]);
        }
      }
    } catch {
      // Not logged in
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    await client.auth.toLogin();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      toast.error('Please enter your business name');
      return;
    }
    setSubmitting(true);
    try {
      await client.entities.vendors.create({
        data: {
          business_name: businessName.trim(),
          description: description.trim(),
          commission_rate: PLATFORM_COMMISSION,
          status: 'active',
          total_sales: 0,
          total_earnings: 0,
          created_at: new Date().toISOString(),
        },
      });
      toast.success('Vendor account created successfully!');
      navigate('/vendor/dashboard');
    } catch (err) {
      console.error('Failed to create vendor account:', err);
      toast.error('Failed to create vendor account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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

  // Already a vendor - redirect
  if (existingVendor) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">You're Already a Vendor!</h1>
          <p className="text-slate-400 mb-6">
            Your business "{existingVendor.business_name}" is {existingVendor.status}.
          </p>
          <Button
            onClick={() => navigate('/vendor/dashboard')}
            className="bg-blue-600 hover:bg-blue-500 text-white"
          >
            Go to Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <div className="container mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm mb-6">
            <Store className="h-4 w-4" />
            Become a Vendor
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Sell on{' '}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              PIS UAE
            </span>
          </h1>
          <p className="text-slate-400 max-w-lg mx-auto text-lg">
            Join our marketplace and reach thousands of tech buyers. List your products and start earning today.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700">
                <Users className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-white">Wide Reach</h3>
              <p className="text-sm text-slate-400">
                Access thousands of tech buyers looking for laptop parts & electronics.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-white">Easy Management</h3>
              <p className="text-sm text-slate-400">
                Powerful dashboard to manage products, track sales, and monitor earnings.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700">
                <Percent className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-white">Fair Commission</h3>
              <p className="text-sm text-slate-400">
                Only {PLATFORM_COMMISSION}% platform fee. You keep {100 - PLATFORM_COMMISSION}% of every sale.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Signup Form */}
        <div className="max-w-lg mx-auto">
          {!user ? (
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader className="text-center">
                <CardTitle className="text-white text-xl">Sign In Required</CardTitle>
                <CardDescription className="text-slate-400">
                  You need to sign in before creating a vendor account.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center pb-8">
                <Button onClick={handleLogin} className="bg-blue-600 hover:bg-blue-500 text-white px-8">
                  Sign In to Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white text-xl">Create Vendor Account</CardTitle>
                <CardDescription className="text-slate-400">
                  Fill in your business details to start selling on PIS UAE.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Business Name *
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. TechPro Electronics"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Business Description
                    </label>
                    <Textarea
                      placeholder="Tell buyers about your business and what you sell..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 min-h-[100px]"
                    />
                  </div>
                  <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Platform Commission</span>
                      <span className="text-lg font-bold text-amber-400">{PLATFORM_COMMISSION}%</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      You keep {100 - PLATFORM_COMMISSION}% of every sale. Commission is deducted automatically.
                    </p>
                  </div>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Creating Account...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        Create Vendor Account
                      </span>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}