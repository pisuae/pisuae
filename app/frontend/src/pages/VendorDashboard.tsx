import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store, Plus, Pencil, Trash2, Package, DollarSign, Percent,
  TrendingUp, Eye, EyeOff, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { client } from '@/lib/api';

interface Product {
  id: number;
  seller_id?: string;
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

interface Vendor {
  id: number;
  user_id: string;
  business_name: string;
  description?: string;
  commission_rate: number;
  status: string;
  total_sales: number;
  total_earnings: number;
}

const categories = [
  'motherboards', 'storage', 'displays', 'batteries', 'memory',
  'keyboards', 'processors', 'cooling', 'chargers', 'accessories',
];
const conditions = ['new', 'like-new', 'refurbished', 'used'];

const emptyProduct = {
  title: '',
  description: '',
  price: 0,
  category: 'accessories',
  condition: 'new',
  image_url: '',
  stock: 1,
  status: 'active',
};

export default function VendorDashboard() {
  const [user, setUser] = useState<any>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState(emptyProduct);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await client.auth.me();
      if (!res?.data) {
        navigate('/vendor/signup');
        return;
      }
      setUser(res.data);

      // Load vendor profile
      const vendorRes = await client.entities.vendors.query({ query: {} });
      const vendors = vendorRes?.data?.items || [];
      if (vendors.length === 0) {
        navigate('/vendor/signup');
        return;
      }
      setVendor(vendors[0]);

      // Load vendor's products using queryAll to get products where seller_id matches
      const prodRes = await client.entities.products.query({
        query: { seller_id: res.data.id },
        sort: '-created_at',
        limit: 100,
      });
      setProducts(prodRes?.data?.items || []);
    } catch (err) {
      console.error('Failed to load vendor data:', err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    setEditingProduct(null);
    setFormData({ ...emptyProduct });
    setShowForm(true);
  };

  const openEditForm = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      title: product.title,
      description: product.description || '',
      price: product.price,
      category: product.category,
      condition: product.condition,
      image_url: product.image_url || '',
      stock: product.stock || 1,
      status: product.status,
    });
    setShowForm(true);
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || formData.price <= 0) {
      toast.error('Please fill in title and a valid price');
      return;
    }
    setSubmitting(true);
    try {
      if (editingProduct) {
        // Update existing product
        await client.entities.products.update({
          id: editingProduct.id,
          data: {
            title: formData.title.trim(),
            description: formData.description.trim(),
            price: Number(formData.price),
            category: formData.category,
            condition: formData.condition,
            image_url: formData.image_url.trim(),
            stock: Number(formData.stock),
            status: formData.status,
          },
        });
        toast.success('Product updated successfully!');
      } else {
        // Create new product
        await client.entities.products.create({
          data: {
            seller_id: user.id,
            title: formData.title.trim(),
            description: formData.description.trim(),
            price: Number(formData.price),
            category: formData.category,
            condition: formData.condition,
            image_url: formData.image_url.trim(),
            stock: Number(formData.stock),
            status: formData.status,
            created_at: new Date().toISOString(),
          },
        });
        toast.success('Product created successfully!');
      }
      setShowForm(false);
      loadData();
    } catch (err) {
      console.error('Failed to save product:', err);
      toast.error('Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    try {
      await client.entities.products.delete({ id: productId });
      toast.success('Product deleted');
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete product:', err);
      toast.error('Failed to delete product');
    }
  };

  const toggleProductStatus = async (product: Product) => {
    const newStatus = product.status === 'active' ? 'inactive' : 'active';
    try {
      await client.entities.products.update({
        id: product.id,
        data: { status: newStatus },
      });
      toast.success(`Product ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      loadData();
    } catch (err) {
      console.error('Failed to update product status:', err);
      toast.error('Failed to update status');
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

  const activeProducts = products.filter((p) => p.status === 'active').length;
  const totalRevenue = products.reduce((sum, p) => sum + (p.price * (p.stock || 0)), 0);
  const commissionRate = vendor?.commission_rate || 15;
  const netEarnings = vendor?.total_earnings || 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Store className="h-6 w-6 text-blue-400" />
              <h1 className="text-2xl font-bold">{vendor?.business_name}</h1>
              <Badge className={`${vendor?.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {vendor?.status}
              </Badge>
            </div>
            <p className="text-slate-400 text-sm">Vendor Dashboard — Manage your products and track earnings</p>
          </div>
          <Button onClick={openAddForm} className="bg-blue-600 hover:bg-blue-500 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-500/10">
                <Package className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Products</p>
                <p className="text-2xl font-bold text-white">{products.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/10">
                <Eye className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Active Listings</p>
                <p className="text-2xl font-bold text-white">{activeProducts}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-500/10">
                <Percent className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Commission Rate</p>
                <p className="text-2xl font-bold text-white">{commissionRate}%</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-purple-500/10">
                <DollarSign className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Net Earnings</p>
                <p className="text-2xl font-bold text-white">${netEarnings.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Commission Info Banner */}
        <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border border-blue-500/20 rounded-xl p-5 mb-8">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-blue-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-white mb-1">How Commission Works</h3>
              <p className="text-sm text-slate-300">
                PIS UAE charges a <span className="text-amber-400 font-semibold">{commissionRate}%</span> commission on each sale.
                You receive <span className="text-emerald-400 font-semibold">{100 - commissionRate}%</span> of the sale price.
                For example, a product sold at <span className="text-white font-semibold">$100</span> earns you{' '}
                <span className="text-emerald-400 font-semibold">${(100 * (100 - commissionRate) / 100).toFixed(2)}</span>.
              </p>
            </div>
          </div>
        </div>

        {/* Products Table */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-400" />
              Your Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 mb-4">You haven't listed any products yet.</p>
                <Button onClick={openAddForm} className="bg-blue-600 hover:bg-blue-500 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Product
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Product</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Category</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Price</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Your Earning</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Stock</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => {
                      const earning = product.price * (100 - commissionRate) / 100;
                      return (
                        <tr key={product.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {product.image_url ? (
                                <img
                                  src={product.image_url}
                                  alt={product.title}
                                  className="h-10 w-10 rounded-lg object-cover bg-slate-700"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-lg bg-slate-700 flex items-center justify-center">
                                  <Package className="h-5 w-5 text-slate-500" />
                                </div>
                              )}
                              <span className="font-medium text-white text-sm truncate max-w-[200px]">
                                {product.title}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className="bg-slate-700 text-slate-300 capitalize text-xs">
                              {product.category}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-white font-medium">${product.price.toFixed(2)}</td>
                          <td className="py-3 px-4 text-emerald-400 font-medium">${earning.toFixed(2)}</td>
                          <td className="py-3 px-4 text-slate-300">{product.stock ?? 0}</td>
                          <td className="py-3 px-4">
                            <Badge className={`text-xs ${product.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600/20 text-slate-400'}`}>
                              {product.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleProductStatus(product)}
                                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700"
                                title={product.status === 'active' ? 'Deactivate' : 'Activate'}
                              >
                                {product.status === 'active' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditForm(product)}
                                className="h-8 w-8 text-slate-400 hover:text-blue-400 hover:bg-slate-700"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirm(product.id)}
                                className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-slate-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Product Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingProduct ? 'Update your product details.' : 'Fill in the details to list a new product.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitProduct} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Title *</label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Product title"
                className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Product description..."
                className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Price ($) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.price || ''}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Stock *</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.stock || ''}
                  onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                  placeholder="1"
                  className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat} className="hover:bg-slate-700 capitalize">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Condition</label>
                <Select value={formData.condition} onValueChange={(v) => setFormData({ ...formData, condition: v })}>
                  <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    {conditions.map((cond) => (
                      <SelectItem key={cond} value={cond} className="hover:bg-slate-700 capitalize">
                        {cond}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Image URL</label>
              <Input
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://example.com/image.jpg"
                className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
            {formData.price > 0 && (
              <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Sale Price</span>
                  <span className="text-white">${formData.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-400">Platform Fee ({commissionRate}%)</span>
                  <span className="text-red-400">-${(formData.price * commissionRate / 100).toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-700 mt-2 pt-2 flex justify-between">
                  <span className="text-slate-300 font-medium">Your Earning</span>
                  <span className="text-emerald-400 font-bold">
                    ${(formData.price * (100 - commissionRate) / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-500 text-white">
                {submitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Product</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete this product? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)} className="text-slate-400 hover:text-white">
              Cancel
            </Button>
            <Button
              onClick={() => deleteConfirm && handleDeleteProduct(deleteConfirm)}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}