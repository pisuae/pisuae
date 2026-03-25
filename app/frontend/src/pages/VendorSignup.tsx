import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Store, ArrowRight, CheckCircle, Percent, TrendingUp, Users,
  Building2, Mail, Phone, CreditCard, ExternalLink, RefreshCw, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { client } from '@/lib/api';

const PLATFORM_COMMISSION = 15;

const BUSINESS_TYPES = [
  'Electronics & Gadgets',
  'Computer Parts & Accessories',
  'Mobile Phones & Tablets',
  'Laptops & Desktops',
  'Networking Equipment',
  'Gaming & Consoles',
  'Beauty & Makeup',
  'Fashion & Apparel',
  'Home & Kitchen',
  'General Trading',
  'Other',
];

interface ConnectStatus {
  vendor_id: number;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_complete: boolean;
  details_submitted: boolean;
}

export default function VendorSignup() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingVendor, setExistingVendor] = useState<any>(null);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Business Info
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [description, setDescription] = useState('');

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    checkAuthAndVendor();
  }, []);

  // Check if returning from Stripe onboarding
  useEffect(() => {
    const onboarding = searchParams.get('onboarding');
    const refresh = searchParams.get('refresh');
    if (onboarding === 'complete' || refresh === 'true') {
      checkStripeStatus();
    }
  }, [searchParams]);

  const checkAuthAndVendor = async () => {
    try {
      const res = await client.auth.me();
      if (res?.data) {
        setUser(res.data);
        const vendorRes = await client.entities.vendors.query({ query: {} });
        const vendors = vendorRes?.data?.items || [];
        if (vendors.length > 0) {
          setExistingVendor(vendors[0]);
          // Check Stripe Connect status if vendor has stripe_account_id
          if (vendors[0].stripe_account_id) {
            await checkStripeStatus();
          }
        }
      }
    } catch {
      // Not logged in
    } finally {
      setLoading(false);
    }
  };

  const checkStripeStatus = async () => {
    setCheckingStatus(true);
    try {
      const res = await client.apiCall.invoke({
        url: '/api/v1/stripe-connect/status',
        method: 'GET',
      });
      if (res?.data) {
        setConnectStatus(res.data);
        if (res.data.onboarding_complete) {
          toast.success('Stripe account is fully connected! You can now receive payments.');
        }
      }
    } catch (err) {
      console.error('Failed to check Stripe status:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleLogin = async () => {
    await client.auth.toLogin();
  };

  const validateForm = () => {
    if (!businessName.trim()) {
      toast.error('Please enter your business name');
      return false;
    }
    if (!businessType) {
      toast.error('Please select your type of business');
      return false;
    }
    if (!email.trim()) {
      toast.error('Please enter a valid email address');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error('Please enter a valid email address');
      return false;
    }
    if (!mobileNumber.trim()) {
      toast.error('Please enter your mobile number');
      return false;
    }
    if (mobileNumber.trim().length < 7) {
      toast.error('Please enter a valid mobile number');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const res = await client.apiCall.invoke({
        url: '/api/v1/stripe-connect/create-account',
        method: 'POST',
        data: {
          business_name: businessName.trim(),
          email: email.trim(),
          mobile_number: mobileNumber.trim(),
          description: description.trim(),
          business_type: businessType,
        },
      });

      if (res?.data?.onboarding_url) {
        toast.success('Vendor account created! Redirecting to Stripe to connect your bank...');
        // Redirect to Stripe onboarding
        client.utils.openUrl(res.data.onboarding_url);
      } else {
        toast.error('Failed to create vendor account. Please try again.');
      }
    } catch (err: any) {
      console.error('Failed to create vendor account:', err);
      const msg = err?.response?.data?.detail || 'Failed to create vendor account. Please try again.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResumeOnboarding = async () => {
    if (!existingVendor) return;
    setSubmitting(true);
    try {
      const res = await client.apiCall.invoke({
        url: '/api/v1/stripe-connect/onboarding-link',
        method: 'POST',
        data: { vendor_id: existingVendor.id },
      });
      if (res?.data?.onboarding_url) {
        client.utils.openUrl(res.data.onboarding_url);
      }
    } catch (err) {
      console.error('Failed to get onboarding link:', err);
      toast.error('Failed to get onboarding link. Please try again.');
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

  // Vendor exists and onboarding is complete
  if (existingVendor && connectStatus?.onboarding_complete) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">You're All Set!</h1>
          <p className="text-slate-400 mb-2">
            Your business "<span className="text-white">{existingVendor.business_name}</span>" is connected via Stripe.
          </p>
          <div className="flex items-center justify-center gap-2 mb-6">
            <Badge className="bg-emerald-500/20 text-emerald-400">
              <Shield className="h-3 w-3 mr-1" />
              Bank Verified via Stripe
            </Badge>
            <Badge className="bg-blue-500/20 text-blue-400">
              85% Revenue Share
            </Badge>
          </div>
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

  // Vendor exists but onboarding is NOT complete
  if (existingVendor && existingVendor.stripe_account_id) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Header />
        <div className="container mx-auto px-4 py-16 max-w-lg">
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardHeader className="text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 mx-auto mb-3">
                <CreditCard className="h-7 w-7 text-amber-400" />
              </div>
              <CardTitle className="text-white text-xl">Complete Stripe Setup</CardTitle>
              <CardDescription className="text-slate-400">
                Your vendor account for "<span className="text-white">{existingVendor.business_name}</span>" 
                needs Stripe onboarding to be completed to receive payments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {connectStatus && (
                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Charges Enabled</span>
                    <Badge className={connectStatus.charges_enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                      {connectStatus.charges_enabled ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Payouts Enabled</span>
                    <Badge className={connectStatus.payouts_enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                      {connectStatus.payouts_enabled ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Details Submitted</span>
                    <Badge className={connectStatus.details_submitted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                      {connectStatus.details_submitted ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={checkStripeStatus}
                  disabled={checkingStatus}
                  variant="outline"
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${checkingStatus ? 'animate-spin' : ''}`} />
                  Refresh Status
                </Button>
                <Button
                  onClick={handleResumeOnboarding}
                  disabled={submitting}
                  className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Loading...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Complete Stripe Setup
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Existing vendor without Stripe (legacy)
  if (existingVendor && !existingVendor.stripe_account_id) {
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
            Join our marketplace and reach thousands of buyers. Connect your bank through Stripe and start earning today.
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
                Access thousands of buyers looking for electronics, beauty & more.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-white">Secure Payments via Stripe</h3>
              <p className="text-sm text-slate-400">
                Bank details verified securely through Stripe. Get paid directly per order.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700">
                <Percent className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-white">You Keep 85%</h3>
              <p className="text-sm text-slate-400">
                Only {PLATFORM_COMMISSION}% platform fee. You keep {100 - PLATFORM_COMMISSION}% of every sale automatically.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <div className="max-w-2xl mx-auto mb-12">
          <h2 className="text-xl font-bold text-center mb-6 text-white">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col items-center text-center p-4">
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold mb-3">1</div>
              <h4 className="font-medium text-white mb-1">Fill Business Info</h4>
              <p className="text-xs text-slate-400">Enter your business name, email & mobile number</p>
            </div>
            <div className="flex flex-col items-center text-center p-4">
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold mb-3">2</div>
              <h4 className="font-medium text-white mb-1">Connect via Stripe</h4>
              <p className="text-xs text-slate-400">Securely add your bank details through Stripe's verified process</p>
            </div>
            <div className="flex flex-col items-center text-center p-4">
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold mb-3">3</div>
              <h4 className="font-medium text-white mb-1">Start Selling</h4>
              <p className="text-xs text-slate-400">List products & get 85% of every sale deposited to your bank</p>
            </div>
          </div>
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
                <CardTitle className="text-white text-xl flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-400" />
                  Business Information
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Fill in your business details. After submitting, you'll be redirected to Stripe to securely connect your bank account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      <Store className="h-3.5 w-3.5 inline mr-1" />
                      Business Name <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. TechPro Electronics"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      <Building2 className="h-3.5 w-3.5 inline mr-1" />
                      Type of Business <span className="text-red-400">*</span>
                    </label>
                    <Select value={businessType} onValueChange={setBusinessType}>
                      <SelectTrigger className="bg-slate-900 border-slate-600 text-white focus:border-blue-500">
                        <SelectValue placeholder="Select your business type" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {BUSINESS_TYPES.map((type) => (
                          <SelectItem key={type} value={type} className="text-white hover:bg-slate-700 focus:bg-slate-700">
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      <Mail className="h-3.5 w-3.5 inline mr-1" />
                      Valid Email <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="email"
                      placeholder="business@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      <Phone className="h-3.5 w-3.5 inline mr-1" />
                      Mobile Number <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="tel"
                      placeholder="+971 XX XXX XXXX"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
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
                      className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 min-h-[80px]"
                    />
                  </div>

                  {/* Stripe Info Banner */}
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CreditCard className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                      <div>
                        <h4 className="text-sm font-medium text-blue-300 mb-1">Secure Bank Connection via Stripe</h4>
                        <p className="text-xs text-slate-400">
                          After submitting, you'll be redirected to Stripe to securely connect your bank account. 
                          Stripe handles all bank verification — we never see your bank details directly.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Commission Info */}
                  <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Platform Commission</span>
                      <span className="text-lg font-bold text-amber-400">{PLATFORM_COMMISSION}%</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      You keep {100 - PLATFORM_COMMISSION}% of every sale. Payments are split automatically per order via Stripe.
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
                        Create Account & Connect Bank via Stripe
                        <ExternalLink className="h-4 w-4" />
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