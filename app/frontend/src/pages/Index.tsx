import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Cpu, HardDrive, Monitor, Battery, MemoryStick, Keyboard, Zap, Shield, Truck, Laptop, Smartphone, Shirt, Sparkles, Gift, ToyBrick, UtensilsCrossed, Sofa, Watch, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import Header from '@/components/Header';
import ProductCard from '@/components/ProductCard';
import { client } from '@/lib/api';
import { withRetry } from '@/lib/retry';

const HERO_IMAGE = 'https://mgx-backend-cdn.metadl.com/generate/images/1040407/2026-03-18/8db7c9fe-7e9e-4248-a343-e5e92c3ed9e4.png';
const REPAIR_IMAGE = 'https://mgx-backend-cdn.metadl.com/generate/images/1040407/2026-03-18/b4f787f3-521f-433a-adbb-011f6bfd6924.png';
const STORE_IMAGE = 'https://mgx-backend-cdn.metadl.com/generate/images/1040407/2026-03-18/d76cb9c0-b3bc-4f6b-b368-0d175b59f0c2.png';

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
}

const categories = [
  { name: 'Clothing', icon: Shirt, color: 'from-fuchsia-500 to-fuchsia-700' },
  { name: 'Makeup', icon: Sparkles, color: 'from-pink-400 to-pink-600' },
  { name: 'Combo', icon: Gift, color: 'from-violet-500 to-violet-700' },
  { name: 'Toys', icon: ToyBrick, color: 'from-orange-500 to-orange-700' },
  { name: 'Kitchen', icon: UtensilsCrossed, color: 'from-teal-500 to-teal-700' },
  { name: 'Furniture', icon: Sofa, color: 'from-stone-500 to-stone-700' },
  { name: 'Smartwatch', icon: Watch, color: 'from-sky-500 to-sky-700' },
  { name: 'Smart Home', icon: Home, color: 'from-green-500 to-green-700' },
  { name: 'Phones', icon: Smartphone, color: 'from-rose-500 to-rose-700' },
  { name: 'Laptops', icon: Laptop, color: 'from-indigo-500 to-indigo-700' },
  { name: 'Motherboards', icon: Cpu, color: 'from-blue-500 to-blue-700' },
  { name: 'Storage', icon: HardDrive, color: 'from-emerald-500 to-emerald-700' },
  { name: 'Displays', icon: Monitor, color: 'from-purple-500 to-purple-700' },
  { name: 'Batteries', icon: Battery, color: 'from-amber-500 to-amber-700' },
  { name: 'Memory', icon: MemoryStick, color: 'from-pink-500 to-pink-700' },
  { name: 'Keyboards', icon: Keyboard, color: 'from-cyan-500 to-cyan-700' },
];

interface RatingInfo {
  average_rating: number;
  review_count: number;
}

export default function Index() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<Record<number, RatingInfo>>({});
  const navigate = useNavigate();

  useEffect(() => {
    // Load products first, then stagger cart count to reduce simultaneous Lambda DNS hits
    loadFeaturedProducts();
    const timer = setTimeout(() => loadCartCount(), 500);
    return () => clearTimeout(timer);
  }, []);

  const loadBulkRatings = async (productIds: number[]) => {
    if (productIds.length === 0) return;
    try {
      const res = await withRetry(() =>
        client.apiCall.invoke({
          url: '/api/v1/reviews/ratings/bulk',
          method: 'GET',
          data: { product_ids: productIds.join(',') },
        })
      );
      const items = res?.data?.ratings || [];
      const map: Record<number, RatingInfo> = {};
      for (const item of items) {
        map[item.product_id] = {
          average_rating: item.average_rating,
          review_count: item.review_count,
        };
      }
      setRatings(map);
    } catch (err) {
      console.error('Failed to load ratings:', err);
    }
  };

  const loadFeaturedProducts = async () => {
    try {
      const res = await withRetry(() =>
        client.entities.products.query({
          query: { status: 'active' },
          limit: 8,
          sort: '-created_at',
        })
      );
      const items = res?.data?.items || [];
      setFeaturedProducts(items);
      const ids = items.map((p: Product) => p.id);
      loadBulkRatings(ids);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
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

  const handleAddToCart = async (productId: number) => {
    try {
      const user = await withRetry(() => client.auth.me());
      if (!user?.data) {
        toast.error('Please sign in to add items to cart');
        await client.auth.toLogin();
        return;
      }
      // Check if already in cart
      const cartRes = await withRetry(() =>
        client.entities.cart_items.query({ query: { product_id: productId } })
      );
      const existing = cartRes?.data?.items?.[0];
      if (existing) {
        await withRetry(() =>
          client.entities.cart_items.update({
            id: existing.id,
            data: { quantity: (existing.quantity || 1) + 1 },
          })
        );
      } else {
        await withRetry(() =>
          client.entities.cart_items.create({
            data: { product_id: productId, quantity: 1 },
          })
        );
      }
      toast.success('Added to cart!');
      loadCartCount();
    } catch (err) {
      console.error('Failed to add to cart:', err);
      toast.error('Failed to add to cart. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header cartCount={cartCount} />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_IMAGE} alt="Tech parts" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
          <div className="absolute inset-0 from-slate-950 via-transparent to-transparent mt-[0px] mr-[0px] mb-[0px] ml-[0px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] rounded-none text-[16px] font-normal text-[#FFFFFF] bg-[#00000000] opacity-100" />
        </div>
        <div className="relative container mx-auto px-4 py-24 md:py-32 mt-[0px] mr-[0px] mb-[0px] ml-[0px] pt-[128px] pr-[16px] pb-[128px] pl-[16px] rounded-none text-[16px] font-normal text-[#FFFFFF] bg-[#00000000] opacity-100">
          <div className="max-w-2xl space-y-6 mt-[0px] mr-[0px] mb-[0px] ml-[0px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] rounded-none text-[16px] font-normal text-[#FFFFFF] bg-[#00000000] opacity-100">
            <div className="inline-flex items-center gap-2 px-4 py-2 border border-blue-500/20 mt-[0px] mr-[0px] mb-[0px] ml-[0px] pt-[8px] pr-[16px] pb-[8px] pl-[16px] rounded-full text-[14px] font-normal text-[#60A5FA] bg-[#3B82F61A] opacity-100">
              <Zap className="h-4 w-4" />
              Your One-Stop Online Marketplace
            </div>
            <h1 className="md:text-6xl mt-[24px] mr-[0px] mb-[0px] ml-[0px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] rounded-none text-[60px] font-bold text-[#FFFFFF] bg-[#00000000] opacity-100">
              Shop{' '}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Everything
              </span>{' '}
              You Need
            </h1>
            <p className="text-lg text-slate-300 max-w-lg">
              From fashion & beauty to smartwatches, smart home devices, electronics, furniture, kitchen essentials, and kids toys — discover quality products at the best prices.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={() => navigate('/products')}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8"
              >
                Shop Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/products')}
                className="border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white"
              >
                Browse Categories
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Bar */}
      <section className="border-y border-slate-800 bg-slate-900/50">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Shield className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">Quality Guaranteed</p>
                <p className="text-xs text-slate-400">All parts tested & verified</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <Truck className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">Fast Shipping</p>
                <p className="text-xs text-slate-400">Free on orders over $50</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                <Zap className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">Best Prices</p>
                <p className="text-xs text-slate-400">Competitive market pricing</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Shop by Category</h2>
          <Link to="/products" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              to={`/products?category=${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
              className="group"
            >
              <Card className="bg-slate-800/50 border-slate-700/50 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1">
                <CardContent className="flex flex-col items-center gap-3 p-6">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${cat.color} group-hover:scale-110 transition-transform`}>
                    <cat.icon className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                    {cat.name}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Featured Products</h2>
          <Link to="/products" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-slate-800/50 rounded-xl h-72 animate-pulse" />
            ))}
          </div>
        ) : featuredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} rating={ratings[product.id]} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <p>No products available yet. Check back soon!</p>
          </div>
        )}
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={STORE_IMAGE} alt="Electronics store" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 to-slate-950/90" />
        </div>
        <div className="relative container mx-auto px-4 py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Upgrade Your Setup?
          </h2>
          <p className="text-slate-300 max-w-md mx-auto mb-8">
            Join thousands of tech enthusiasts finding the best deals on laptop parts and electronics.
          </p>
          <Button
            size="lg"
            onClick={() => navigate('/products')}
            className="bg-blue-600 hover:bg-blue-500 text-white px-10"
          >
            Start Shopping
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-blue-400" />
              <span className="font-bold text-white">PIS UAE</span>
            </div>
            <p className="text-sm text-slate-400">
              © 2026 PIS UAE Marketplace. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}