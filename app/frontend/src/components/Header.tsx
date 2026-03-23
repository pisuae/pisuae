import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, LogOut, Search, Cpu, Package, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { client } from '@/lib/api';
import { withRetry, withRetryQuiet } from '@/lib/retry';

interface HeaderProps {
  cartCount?: number;
  onSearch?: (query: string) => void;
}

export default function Header({ cartCount = 0, onSearch }: HeaderProps) {
  const [user, setUser] = useState<any>(null);
  const [isVendor, setIsVendor] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const res = await withRetry(() => client.auth.me());
        if (cancelled) return;
        if (res?.data) {
          setUser(res.data);
          // Stagger the vendor check to avoid simultaneous Lambda cold-start DNS issues
          await new Promise((r) => setTimeout(r, 300));
          if (cancelled) return;
          // Use quiet retry for vendor check - it's non-critical UI state
          const vendorRes = await withRetryQuiet(
            () => client.entities.vendors.query({ query: {} }),
            { data: { items: [] } } as any
          );
          if (cancelled) return;
          const vendors = vendorRes?.data?.items || [];
          setIsVendor(vendors.length > 0 && vendors[0].status === 'active');
        }
      } catch {
        if (!cancelled) setUser(null);
      }
    };
    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async () => {
    await client.auth.toLogin();
  };

  const handleLogout = async () => {
    await client.auth.logout();
    setUser(null);
    setIsVendor(false);
    navigate('/');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    } else {
      navigate(`/products?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-700/50 bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-slate-900/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center group-hover:bg-blue-500 transition-colors mt-[0px] mr-[0px] mb-[0px] ml-[0px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] rounded-lg text-[16px] font-normal text-[#FFFFFF] bg-[#3B82F6] opacity-100">
            <Cpu className="h-5 w-5 [object SVGAnimatedString] mt-[0px] mr-[0px] mb-[0px] ml-[0px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] rounded-lg text-[16px] font-normal text-[#FFFFFF] bg-[#00000000] opacity-100" />
          </div>
          <span className="hidden sm:inline mt-[0px] mr-[0px] mb-[0px] ml-[0px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] rounded-none text-[20px] font-bold text-[#FFFFFF] bg-[#00000000] opacity-100">
            PIS UAE
          </span>
        </Link>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search parts & electronics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20"
            />
          </div>
        </form>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <Link to="/products">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800">
              <Package className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline mt-[0px] mr-[0px] mb-[0px] ml-[0px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] rounded-none text-[14px] font-medium text-center text-[#FFFFFF] bg-[#00000000] opacity-100">Products</span>
            </Button>
          </Link>

          {/* Sell on PIS UAE / Vendor Dashboard */}
          {isVendor ? (
            <Link to="/vendor/dashboard">
              <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 hover:bg-slate-800">
                <Store className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            </Link>
          ) : (
            <Link to="/vendor/signup">
              <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300 hover:bg-slate-800">
                <Store className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Sell</span>
              </Button>
            </Link>
          )}

          <Link to="/cart" className="relative">
            <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white hover:bg-slate-800">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-blue-600 hover:bg-blue-600 text-white">
                  {cartCount}
                </Badge>
              )}
            </Button>
          </Link>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white hover:bg-slate-800">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 text-white">
                <DropdownMenuItem onClick={() => navigate('/profile')} className="hover:bg-slate-700 cursor-pointer">
                  <User className="h-4 w-4 mr-2" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/orders')} className="hover:bg-slate-700 cursor-pointer">
                  <Package className="h-4 w-4 mr-2" />
                  My Orders
                </DropdownMenuItem>
                {isVendor ? (
                  <DropdownMenuItem onClick={() => navigate('/vendor/dashboard')} className="hover:bg-slate-700 cursor-pointer">
                    <Store className="h-4 w-4 mr-2" />
                    Vendor Dashboard
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => navigate('/vendor/signup')} className="hover:bg-slate-700 cursor-pointer">
                    <Store className="h-4 w-4 mr-2" />
                    Become a Vendor
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem onClick={handleLogout} className="hover:bg-slate-700 cursor-pointer text-red-400">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={handleLogin} size="sm" className="bg-blue-600 hover:bg-blue-500 text-white">
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}