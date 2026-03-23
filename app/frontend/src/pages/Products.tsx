import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import Header from '@/components/Header';
import ProductCard from '@/components/ProductCard';
import { client } from '@/lib/api';
import { withRetry, withRetryQuiet } from '@/lib/retry';

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

const allCategories = ['all', 'clothing', 'makeup', 'combo', 'toys', 'kitchen', 'furniture', 'smartwatch', 'smart-home', 'phones', 'laptops', 'motherboards', 'storage', 'displays', 'batteries', 'memory', 'keyboards', 'processors', 'cooling', 'chargers', 'accessories'];
const allConditions = ['all', 'new', 'like-new', 'refurbished', 'used'];
const sortOptions = [
  { value: '-created_at', label: 'Newest First' },
  { value: 'price', label: 'Price: Low to High' },
  { value: '-price', label: 'Price: High to Low' },
  { value: 'title', label: 'Name: A-Z' },
];

interface RatingInfo {
  average_rating: number;
  review_count: number;
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all');
  const [selectedCondition, setSelectedCondition] = useState('all');
  const [sortBy, setSortBy] = useState('-created_at');
  const [showFilters, setShowFilters] = useState(false);
  const [ratings, setRatings] = useState<Record<number, RatingInfo>>({});

  useEffect(() => {
    loadProducts();
  }, [selectedCategory, selectedCondition, sortBy]);

  useEffect(() => {
    // Stagger cart count to avoid simultaneous Lambda DNS resolution issues
    const timer = setTimeout(() => loadCartCount(), 600);
    return () => clearTimeout(timer);
  }, []);

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

  const loadProducts = async () => {
    setLoading(true);
    try {
      const query: Record<string, any> = { status: 'active' };
      if (selectedCategory !== 'all') {
        query.category = selectedCategory;
      }
      if (selectedCondition !== 'all') {
        query.condition = selectedCondition;
      }
      const res = await withRetry(() =>
        client.entities.products.query({
          query,
          sort: sortBy,
          limit: 50,
        })
      );
      let items = res?.data?.items || [];
      // Client-side search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        items = items.filter(
          (p: Product) =>
            p.title.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q)) ||
            p.category.toLowerCase().includes(q)
        );
      }
      setProducts(items);
      // Load ratings for all products
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadProducts();
  };

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedCondition('all');
    setSearchQuery('');
    setSortBy('-created_at');
    setSearchParams({});
  };

  const hasActiveFilters = selectedCategory !== 'all' || selectedCondition !== 'all' || searchQuery.trim() !== '';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header cartCount={cartCount} onSearch={(q) => { setSearchQuery(q); }} />

      <div className="container mx-auto px-4 py-8">
        {/* Page Title & Controls */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">All Products</h1>
            <p className="text-slate-400 mt-1">
              {loading ? 'Loading...' : `${products.length} products found`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                {sortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="hover:bg-slate-700">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white md:hidden"
            >
              <SlidersHorizontal className="h-4 w-4 mr-1" />
              Filters
            </Button>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar Filters */}
          <aside className={`w-64 shrink-0 space-y-6 ${showFilters ? 'block' : 'hidden'} md:block`}>
            {/* Search */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Search</h3>
              <form onSubmit={handleSearch}>
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-400"
                />
              </form>
            </div>

            {/* Category Filter */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Category</h3>
              <div className="flex flex-wrap gap-2">
                {allCategories.map((cat) => (
                  <Badge
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`cursor-pointer capitalize transition-colors ${
                      selectedCategory === cat
                        ? 'bg-blue-600 text-white hover:bg-blue-500'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border-slate-700'
                    }`}
                  >
                    {cat === 'all' ? 'All' : cat}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Condition Filter */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Condition</h3>
              <div className="flex flex-wrap gap-2">
                {allConditions.map((cond) => (
                  <Badge
                    key={cond}
                    onClick={() => setSelectedCondition(cond)}
                    className={`cursor-pointer capitalize transition-colors ${
                      selectedCondition === cond
                        ? 'bg-blue-600 text-white hover:bg-blue-500'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border-slate-700'
                    }`}
                  >
                    {cond === 'all' ? 'All' : cond}
                  </Badge>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-slate-400 hover:text-white w-full"
              >
                <X className="h-4 w-4 mr-1" />
                Clear All Filters
              </Button>
            )}
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-xl h-72 animate-pulse" />
                ))}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} rating={ratings[product.id]} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-slate-400 text-lg">No products found matching your criteria.</p>
                <Button onClick={clearFilters} variant="link" className="text-blue-400 mt-2">
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}