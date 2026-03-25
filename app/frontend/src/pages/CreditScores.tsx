import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Award, TrendingUp, Gift, Shield, Star, Zap, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { client } from '@/lib/api';
import { withRetry } from '@/lib/retry';

interface CreditScore {
  id?: number;
  points: number;
  total_earned: number;
  total_redeemed: number;
  tier: string;
  account_status: string;
  last_activity?: string;
  created_at?: string;
}

interface CreditTransaction {
  id: number;
  points: number;
  type: string;
  description?: string;
  reference_id?: string;
  created_at?: string;
}

const TIER_CONFIG: Record<string, { color: string; bg: string; icon: typeof Star; next: string; pointsNeeded: number; maxPoints: number }> = {
  bronze: {
    color: 'text-amber-600',
    bg: 'bg-amber-600/15',
    icon: Shield,
    next: 'Silver',
    pointsNeeded: 500,
    maxPoints: 500,
  },
  silver: {
    color: 'text-slate-300',
    bg: 'bg-slate-300/15',
    icon: Star,
    next: 'Gold',
    pointsNeeded: 1500,
    maxPoints: 1500,
  },
  gold: {
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/15',
    icon: Award,
    next: 'Platinum',
    pointsNeeded: 5000,
    maxPoints: 5000,
  },
  platinum: {
    color: 'text-cyan-300',
    bg: 'bg-cyan-300/15',
    icon: Zap,
    next: '',
    pointsNeeded: 0,
    maxPoints: 10000,
  },
};

const TRANSACTION_STYLES: Record<string, { color: string; bg: string; prefix: string }> = {
  earned: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', prefix: '+' },
  bonus: { color: 'text-blue-400', bg: 'bg-blue-500/15', prefix: '+' },
  referral: { color: 'text-purple-400', bg: 'bg-purple-500/15', prefix: '+' },
  redeemed: { color: 'text-red-400', bg: 'bg-red-500/15', prefix: '' },
};

const DEFAULT_CREDIT: CreditScore = {
  points: 0,
  total_earned: 0,
  total_redeemed: 0,
  tier: 'bronze',
  account_status: 'active',
};

export default function CreditScores() {
  const navigate = useNavigate();
  const [credit, setCredit] = useState<CreditScore>(DEFAULT_CREDIT);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(true);

  useEffect(() => {
    loadCreditScore();
    loadTransactions();
  }, []);

  const loadCreditScore = async () => {
    try {
      const user = await withRetry(() => client.auth.me());
      if (!user?.data) {
        toast.error('Please sign in to view your credit score');
        navigate('/');
        return;
      }

      const res = await withRetry(() =>
        client.entities.credit_scores.query({ query: {}, limit: 1 })
      );
      const items = res?.data?.items || [];

      if (items.length > 0) {
        setCredit({
          id: items[0].id,
          points: items[0].points || 0,
          total_earned: items[0].total_earned || 0,
          total_redeemed: items[0].total_redeemed || 0,
          tier: items[0].tier || 'bronze',
          account_status: items[0].account_status || 'active',
          last_activity: items[0].last_activity,
          created_at: items[0].created_at,
        });
      } else {
        // Create initial credit score for the user
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const createRes = await withRetry(() =>
          client.entities.credit_scores.create({
            data: {
              points: 100,
              total_earned: 100,
              total_redeemed: 0,
              tier: 'bronze',
              account_status: 'active',
              last_activity: now,
              created_at: now,
            },
          })
        );
        if (createRes?.data) {
          setCredit({
            id: createRes.data.id,
            points: 100,
            total_earned: 100,
            total_redeemed: 0,
            tier: 'bronze',
            account_status: 'active',
            last_activity: now,
            created_at: now,
          });
          // Create welcome bonus transaction
          await withRetry(() =>
            client.entities.credit_transactions.create({
              data: {
                points: 100,
                type: 'bonus',
                description: 'Welcome bonus - Account created',
                reference_id: 'welcome',
                created_at: now,
              },
            })
          );
        }
      }
    } catch {
      toast.error('Failed to load credit score');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const res = await withRetry(() =>
        client.entities.credit_transactions.query({
          query: {},
          sort: '-created_at',
          limit: 20,
        })
      );
      setTransactions(res?.data?.items || []);
    } catch {
      // Silently fail
    } finally {
      setTxLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const tierConfig = TIER_CONFIG[credit.tier] || TIER_CONFIG.bronze;
  const TierIcon = tierConfig.icon;
  const progressToNext = tierConfig.pointsNeeded > 0
    ? Math.min((credit.total_earned / tierConfig.pointsNeeded) * 100, 100)
    : 100;

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

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Credit Score Header */}
        <Card className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border-slate-700 mb-6 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-bl-full" />
          <CardContent className="pt-8 pb-8">
            <div className="flex items-center gap-6">
              <div className={`h-20 w-20 rounded-2xl ${tierConfig.bg} flex items-center justify-center`}>
                <TierIcon className={`h-10 w-10 ${tierConfig.color}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-bold text-white">{credit.points.toLocaleString()}</h1>
                  <span className="text-slate-400 text-lg">points</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`${tierConfig.bg} ${tierConfig.color} border-0 capitalize text-sm font-semibold`}>
                    {credit.tier} Tier
                  </Badge>
                  <Badge className={`${credit.account_status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'} border-0 text-xs`}>
                    {credit.account_status}
                  </Badge>
                </div>
                {credit.created_at && (
                  <p className="text-xs text-slate-500 mt-2">
                    Member since {formatDate(credit.created_at)}
                  </p>
                )}
              </div>
            </div>

            {/* Progress to next tier */}
            {tierConfig.next && (
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-400">Progress to {tierConfig.next}</span>
                  <span className="text-slate-300 font-medium">
                    {credit.total_earned.toLocaleString()} / {tierConfig.pointsNeeded.toLocaleString()} pts
                  </span>
                </div>
                <Progress value={progressToNext} className="h-2 bg-slate-800" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 truncate">Total Earned</p>
                  <p className="text-lg font-bold text-white">{credit.total_earned.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                  <Gift className="h-5 w-5 text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 truncate">Redeemed</p>
                  <p className="text-lg font-bold text-white">{credit.total_redeemed.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                  <Award className="h-5 w-5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 truncate">Balance</p>
                  <p className="text-lg font-bold text-white">{credit.points.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* How to Earn Points */}
        <Card className="bg-slate-900 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Zap className="h-5 w-5 text-amber-400" />
              How to Earn Points
            </CardTitle>
            <CardDescription className="text-slate-400">
              Your points are saved securely and never expire until you deactivate your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { action: 'Make a purchase', points: '10 pts per AED spent', icon: '🛒' },
                { action: 'Write a review', points: '25 pts per review', icon: '⭐' },
                { action: 'Refer a friend', points: '200 pts per referral', icon: '👥' },
                { action: 'Daily login', points: '5 pts per day', icon: '📅' },
              ].map((item) => (
                <div
                  key={item.action}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-white">{item.action}</p>
                    <p className="text-xs text-emerald-400">{item.points}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card className="bg-slate-900 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-cyan-400" />
              Transaction History
            </CardTitle>
            <CardDescription className="text-slate-400">
              Your complete points activity log
            </CardDescription>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-10">
                <Clock className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400">No transactions yet</p>
                <p className="text-sm text-slate-500 mt-1">Start shopping to earn points!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => {
                  const style = TRANSACTION_STYLES[tx.type] || TRANSACTION_STYLES.earned;
                  return (
                    <div key={tx.id}>
                      <div className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-full ${style.bg} flex items-center justify-center shrink-0`}>
                            <span className={`text-sm font-bold ${style.color}`}>
                              {style.prefix}{tx.points > 0 && tx.type !== 'redeemed' ? '' : ''}{tx.type === 'redeemed' ? '-' : '+'}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {tx.description || `Points ${tx.type}`}
                            </p>
                            <p className="text-xs text-slate-500">{formatDate(tx.created_at)}</p>
                          </div>
                        </div>
                        <span className={`text-sm font-bold ${style.color}`}>
                          {tx.type === 'redeemed' ? '-' : '+'}{Math.abs(tx.points).toLocaleString()} pts
                        </span>
                      </div>
                      <Separator className="bg-slate-800" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Security Note */}
        <Card className="bg-slate-900/50 border-slate-700/50 mb-8">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Your Account is Secured</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Your saved items, credit scores, and all account data are securely stored and will persist
                  as long as your account is active. Your data will only be removed if you choose to deactivate
                  or close your account. We use industry-standard encryption to protect your information.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}