/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'
import { useState, useCallback, useMemo, memo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Search, 
  Plus, 
  BarChart2, 
  IndianRupee, 
  Package, 
  Edit, 
  Trash2, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Warehouse,
  Tag,
  DollarSign,
  Filter,
  Download,
} from 'lucide-react'
import axios from 'axios'
import AddProductPopup from '@/components/AddProductDialog'
import EditProductPopup from '@/components/EditProductDialog'
import { Card, CardContent } from '@/components/ui/card'

interface InventoryItem {
  _id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  warehouse_location: string;
  stock_alert_level: number;
}

interface ActionButtonProps {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

interface InventoryRowProps {
  item: InventoryItem;
  index: number;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const ActionButton = memo(({ label, icon, onClick, variant = 'secondary', size = 'md' }: ActionButtonProps) => {
  const baseClasses = "inline-flex items-center gap-2 font-medium transition-all duration-200 rounded-lg";
  
  let sizeClasses = "px-4 py-2 text-sm";
  if (size === 'sm') sizeClasses = "px-3 py-1.5 text-xs";
  if (size === 'lg') sizeClasses = "px-6 py-3 text-base";
  
  let variantClasses = "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm hover:shadow-md";
  if (variant === 'primary') {
    variantClasses = "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl";
  }
  if (variant === 'danger') {
    variantClasses = "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:border-red-300";
  }

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses} ${variantClasses}`}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {label}
    </button>
  );
});
ActionButton.displayName = 'ActionButton';

const StatsCard = memo(({ title, value, subtitle, icon, color, trend }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: { value: string; positive: boolean };
}) => (
  <Card className="bg-white border border-slate-200 hover:shadow-lg transition-shadow">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs ${
              trend.positive ? 'text-emerald-600' : 'text-red-600'
            }`}>
              <TrendingUp className={`w-3 h-3 ${trend.positive ? '' : 'rotate-180'}`} />
              {trend.value}
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
));
StatsCard.displayName = 'StatsCard';

const InventoryRow = memo(({ item, onEdit, onDelete }: InventoryRowProps) => {
  const handleEdit = useCallback(() => onEdit(item._id), [item._id, onEdit]);
  const handleDelete = useCallback(() => onDelete(item._id), [item._id, onDelete]);

  const isLowStock = item.quantity <= item.stock_alert_level;

  return (
    <Card className="bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Tag className="w-3 h-3 text-slate-400" />
                    <p className="text-sm text-slate-500">{item.category}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Price</p>
                <p className="font-bold text-slate-900">₹{item.price.toLocaleString()}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-600">Stock</p>
              <div className="flex items-center gap-2">
                <p className={`text-lg font-bold ${isLowStock ? 'text-red-600' : 'text-emerald-600'}`}>
                  {item.quantity}
                </p>
                {isLowStock && <AlertTriangle className="w-4 h-4 text-red-500" />}
              </div>
              <p className="text-xs text-slate-500">Alert: {item.stock_alert_level}</p>
            </div>

            <div className="flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-slate-600">Location</p>
                <p className="text-sm text-slate-900">{item.warehouse_location}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={handleEdit}
                className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center"
                title="Edit Product"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                className="w-8 h-8 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center"
                title="Delete Product"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
InventoryRow.displayName = 'InventoryRow';

const Pagination = memo(({ currentPage, totalPages, onPageChange }: PaginationProps) => {
  const handlePrevious = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  const pageNumbers = useMemo(() => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="flex gap-2 items-center">
      <button
        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
          currentPage === 1 
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
        }`}
        onClick={handlePrevious}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {pageNumbers.map((page, index) => (
        <button
          key={index}
          className={`w-10 h-10 rounded-lg transition-colors ${
            page === currentPage 
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' 
              : page === '...' 
                ? 'bg-transparent cursor-default text-slate-400' 
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
          onClick={() => typeof page === 'number' && onPageChange(page)}
          disabled={page === '...'}
        >
          {page}
        </button>
      ))}

      <button
        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
          currentPage === totalPages 
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
        }`}
        onClick={handleNext}
        disabled={currentPage === totalPages}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
});
Pagination.displayName = 'Pagination';

export default function InventoryPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [isAddProductOpen, setIsAddProductOpen] = useState<boolean>(false);
  const [isEditProductOpen, setIsEditProductOpen] = useState<boolean>(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchInventoryData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get<InventoryItem[]>(`${process.env.NEXT_PUBLIC_API_URL}/inventory`);
      setInventoryData(response.data);
      setError('');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        console.error('Error fetching inventory data:', err.message);
        setError('Failed to load inventory data. Please try again.');
      } else {
        console.error('Unexpected error:', err);
        setError(`An unexpected error occurred.`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventoryData();
  }, [fetchInventoryData]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  }, []);

  const filteredInventory = useMemo(() => {
    if (!searchQuery.trim()) return inventoryData;

    const query = searchQuery.toLowerCase();
    return inventoryData.filter(item =>
      item.name?.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query) ||
      item.warehouse_location?.toLowerCase().includes(query)
    );
  }, [inventoryData, searchQuery]);

  const paginatedInventory = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredInventory.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredInventory, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredInventory.length / itemsPerPage);
  }, [filteredInventory, itemsPerPage]);

  const stats = useMemo(() => {
    const totalValue = inventoryData.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const lowStockItems = inventoryData.filter(item => item.quantity <= item.stock_alert_level);
    const categories = new Set(inventoryData.map(item => item.category)).size;
    
    return {
      totalProducts: inventoryData.length,
      lowStock: lowStockItems.length,
      totalValue,
      categories
    };
  }, [inventoryData]);

  const handlePageChange = useCallback((pageNumber: number) => {
    setCurrentPage(pageNumber);
  }, []);

  const handleAddProduct = useCallback(() => {
    setIsAddProductOpen(true);
  }, []);

  const handleEditProduct = useCallback((id: string) => {
    setSelectedProductId(id);
    setIsEditProductOpen(true);
  }, []);

  const handleProductAdded = useCallback((newProduct: InventoryItem) => {
    setInventoryData(prev => [...prev, newProduct]);
  }, []);

  const handleProductUpdated = useCallback((id: string, updatedData: Partial<InventoryItem>) => {
    setInventoryData(prev =>
      prev.map(item => item._id === id ? { ...item, ...updatedData } : item)
    );
  }, []);

  const handleDeleteProduct = useCallback(async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/delete-inventory/${id}`);
      setInventoryData(prev => prev.filter(item => item._id !== id));
    } catch (err) {
      console.error('Error deleting product:', err);
      setError('Failed to delete product. Please try again.');
    }
  }, []);

  const navigateToForecasting = useCallback(() => {
    router.push('/inventory/forecasting');
  }, [router]);

  const navigateToPriceAdjustment = useCallback(() => {
    router.push('/inventory/priceAdj');
  }, [router]);

  const navigateToDeadStock = useCallback(() => {
    router.push('/inventory/deadstock');
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <Card className="p-12 text-center max-w-md w-full mx-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Package className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Loading Inventory</h2>
          <p className="text-slate-600">Fetching your product data...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Inventory Management</h1>
              <p className="text-slate-600 mt-1">Manage your products, stock levels, and warehouse locations</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ActionButton
                label="Refresh"
                onClick={fetchInventoryData}
                icon={<RefreshCw className="w-4 h-4" />}
              />
              <ActionButton
                label="Add Product"
                variant="primary"
                onClick={handleAddProduct}
                icon={<Plus className="w-4 h-4" />}
              />
              <ActionButton
                label="Forecasting"
                onClick={navigateToForecasting}
                icon={<BarChart2 className="w-4 h-4" />}
              />
              <ActionButton
                label="Price Adjustment"
                onClick={navigateToPriceAdjustment}
                icon={<IndianRupee className="w-4 h-4" />}
              />
              <ActionButton
                label="Dead Stock"
                onClick={navigateToDeadStock}
                icon={<Package className="w-4 h-4" />}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-4">
          <StatsCard
            title="Total Products"
            value={stats.totalProducts}
            icon={<Package className="w-6 h-6 text-white" />}
            color="bg-gradient-to-br from-blue-500 to-blue-600"
          />
          <StatsCard
            title="Low Stock Items"
            value={stats.lowStock}
            subtitle="Requires attention"
            icon={<AlertTriangle className="w-6 h-6 text-white" />}
            color="bg-gradient-to-br from-red-500 to-red-600"
          />
          <StatsCard
            title="Total Value"
            value={`₹${stats.totalValue.toLocaleString()}`}
            icon={<DollarSign className="w-6 h-6 text-white" />}
            color="bg-gradient-to-br from-green-500 to-green-600"
          />
          <StatsCard
            title="Categories"
            value={stats.categories}
            subtitle="Product types"
            icon={<Tag className="w-6 h-6 text-white" />}
            color="bg-gradient-to-br from-purple-500 to-purple-600"
          />
        </div>

        <Card className="mb-4">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search products by name, category, or warehouse location..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2 mb-4">
          {paginatedInventory.length > 0 ? (
            paginatedInventory.map((item, index) => (
              <InventoryRow
                key={item._id}
                index={(currentPage - 1) * itemsPerPage + index}
                item={item}
                onEdit={handleEditProduct}
                onDelete={handleDeleteProduct}
              />
            ))
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Products Found</h3>
                <p className="text-slate-600 mb-6">
                  {searchQuery ? 'No products match your search criteria' : 'Get started by adding your first product'}
                </p>
                <ActionButton
                  label="Add Product"
                  variant="primary"
                  onClick={handleAddProduct}
                  icon={<Plus className="w-4 h-4" />}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {filteredInventory.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-sm text-slate-600">
                  Showing {Math.min(itemsPerPage, paginatedInventory.length)} of {filteredInventory.length} products
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AddProductPopup
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onProductAdded={handleProductAdded}
      />

      <EditProductPopup
        isOpen={isEditProductOpen}
        onClose={() => setIsEditProductOpen(false)}
        productId={selectedProductId}
        onProductUpdated={handleProductUpdated}
      />
    </div>
  )
}