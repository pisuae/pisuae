import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Package, CheckCircle, Tag, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { client } from '@/lib/api';

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

const conditionLabels: Record<string, { label: string; color: string }> = {
  new: { label: 'Brand New', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  'like-new': { label: 'Like New', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  refurbished: { label: 'Refurbished', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  used: { label: 'Used', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
};

const defaultImage = 'https://mgx-backend-cdn.metadl.com/generate/images/1040407/2026-03-18/c1384985-4f46-41a1-af84-fd758bd4107a.png';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    loadProduct();
    loadCartCount();
  }, [id]);

  const loadProduct = async () => {
    if (!id) return;
    try {
      const res = await client.entities.products.get({ id });
      setProduct(res?.data || null);
    } catch (err) {
      console.error('Failed to load product:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCartCount = async () => {
    try {
      const user = await client.auth.me();
      if (user?.data) {
        const res = await client.entities.cart_items.query({ query: {} });
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
      const user = await client.auth.me();
      if (!user?.data) {
        toast.error('Please sign in to add items to cart');
        await client.auth.toLogin();
        return;
      }
      const cartRes = await client.entities.cart_items.query({ query: { product_id: product.id } });
      const existing = cartRes?.data?.items?.[0];
      if (existing) {
        await client.entities.cart_items.update({
          id: existing.id,
          data: { quantity: (existing.quantity || 0) + quantity },
        });
      } else {
        await client.entities.cart_items.create({
          data: { product_id: product.id, quantity },
        });
      }
      toast.success(`Added ${quantity} item(s) to cart!`);
      loadCartCount();
    } catch (err) {
      console.error('Failed to add to cart:', err);
      toast.error('Failed to add to cart');
    } finally {
      setAdding(false);
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
              src={product.image_url || defaultImage}
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

            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-emerald-400">${product.price.toFixed(2)}</span>
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

              <Button
                size="lg"
                disabled={isOutOfStock || adding}
                onClick={handleAddToCart}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 h-12 text-base"
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                {adding ? 'Adding...' : isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}