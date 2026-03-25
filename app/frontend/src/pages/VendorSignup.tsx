import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ArrowRight, CheckCircle, Percent, TrendingUp, Users, Building2, Mail, Phone, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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

export default function VendorSignup() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingVendor, setExistingVendor] = useState<any>(null);
  const [step, setStep] = useState(1);

  // Step 1: Business Info
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [description, setDescription] = useState('');

  // Step 2: Bank Details
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [iban, setIban] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    checkAuthAndVendor();
  }, []);

  const checkAuthAndVendor = async () => {
    try {
      const res = await client.auth.me();
      if (res?.data) {
        setUser(res.data);
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

  const validateStep1 = () => {
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

  const validateStep2 = () => {
    if (!bankName.trim()) {
      toast.error('Please enter your bank name');
      return false;
    }
    if (!accountHolder.trim()) {
      toast.error('Please enter the account holder name');
      return false;
    }
    if (!accountNumber.trim()) {
      toast.error('Please enter your bank account number');
      return false;
    }
    if (!iban.trim()) {
      toast.error('Please enter your IBAN number');
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setSubmitting(true);
    try {
      await client.entities.vendors.create({
        data: {
          business_name: businessName.trim(),
          business_type: businessType,
          email: email.trim(),
          mobile_number: mobileNumber.trim(),
          bank_name: bankName.trim(),
          bank_account_holder: accountHolder.trim(),
          bank_account_number: accountNumber.trim(),
          bank_iban: iban.trim(),
          bank_verified: 'pending',
          description: description.trim(),
          commission_rate: PLATFORM_COMMISSION,
          status: 'pending_verification',
          total_sales: 0,
          total_earnings: 0,
          created_at: new Date().toISOString(),
        },
      });
      toast.success('Vendor application submitted! Your bank details are under verification.');
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
            Join our marketplace and reach thousands of buyers. List your products and start earning today.
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

        {/* Step Indicator */}
        {user && (
          <div className="max-w-lg mx-auto mb-6">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  1
                </div>
                <span className={`text-sm ${step >= 1 ? 'text-white' : 'text-slate-500'}`}>Business Info</span>
              </div>
              <div className={`h-0.5 w-12 ${step >= 2 ? 'bg-blue-600' : 'bg-slate-700'}`} />
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  2
                </div>
                <span className={`text-sm ${step >= 2 ? 'text-white' : 'text-slate-500'}`}>Bank Details</span>
              </div>
            </div>
          </div>
        )}

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
          ) : step === 1 ? (
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white text-xl flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-400" />
                  Business Information
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Fill in your business details to start selling on PIS UAE.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
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

                  <Button
                    type="button"
                    onClick={handleNextStep}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3"
                  >
                    Next: Bank Details
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white text-xl flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-emerald-400" />
                  Verified Bank Details
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Provide your bank details for receiving payments. All details will be verified.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Bank Name <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. Emirates NBD, ADCB, FAB"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Account Holder Name <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="Full name as on bank account"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Account Number <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="Enter your bank account number"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      IBAN Number <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. AE07 0331 0000 0000 0000 00"
                      value={iban}
                      onChange={(e) => setIban(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                    <p className="text-sm text-amber-300 flex items-start gap-2">
                      <Landmark className="h-4 w-4 mt-0.5 shrink-0" />
                      Your bank details will be verified within 1-2 business days. You'll receive a confirmation once verified.
                    </p>
                  </div>

                  <Separator className="bg-slate-700" />

                  <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Platform Commission</span>
                      <span className="text-lg font-bold text-amber-400">{PLATFORM_COMMISSION}%</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      You keep {100 - PLATFORM_COMMISSION}% of every sale. Commission is deducted automatically.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-3"
                    >
                      {submitting ? (
                        <span className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          Submitting...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Store className="h-4 w-4" />
                          Submit Vendor Application
                        </span>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}