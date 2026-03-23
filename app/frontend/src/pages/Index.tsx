import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Cpu, HardDrive, Monitor, Battery, MemoryStick, Keyboard, Zap, Shield, Truck, Laptop, Smartphone, Shirt, Sparkles, Gift, ToyBrick, UtensilsCrossed, Sofa, Watch, Home, User, ChevronUp, Grid3X3, Star, Tag, Search, X, Clock, Trash2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import Header from '@/components/Header';
import ProductCard from '@/components/ProductCard';
import { client } from '@/lib/api';
import { withRetry, withRetryQuiet } from '@/lib/retry';

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
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [showJumpNav, setShowJumpNav] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<{ id: number; query: string }[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<{ query: string; search_count: number }[]>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const sections = [
    { id: 'features', label: 'Features', icon: Shield },
    { id: 'categories', label: 'Categories', icon: Grid3X3 },
    { id: 'featured-products', label: 'Featured', icon: Star },
    { id: 'deals', label: 'Deals', icon: Tag },
  ];

  useEffect(() => {
    // Load products first, then stagger other calls to reduce simultaneous Lambda DNS hits
    loadFeaturedProducts();
    checkAuth();
    const timer = setTimeout(() => loadCartCount(), 800);
    return () => clearTimeout(timer);
  }, []);

  // Close recent searches dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowRecentSearches(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      // Show jump nav after scrolling past hero
      setShowJumpNav(window.scrollY > 400);

      // Determine active section
      const offsets = sections.map(({ id }) => {
        const el = document.getElementById(id);
        if (!el) return { id, top: Infinity };
        return { id, top: Math.abs(el.getBoundingClientRect().top - 100) };
      });
      const closest = offsets.reduce((a, b) => (a.top < b.top ? a : b));
      setActiveSection(closest.id);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadRecentSearches = useCallback(async () => {
    try {
      const u = await withRetryQuiet(() => client.auth.me(), null);
      if (!u?.data) return;
      const res = await withRetryQuiet(
        () =>
          client.entities.search_histories.query({
            query: {},
            sort: '-searched_at',
            limit: 8,
          }),
        { data: { items: [] } } as any
      );
      const items = res?.data?.items || [];
      // Deduplicate by query text (keep most recent)
      const seen = new Set<string>();
      const unique: { id: number; query: string }[] = [];
      for (const item of items) {
        const q = (item.query || '').toLowerCase().trim();
        if (q && !seen.has(q)) {
          seen.add(q);
          unique.push({ id: item.id, query: item.query });
        }
      }
      setRecentSearches(unique.slice(0, 6));
    } catch {
      // Silently fail
    }
  }, []);

  const loadTrendingSearches = useCallback(async () => {
    try {
      const res = await withRetryQuiet(
        () =>
          client.apiCall.invoke({
            url: '/api/v1/trending-searches',
            method: 'GET',
            data: { limit: 8 },
          }),
        { data: { items: [] } } as any
      );
      const items = res?.data?.items || [];
      setTrendingSearches(items);
    } catch {
      // Silently fail
    }
  }, []);

  // Load recent searches and trending searches when search bar opens
  useEffect(() => {
    if (searchOpen) {
      setShowRecentSearches(true);
      loadRecentSearches();
      loadTrendingSearches();
    } else {
      setShowRecentSearches(false);
    }
  }, [searchOpen, loadRecentSearches, loadTrendingSearches]);

  const saveSearchQuery = async (query: string) => {
    try {
      const u = await withRetryQuiet(() => client.auth.me(), null);
      if (!u?.data) return;
      await withRetryQuiet(
        () =>
          client.entities.search_histories.create({
            data: {
              query,
              searched_at: new Date().toISOString(),
            },
          }),
        null
      );
    } catch {
      // Silently fail - don't block search
    }
  };

  const deleteSearchHistoryItem = async (id: number) => {
    try {
      await withRetryQuiet(
        () => client.entities.search_histories.delete({ id: String(id) }),
        null
      );
      setRecentSearches((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // Silently fail
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      saveSearchQuery(q);
      navigate(`/products?search=${encodeURIComponent(q)}`);
      setSearchQuery('');
      setSearchOpen(false);
      setShowRecentSearches(false);
    }
  };

  const handleRecentSearchClick = (query: string) => {
    saveSearchQuery(query);
    navigate(`/products?search=${encodeURIComponent(query)}`);
    setSearchQuery('');
    setSearchOpen(false);
    setShowRecentSearches(false);
  };

  const checkAuth = async () => {
    try {
      const res = await withRetry(() => client.auth.me());
      if (res?.data) {
        setUser(res.data);
      }
    } catch {
      // Not logged in
    } finally {
      setAuthChecked(true);
    }
  };

  const handleSignUp = async () => {
    await client.auth.toLogin();
  };

  const loadBulkRatings = async (productIds: number[]) => {
    if (productIds.length === 0) return;
    // Stagger ratings call significantly to avoid simultaneous Lambda DNS resolution issues
    await new Promise((r) => setTimeout(r, 1200));
    // Use quiet retry - ratings are non-critical UI enhancement
    // The global request queue in retry.ts will serialize this with other in-flight requests
    const res = await withRetryQuiet(
      () =>
        client.apiCall.invoke({
          url: '/api/v1/reviews/ratings/bulk',
          method: 'GET',
          data: { product_ids: productIds.join(',') },
        }),
      { data: { ratings: [] } } as any
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

      {/* Section Jump Navigation Bar */}
      <nav className="sticky top-16 z-40 bg-slate-900/95 backdrop-blur-md border-y border-slate-700/50 shadow-lg shadow-black/20">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-12 gap-2">
            {/* Section jump links - hidden when search is open on mobile */}
            <div className={`flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-hide ${searchOpen ? 'hidden sm:flex' : 'flex'}`}>
              {sections.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => scrollToSection(id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                    activeSection === id
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Search + Back to Top */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Search bar with recent searches */}
              <div ref={searchContainerRef} className="relative">
                <form
                  onSubmit={handleSearch}
                  className={`flex items-center transition-all duration-300 overflow-hidden ${
                    searchOpen
                      ? 'w-48 sm:w-56 bg-slate-800 border border-slate-600 rounded-full px-3'
                      : 'w-0 sm:w-0'
                  }`}
                >
                  <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setShowRecentSearches(true)}
                    placeholder="Search products..."
                    className="bg-transparent border-none outline-none text-xs sm:text-sm text-white placeholder-slate-500 w-full px-2 py-1.5"
                    autoFocus={searchOpen}
                  />
                  <button
                    type="button"
                    onClick={() => { setSearchOpen(false); setSearchQuery(''); setShowRecentSearches(false); }}
                    className="text-slate-400 hover:text-white shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </form>

                {/* Search Dropdown: Recent + Trending */}
                {searchOpen && showRecentSearches && (recentSearches.length > 0 || trendingSearches.length > 0) && (
                  <div className="absolute top-full right-0 mt-2 w-72 sm:w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 max-h-[360px] overflow-y-auto">
                    {/* Recent Searches */}
                    {recentSearches.length > 0 && (
                      <>
                        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
                          <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            Recent Searches
                          </span>
                        </div>
                        <div className="p-2 flex flex-wrap gap-1.5">
                          {recentSearches.map((item) => (
                            <div
                              key={item.id}
                              className="group flex items-center gap-1 bg-slate-700/60 hover:bg-blue-600/30 border border-slate-600/50 hover:border-blue-500/50 rounded-full pl-3 pr-1.5 py-1 cursor-pointer transition-all duration-200"
                            >
                              <button
                                type="button"
                                onClick={() => handleRecentSearchClick(item.query)}
                                className="text-xs text-slate-300 group-hover:text-white truncate max-w-[140px]"
                              >
                                {item.query}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSearchHistoryItem(item.id);
                                }}
                                className="text-slate-500 hover:text-red-400 transition-colors p-0.5 rounded-full hover:bg-slate-600/50"
                                aria-label={`Remove ${item.query}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Trending Searches */}
                    {trendingSearches.length > 0 && (
                      <>
                        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 border-t border-t-slate-700/30">
                          <span className="text-xs font-medium text-orange-400 flex items-center gap-1.5">
                            <TrendingUp className="h-3 w-3" />
                            Trending Searches
                          </span>
                        </div>
                        <div className="p-2 flex flex-wrap gap-1.5">
                          {trendingSearches.map((item, idx) => (
                            <button
                              key={`trending-${idx}`}
                              type="button"
                              onClick={() => handleRecentSearchClick(item.query)}
                              className="flex items-center gap-1.5 bg-orange-500/10 hover:bg-orange-500/25 border border-orange-500/20 hover:border-orange-500/40 rounded-full px-3 py-1 cursor-pointer transition-all duration-200"
                            >
                              <span className="text-[10px] font-bold text-orange-400/70 min-w-[14px]">
                                {idx + 1}
                              </span>
                              <span className="text-xs text-slate-300 hover:text-white truncate max-w-[140px]">
                                {item.query}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {item.search_count}
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Search icon toggle */}
              {!searchOpen && (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs sm:text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200"
                  aria-label="Search products"
                >
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">Search</span>
                </button>
              )}

              {/* Divider */}
              <div className="h-5 w-px bg-slate-700 mx-0.5" />

              {/* Back to top */}
              <button
                onClick={scrollToTop}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs sm:text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200 shrink-0"
              >
                <ChevronUp className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Top</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Floating Back to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-500 transition-all duration-300 ${
          showJumpNav ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
        }`}
        aria-label="Back to top"
      >
        <ChevronUp className="h-5 w-5" />
      </button>

      {/* Sign Up / Login Banner for non-authenticated users */}
      {authChecked && !user && (
        <section className="relative overflow-hidden border-b border-blue-500/20">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/30" />
          <div className="relative container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/20 border border-blue-500/30">
                  <User className="h-7 w-7 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">New here? Create your account!</h3>
                  <p className="text-slate-300 text-sm mt-1">
                    Sign up to start shopping, track orders, and get exclusive deals.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSignUp}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-8 font-semibold shadow-lg shadow-blue-500/25"
                >
                  <User className="h-4 w-4 mr-2" />
                  Sign Up Free
                </Button>
                <Button
                  onClick={handleSignUp}
                  size="lg"
                  variant="outline"
                  className="border-slate-500 text-slate-200 hover:bg-slate-800 hover:text-white px-8"
                >
                  Sign In
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Features Bar */}
      <section id="features" className="border-y border-slate-800 bg-slate-900/50 scroll-mt-28">
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
      <section id="categories" className="container mx-auto px-4 py-16 scroll-mt-28">
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
      <section id="featured-products" className="container mx-auto px-4 py-16 scroll-mt-28">
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
      <section id="deals" className="relative overflow-hidden scroll-mt-28">
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