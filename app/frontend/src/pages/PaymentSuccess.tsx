import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Package, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Header from '@/components/Header';
import { client } from '@/lib/api';
import { withRetry } from '@/lib/retry';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [paymentInfo, setPaymentInfo] = useState<{
    status: string;
    payment_status: string;
    order_ids: number[];
  } | null>(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId) {
      verifyPayment();
    } else {
      setStatus('failed');
    }
  }, [sessionId]);

  const verifyPayment = async () => {
    try {
      const res = await withRetry(() =>
        client.apiCall.invoke({
          url: '/api/v1/payment/verify',
          method: 'POST',
          data: { session_id: sessionId },
        })
      );

      const data = res?.data;
      if (data) {
        setPaymentInfo(data);
        setStatus(data.status === 'paid' || data.payment_status === 'paid' ? 'success' : 'failed');
      } else {
        setStatus('failed');
      }
    } catch (err) {
      console.error('Payment verification failed:', err);
      setStatus('failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header cartCount={0} />

      <div className="container mx-auto px-4 py-16 flex items-center justify-center">
        <Card className="bg-slate-800/80 border-slate-700/50 max-w-md w-full">
          <CardContent className="p-8 text-center space-y-6">
            {status === 'loading' && (
              <>
                <div className="flex justify-center">
                  <Loader2 className="h-16 w-16 text-blue-400 animate-spin" />
                </div>
                <h2 className="text-2xl font-bold">Verifying Payment...</h2>
                <p className="text-slate-400">Please wait while we confirm your payment.</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20">
                    <CheckCircle className="h-12 w-12 text-emerald-400" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-emerald-400">Payment Successful!</h2>
                <p className="text-slate-400">
                  Your payment has been processed successfully. Your order{paymentInfo?.order_ids && paymentInfo.order_ids.length > 1 ? 's are' : ' is'} being prepared.
                </p>
                {paymentInfo?.order_ids && (
                  <div className="bg-slate-900/50 rounded-lg p-4">
                    <p className="text-sm text-slate-400 mb-1">Order ID{paymentInfo.order_ids.length > 1 ? 's' : ''}</p>
                    <p className="text-lg font-mono font-bold text-white">
                      {paymentInfo.order_ids.map((id) => `#${id}`).join(', ')}
                    </p>
                  </div>
                )}
                <div className="flex flex-col gap-3 pt-2">
                  <Button
                    onClick={() => navigate('/orders')}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    View My Orders
                  </Button>
                  <Link to="/">
                    <Button variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                      <Home className="h-4 w-4 mr-2" />
                      Continue Shopping
                    </Button>
                  </Link>
                </div>
              </>
            )}

            {status === 'failed' && (
              <>
                <div className="flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
                    <XCircle className="h-12 w-12 text-red-400" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-red-400">Payment Issue</h2>
                <p className="text-slate-400">
                  {!sessionId
                    ? 'No payment session found. Please try again from your cart.'
                    : 'We could not verify your payment. If you were charged, please contact support.'}
                </p>
                <div className="flex flex-col gap-3 pt-2">
                  <Button
                    onClick={() => navigate('/cart')}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    Return to Cart
                  </Button>
                  <Button
                    onClick={() => navigate('/orders')}
                    variant="outline"
                    className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Check My Orders
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}