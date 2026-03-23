import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Tag, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
}

interface ProductCardProps {
  product: Product;
  onAddToCart?: (productId: number) => void;
  rating?: { average_rating: number; review_count: number };
}

const conditionColors: Record<string, string> = {
  new: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'like-new': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  refurbished: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  used: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const defaultImage = 'https://mgx-backend-cdn.metadl.com/generate/images/1040407/2026-03-18/c1384985-4f46-41a1-af84-fd758bd4107a.png';

function StarRating({ rating, count }: { rating: number; count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3 w-3 ${
              star <= Math.round(rating)
                ? 'text-amber-400 fill-amber-400'
                : 'text-slate-600'
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-slate-400">
        {rating.toFixed(1)} ({count})
      </span>
    </div>
  );
}

export default function ProductCard({ product, onAddToCart, rating }: ProductCardProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string>(defaultImage);
  const isOutOfStock = product.stock !== undefined && product.stock <= 0;

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      const url = await resolveImageUrl(product.image_url);
      if (!cancelled) {
        setResolvedSrc(url || defaultImage);
      }
    };
    resolve();
    return () => { cancelled = true; };
  }, [product.image_url]);

  return (
    <Card className="group bg-slate-800/80 border-slate-700/50 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10 overflow-hidden">
      <Link to={`/products/${product.id}`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-900">
          <img
            src={resolvedSrc}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).src = defaultImage;
            }}
          />
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white font-semibold text-lg">Out of Stock</span>
            </div>
          )}
          <Badge className={`absolute top-3 left-3 text-xs border ${conditionColors[product.condition] || conditionColors.used}`}>
            {product.condition}
          </Badge>
        </div>
      </Link>
      <CardContent className="p-4 space-y-3">
        <Link to={`/products/${product.id}`}>
          <h3 className="font-semibold text-white text-sm line-clamp-2 hover:text-blue-400 transition-colors min-h-[2.5rem]">
            {product.title}
          </h3>
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-3 w-3 text-slate-400" />
            <span className="text-xs text-slate-400 capitalize">{product.category}</span>
          </div>
        </div>
        {rating && <StarRating rating={rating.average_rating} count={rating.review_count} />}
        <div className="flex items-center justify-between pt-1">
          <span className="text-lg font-bold text-emerald-400">
            ${product.price.toFixed(2)}
          </span>
          <Button
            size="sm"
            disabled={isOutOfStock}
            onClick={(e) => {
              e.preventDefault();
              onAddToCart?.(product.id);
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 h-8 px-3"
          >
            <ShoppingCart className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}