import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Package, CheckCircle, Tag, Info, Star, Send, User, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { client } from '@/lib/api';
import { withRetry, withRetryQuiet } from '@/lib/retry';
import { resolveImageUrl } from '@/lib/image';

interface Product {
  id: number;
  title: string;
  description?: string;
  price: number;
  category: string;
  condition: string;
  image_url?: string;
  stock?: number;
  status: string;
  created_at?: string;
}

interface Review {
  id: number;
  product_id: number;
  rating: number;
  review_text?: string;
  reviewer_name?: string;
  created_at?: string;
}

const conditionLabels: Record<string, { label: string; color: string }> = {
  new: { label: 'Brand New', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  'like-new': { label: 'Like New', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  refurbished: { label: 'Refurbished', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  used: { label: 'Used', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
};

const defaultImage = 'https://mgx-backend-cdn.metadl.com/generate/images/1040407/2026-03-18/c1384985-4f46-41a1-af84-fd758bd4107a.png';

function StarRatingDisplay({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-6 w-6' : size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${
            star <= Math.round(rating)
              ? 'text-amber-400 fill-amber-400'
              : 'text-slate-600'
          }`}
        />
      ))}
    </div>
  );
}

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={`h-7 w-7 transition-colors ${
              star <= (hovered || value)
                ? 'text-amber-400 fill-amber-400'
                : 'text-slate-600 hover:text-slate-500'
            }`}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-sm text-slate-400">
          {value === 1 ? 'Poor' : value === 2 ? 'Fair' : value === 3 ? 'Good' : value === 4 ? 'Very Good' : 'Excellent'}
        </span>
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const date = review.created_at
    ? new Date(review.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/20">
            <User className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {review.reviewer_name || 'Anonymous'}
            </p>
            <p className="text-xs text-slate-500">{date}</p>
          </div>
        </div>
        <StarRatingDisplay rating={review.rating} />
      </div>
      {review.review_text && (
        <p className="text-sm text-slate-300 leading-relaxed">{review.review_text}</p>
      )}
    </div>
  );
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [resolvedImageSrc, setResolvedImageSrc] = useState<string>(defaultImage);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Saved/wishlist state
  const [isSaved, setIsSaved] = useState(false);
  const [savedItemId, setSavedItemId] = useState<number | null>(null);
  const [savingItem, setSavingItem] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  // New review form state
  const [newRating, setNewRating] = useState(0);
  const [newReviewText, setNewReviewText] = useState('');
  const [newReviewerName, setNewReviewerName] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadAll = async () => {
      // Load product first (critical)
      await loadProduct();
      if (cancelled) return;
      // Stagger non-critical calls with longer delays to avoid simultaneous Lambda DNS resolution issues
      // The global request queue in retry.ts also serializes concurrent requests
      await new Promise((r) => setTimeout(r, 600));
      if (cancelled) return;
      checkAuth();
      await new Promise((r) => setTimeout(r, 500));
      if (cancelled) return;
      checkSavedStatus();
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;
      loadReviews();
      await new Promise((r) => setTimeout(r, 500));
      if (cancelled) return;
      loadRating();
      await new Promise((r) => setTimeout(r, 500));
      if (cancelled) return;
      loadCartCount();
    };

    loadAll();
    return () => { cancelled = true; };
  }, [id]);

  const checkAuth = async () => {
    try {
      const user = await withRetry(() => client.auth.me());
      setIsLoggedIn(!!user?.data);
    } catch {
      setIsLoggedIn(false);
    }
  };

  const checkSavedStatus = async () => {
    if (!id) return;
    try {
      const user = await withRetry(() => client.auth.me());
      if (!user?.data) return;
      const res = await withRetry(() =>
        client.entities.saved_items.query({ query: { product_id: Number(id) } })
      );
      const items = res?.data?.items || [];
      if (items.length > 0) {
        setIsSaved(true);
        setSavedItemId(items[0].id);
      }
    } catch {
      // Silently fail
    }
  };

  const handleToggleSave = async () => {
    setSavingItem(true);
    try {
      const user = await withRetry(() => client.auth.me());
      if (!user?.data) {
        toast.error('Please sign in to save items');
        await client.auth.toLogin();
        return;
      }

      if (isSaved && savedItemId) {
        await withRetry(() =>
          client.entities.saved_items.delete({ id: String(savedItemId) })
        );
        setIsSaved(false);
        setSavedItemId(null);
        toast.success('Removed from saved items');
      } else {
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const res = await withRetry(() =>
          client.entities.saved_items.create({
            data: {
              product_id: Number(id),
              created_at: now,
            },
          })
        );
        if (res?.data?.id) {
          setIsSaved(true);
          setSavedItemId(res.data.id);
          toast.success('Saved to your wishlist!');
        }
      }
    } catch {
      toast.error('Failed to update saved items');
    } finally {
      setSavingItem(false);
    }
  };

  const loadProduct = async () => {
    if (!id) return;
    try {
      const res = await withRetry(() => client.entities.products.get({ id }));
      const prod = res?.data || null;
      setProduct(prod);
      if (prod?.image_url) {
        const url = await resolveImageUrl(prod.image_url);
        setResolvedImageSrc(url || defaultImage);
      }
      // Track product view
      if (prod?.seller_id) {
        try {
          await withRetry(() =>
            client.entities.product_views.create({
              data: {
                product_id: Number(id),
                seller_id: prod.seller_id,
                viewer_ip: 'web',
                viewed_at: new Date().toISOString(),
              },
            })
          );
        } catch {
          // Silently fail - view tracking is non-critical
        }
      }
    } catch (err) {
      console.error('Failed to load product:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    if (!id) return;
    setReviewsLoading(true);
    try {
      // Use quiet retry - reviews are non-critical, page works without them
      const res = await withRetryQuiet(
        () =>
          client.apiCall.invoke({
            url: `/api/v1/reviews/product/${id}`,
            method: 'GET',
          }),
        { data: { items: [], total: 0 } } as any
      );
      const data = res?.data;
      setReviews(data?.items || []);
      setReviewsTotal(data?.total || 0);
    } finally {
      setReviewsLoading(false);
    }
  };

  const loadRating = async () => {
    if (!id) return;
    // Use quiet retry - rating display is non-critical
    const res = await withRetryQuiet(
      () =>
        client.apiCall.invoke({
          url: `/api/v1/reviews/rating/${id}`,
          method: 'GET',
        }),
      { data: { average_rating: 0, review_count: 0 } } as any
    );
    const data = res?.data;
    setAvgRating(data?.average_rating || 0);
    setReviewCount(data?.review_count || 0);
  };

  const loadCartCount = async () => {
    try {
      const user = await withRetry(() => client.auth.me());
      if (user?.data) {
        const res = await withRetry(() => client.entities.cart_items.query({ query: {} }));
        const items = res?.data?.items || [];
        setCartCount(items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0));
      }
    } catch {
      // Not logged in
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;
    setAdding(true);
    try {
      const user = await withRetry(() => client.auth.me());
      if (!user?.data) {
        toast.error('Please sign in to add items to cart');
        await client.auth.toLogin();
        return;
      }
      const cartRes = await withRetry(() =>
        client.entities.cart_items.query({ query: { product_id: product.id } })
      );
      const existing = cartRes?.data?.items?.[0];
      if (existing) {
        await withRetry(() =>
          client.entities.cart_items.update({
            id: existing.id,
            data: { quantity: (existing.quantity || 0) + quantity },
          })
        );
      } else {
        await withRetry(() =>
          client.entities.cart_items.create({
            data: { product_id: product.id, quantity },
          })
        );
      }
      toast.success(`Added ${quantity} item(s) to cart!`);
      loadCartCount();
    } catch (err) {
      console.error('Failed to add to cart:', err);
      toast.error('Failed to add to cart. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const handleSubmitReview = async () => {
    if (newRating === 0) {
      toast.error('Please select a star rating');
      return;
    }
    if (!isLoggedIn) {
      toast.error('Please sign in to leave a review');
      await client.auth.toLogin();
      return;
    }
    setSubmittingReview(true);
    try {
      await withRetry(() =>
        client.entities.reviews.create({
          data: {
            product_id: Number(id),
            rating: newRating,
            review_text: newReviewText.trim() || null,
            reviewer_name: newReviewerName.trim() || 'Anonymous',
            created_at: new Date().toISOString(),
          },
        })
      );
      toast.success('Review submitted successfully!');
      setNewRating(0);
      setNewReviewText('');
      setNewReviewerName('');
      // Reload reviews and rating
      loadReviews();
      loadRating();
    } catch (err) {
      console.error('Failed to submit review:', err);
      toast.error('Failed to submit review. Please try again.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Header cartCount={cartCount} />
        <div className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-slate-800/50 rounded-xl aspect-square animate-pulse" />
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded h-8 w-3/4 animate-pulse" />
              <div className="bg-slate-800/50 rounded h-6 w-1/2 animate-pulse" />
              <div className="bg-slate-800/50 rounded h-24 w-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Header cartCount={cartCount} />
        <div className="container mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-bold mb-4">Product Not Found</h2>
          <Button onClick={() => navigate('/products')} className="bg-blue-600 hover:bg-blue-500 text-white">
            Back to Products
          </Button>
        </div>
      </div>
    );
  }

  const condInfo = conditionLabels[product.condition] || conditionLabels.used;
  const isOutOfStock = product.stock !== undefined && product.stock <= 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header cartCount={cartCount} />

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-8">
          <Link to="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link to="/products" className="hover:text-white transition-colors">Products</Link>
          <span>/</span>
          <span className="text-slate-200 truncate max-w-[200px]">{product.title}</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Product Image */}
          <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
            <img
              src={resolvedImageSrc}
              alt={product.title}
              className="w-full aspect-square object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = defaultImage;
              }}
            />
            {isOutOfStock && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white font-bold text-2xl">Out of Stock</span>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge className={`border ${condInfo.color}`}>{condInfo.label}</Badge>
                <Badge className="bg-slate-700/50 text-slate-300 border-slate-600 capitalize">
                  <Tag className="h-3 w-3 mr-1" />
                  {product.category}
                </Badge>
              </div>
              <h1 className="text-3xl font-bold">{product.title}</h1>
            </div>

            {/* Average Rating */}
            {reviewCount > 0 && (
              <div className="flex items-center gap-3">
                <StarRatingDisplay rating={avgRating} size="md" />
                <span className="text-lg font-semibold text-amber-400">{avgRating.toFixed(1)}</span>
                <span className="text-sm text-slate-400">({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})</span>
              </div>
            )}

            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-emerald-400">AED {product.price.toFixed(2)}</span>
            </div>

            <Separator className="bg-slate-800" />

            {product.description && (
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-1">
                  <Info className="h-4 w-4" />
                  Description
                </h3>
                <p className="text-slate-400 leading-relaxed">{product.description}</p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-slate-400" />
                <span className="text-slate-400">Stock:</span>
                <span className={`font-medium ${isOutOfStock ? 'text-red-400' : 'text-emerald-400'}`}>
                  {isOutOfStock ? 'Out of Stock' : `${product.stock ?? 'Available'} units`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-slate-400" />
                <span className="text-slate-400">Status:</span>
                <span className="font-medium text-emerald-400 capitalize">{product.status}</span>
              </div>
            </div>

            <Separator className="bg-slate-800" />

            {/* Quantity & Add to Cart */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-300">Quantity:</span>
                <div className="flex items-center border border-slate-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                  >
                    -
                  </button>
                  <span className="px-4 py-2 bg-slate-900 text-white min-w-[3rem] text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  size="lg"
                  disabled={isOutOfStock || adding}
                  onClick={handleAddToCart}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 h-12 text-base"
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  {adding ? 'Adding...' : isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  disabled={savingItem}
                  onClick={handleToggleSave}
                  className={`h-12 w-12 p-0 shrink-0 border-slate-700 ${
                    isSaved
                      ? 'bg-pink-500/15 border-pink-500/30 text-pink-400 hover:bg-pink-500/25 hover:text-pink-300'
                      : 'text-slate-400 hover:text-pink-400 hover:bg-slate-800 hover:border-pink-500/30'
                  }`}
                >
                  <Heart className={`h-5 w-5 ${isSaved ? 'fill-pink-400' : ''}`} />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-16">
          <Separator className="bg-slate-800 mb-12" />

          <div className="grid lg:grid-cols-3 gap-12">
            {/* Write a Review */}
            <div className="lg:col-span-1">
              <div className="sticky top-8">
                <h2 className="text-xl font-bold mb-6">Write a Review</h2>
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-5">
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">Your Rating *</label>
                    <StarRatingInput value={newRating} onChange={setNewRating} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">Display Name</label>
                    <Input
                      placeholder="Anonymous"
                      value={newReviewerName}
                      onChange={(e) => setNewReviewerName(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">Your Review</label>
                    <Textarea
                      placeholder="Share your experience with this product..."
                      value={newReviewText}
                      onChange={(e) => setNewReviewText(e.target.value)}
                      rows={4}
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 resize-none"
                    />
                  </div>
                  <Button
                    onClick={handleSubmitReview}
                    disabled={submittingReview || newRating === 0}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </Button>
                  {!isLoggedIn && (
                    <p className="text-xs text-slate-500 text-center">
                      You need to{' '}
                      <button
                        onClick={() => client.auth.toLogin()}
                        className="text-blue-400 hover:text-blue-300 underline"
                      >
                        sign in
                      </button>{' '}
                      to leave a review.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Reviews List */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  Customer Reviews
                  {reviewCount > 0 && (
                    <span className="text-slate-400 font-normal text-base ml-2">({reviewCount})</span>
                  )}
                </h2>
                {reviewCount > 0 && (
                  <div className="flex items-center gap-2">
                    <StarRatingDisplay rating={avgRating} size="sm" />
                    <span className="text-sm font-semibold text-amber-400">{avgRating.toFixed(1)} avg</span>
                  </div>
                )}
              </div>

              {reviewsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-slate-800/50 rounded-xl h-28 animate-pulse" />
                  ))}
                </div>
              ) : reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-slate-900/30 rounded-xl border border-slate-800/50">
                  <Star className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg font-medium">No reviews yet</p>
                  <p className="text-slate-500 text-sm mt-1">Be the first to review this product!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}