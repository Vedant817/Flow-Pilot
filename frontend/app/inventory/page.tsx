'use client'
import { useState, useCallback, useMemo, memo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, BarChart2, DollarSign, Package, Edit, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import axios from 'axios'
import AddProductPopup from '@/components/AddProductDialog'
import EditProductPopup from '@/components/EditProductDialog'

interface InventoryItem {
  _id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  warehouse_location: string;
  stock_alert_level: number;
}

const TableHeader = memo(() => (
  <thead className="bg-[#1A1A1A] sticky top-0">
    <tr>
      <th className="px-4 py-3 text-left">Serial No.</th>
      <th className="px-4 py-3 text-left">Name</th>
      <th className="px-4 py-3 text-left">Category</th>
      <th className="px-4 py-3 text-left">Price</th>
      <th className="px-4 py-3 text-left">Quantity</th>
      <th className="px-4 py-3 text-left">Stock Alert Level</th>
      <th className="px-4 py-3 text-left">Warehouse</th>
      <th className="px-4 py-3 text-left">Actions</th>
    </tr>
  </thead>
));
TableHeader.displayName = 'TableHeader';

interface ActionButtonProps {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  danger?: boolean;
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

const ActionButton = memo(({ label, icon, onClick, primary, danger }: ActionButtonProps) => {
  const baseClasses = "flex items-center gap-1 px-4 py-2 rounded-lg transition-colors duration-200";
  let colorClasses = "bg-[#1A1A1A] text-white hover:bg-[#00E676] hover:text-black";
  if (primary) colorClasses = "bg-[#00E676] text-black hover:bg-[#00ff84]";
  if (danger) colorClasses = "bg-[#1A1A1A] text-white hover:bg-[#ff3333] hover:text-white";

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${colorClasses}`}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {label}
    </button>
  );
});
ActionButton.displayName = 'ActionButton';

const InventoryRow = memo(({ item, index, onEdit, onDelete }: InventoryRowProps) => {
  const handleEdit = useCallback(() => onEdit(item._id), [item._id, onEdit]);
  const handleDelete = useCallback(() => onDelete(item._id), [item._id, onDelete]);

  const isLowStock = item.quantity <= item.stock_alert_level;

  return (
    <tr className="border-b border-[#333] hover:bg-[#1A1A1A] transition-colors">
      <td className="px-4 py-3">{index + 1}</td>
      <td className="px-4 py-3">{item.name}</td>
      <td className="px-4 py-3">{item.category}</td>
      <td className="px-4 py-3">${item.price.toFixed(2)}</td>
      <td className="px-4 py-3">
        <span className={`${isLowStock ? 'text-red-500' : 'text-[#00E676]'} font-medium`}>
          {item.quantity}
        </span>
      </td>
      <td className="px-4 py-3">{item.stock_alert_level}</td>
      <td className="px-4 py-3">{item.warehouse_location}</td>
      <td className="px-4 py-3 flex gap-2">
        <button onClick={handleEdit} className="bg-[#00E676] text-black px-3 py-1 rounded-lg hover:bg-[#00C864] transition-colors">
          <Edit size={16} />
        </button>
        <button onClick={handleDelete} className="bg-[#1A1A1A] text-white px-3 py-1 rounded-lg hover:bg-[#ff3333] transition-colors">
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
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
        className={`px-3 py-1 rounded flex items-center ${currentPage === 1 ? 'bg-[#1A1A1A] opacity-50 cursor-not-allowed' : 'bg-[#1A1A1A] hover:bg-[#252525]'}`}
        onClick={handlePrevious}
        disabled={currentPage === 1}
      >
        <ChevronLeft size={16} />
      </button>

      {pageNumbers.map((page, index) => (
        <button
          key={index}
          className={`px-3 py-1 rounded ${page === currentPage ? 'bg-[#00E676] text-black' : page === '...' ? 'bg-transparent cursor-default' : 'bg-[#1A1A1A] hover:bg-[#252525]'}`}
          onClick={() => typeof page === 'number' && onPageChange(page)}
          disabled={page === '...'}
        >
          {page}
        </button>
      ))}

      <button
        className={`px-3 py-1 rounded flex items-center ${currentPage === totalPages ? 'bg-[#1A1A1A] opacity-50 cursor-not-allowed' : 'bg-[#1A1A1A] hover:bg-[#252525]'}`}
        onClick={handleNext}
        disabled={currentPage === totalPages}
      >
        <ChevronRight size={16} />
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
  const itemsPerPage = 10;

  const fetchInventoryData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get<InventoryItem[]>(`${process.env.NEXT_PUBLIC_API_URL}/get-inventory`);
      setInventoryData(response.data);
      setError('');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        console.error('Error fetching inventory data:', err.message);
        setError('Failed to load inventory data. Please try again.');
      } else {
        console.error('Unexpected error:', err);
        setError(`An unexpected error occurred.`);
        console.log(error);
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

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 w-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold">Inventory Management</h1>
        <div className="flex gap-3">
          <ActionButton
            label="Refresh"
            onClick={fetchInventoryData}
            icon={<RefreshCw size={18} />}
          />
          <ActionButton
            label="Add Product"
            primary
            onClick={handleAddProduct}
            icon={<Plus size={18} />}
          />
          <ActionButton
            label="Forecasting"
            onClick={navigateToForecasting}
            icon={<BarChart2 size={18} />}
          />
          <ActionButton
            label="Price Adjustment"
            onClick={navigateToPriceAdjustment}
            icon={<DollarSign size={18} />}
          />
          <ActionButton
            label="DeadStock"
            onClick={navigateToDeadStock}
            icon={<Package size={18} />}
          />
        </div>
      </div>

      <div className="mb-6 relative">
        <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
        <input
          type="text"
          placeholder="Search products by name, category or warehouse..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full max-w-md pl-10 px-4 py-2 rounded-lg bg-[#1A1A1A] border border-[#333] focus:outline-none focus:border-[#00E676]"
        />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[#1A1A1A] p-4 rounded-lg">
          <h3 className="text-gray-400 mb-1">Total Products</h3>
          <p className="text-2xl font-bold">{inventoryData.length}</p>
        </div>
        <div className="bg-[#1A1A1A] p-4 rounded-lg">
          <h3 className="text-gray-400 mb-1">Low Stock Items</h3>
          <p className="text-2xl font-bold text-red-500">
            {inventoryData.filter(item => item.quantity <= item.stock_alert_level).length}
          </p>
        </div>
        <div className="bg-[#1A1A1A] p-4 rounded-lg">
          <h3 className="text-gray-400 mb-1">Total Value</h3>
          <p className="text-2xl font-bold text-[#00E676]">
            Rs. {inventoryData.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-[#1A1A1A] p-4 rounded-lg">
          <h3 className="text-gray-400 mb-1">Categories</h3>
          <p className="text-2xl font-bold">
            {new Set(inventoryData.map(item => item.category)).size}
          </p>
        </div>
      </div>

      <div className="overflow-auto flex-1 rounded-lg border border-[#333]">
        <table className="w-full">
          <TableHeader />
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center">
                  <div className="flex justify-center items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00E676]"></div>
                    <span className="ml-2">Loading inventory data...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedInventory.length > 0 ? (
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
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No products found matching your search criteria
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


      {filteredInventory.length > 0 && (
        <div className="mt-4 flex justify-between items-center">
          <div className="text-gray-400">
            Showing {Math.min(itemsPerPage, paginatedInventory.length)} of {filteredInventory.length} products
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
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