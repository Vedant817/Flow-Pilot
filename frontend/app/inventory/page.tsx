'use client'
import { useState, useCallback, useMemo, memo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, BarChart2, DollarSign, Package, Edit, Trash2, RefreshCw } from 'lucide-react'

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  reorderPoint: number;
  supplier: string;
  lastRestocked: string;
}

const TableHeader = memo(() => (
  <thead className="bg-[#1A1A1A] sticky top-0">
    <tr>
      <th className="px-4 py-3 text-left">Product ID</th>
      <th className="px-4 py-3 text-left">Name</th>
      <th className="px-4 py-3 text-left">Category</th>
      <th className="px-4 py-3 text-left">Price</th>
      <th className="px-4 py-3 text-left">Quantity</th>
      <th className="px-4 py-3 text-left">Reorder Point</th>
      <th className="px-4 py-3 text-left">Supplier</th>
      <th className="px-4 py-3 text-left">Last Restocked</th>
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
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onRestock: (id: string) => void;
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

const InventoryRow = memo(({ item, onEdit, onDelete, onRestock }: InventoryRowProps) => {
  const handleEdit = useCallback(() => onEdit(item.id), [item.id, onEdit]);
  const handleDelete = useCallback(() => onDelete(item.id), [item.id, onDelete]);
  const handleRestock = useCallback(() => onRestock(item.id), [item.id, onRestock]);

  const isLowStock = item.quantity <= item.reorderPoint;

  return (
    <tr className="border-b border-[#333] hover:bg-[#1A1A1A] transition-colors">
      <td className="px-4 py-3">{item.id}</td>
      <td className="px-4 py-3">{item.name}</td>
      <td className="px-4 py-3">{item.category}</td>
      <td className="px-4 py-3">${item.price.toFixed(2)}</td>
      <td className="px-4 py-3">
        <span className={`${isLowStock ? 'text-red-500' : 'text-[#00E676]'} font-medium`}>
          {item.quantity}
        </span>
      </td>
      <td className="px-4 py-3">{item.reorderPoint}</td>
      <td className="px-4 py-3">{item.supplier}</td>
      <td className="px-4 py-3">{item.lastRestocked}</td>
      <td className="px-4 py-3 flex gap-2">
        <button onClick={handleEdit} className="bg-[#00E676] text-black px-3 py-1 rounded-lg hover:bg-[#00C864] transition-colors">
          <Edit size={16} />
        </button>
        <button onClick={handleDelete} className="bg-[#1A1A1A] text-white px-3 py-1 rounded-lg hover:bg-[#ff3333] transition-colors">
          <Trash2 size={16} />
        </button>
        <button onClick={handleRestock} className="bg-[#007F4F] text-white px-3 py-1 rounded-lg hover:bg-[#00A86B] transition-colors">
          <RefreshCw size={16} />
        </button>
      </td>
    </tr>
  );
});
InventoryRow.displayName = 'InventoryRow';

export default function InventoryPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([
    { id: 'PROD001', name: 'Premium Laptop', category: 'Electronics', price: 1299.99, quantity: 50, reorderPoint: 10, supplier: 'TechCorp', lastRestocked: '2024-01-15' },
    { id: 'PROD002', name: 'Wireless Earbuds', category: 'Electronics', price: 149.99, quantity: 200, reorderPoint: 30, supplier: 'AudioTech', lastRestocked: '2024-02-01' },
    { id: 'PROD003', name: 'Smart Watch', category: 'Wearables', price: 299.99, quantity: 8, reorderPoint: 15, supplier: 'TechCorp', lastRestocked: '2024-02-10' },
    { id: 'PROD004', name: 'Bluetooth Speaker', category: 'Audio', price: 79.99, quantity: 120, reorderPoint: 25, supplier: 'AudioTech', lastRestocked: '2024-01-25' },
    { id: 'PROD005', name: 'Gaming Mouse', category: 'Peripherals', price: 59.99, quantity: 35, reorderPoint: 20, supplier: 'GamerGear', lastRestocked: '2024-02-15' },
  ]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const filteredInventory = useMemo(() => {
    if (!searchQuery.trim()) return inventoryData;

    const query = searchQuery.toLowerCase();
    return inventoryData.filter(item =>
      item.id.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.supplier.toLowerCase().includes(query)
    );
  }, [inventoryData, searchQuery]);

  const handleAddProduct = useCallback(() => {
    console.log('Add product clicked');
  }, []);

  const handleEditProduct = useCallback((id: string) => {
    console.log(`Edit product with ID: ${id}`);
  }, []);

  const handleDeleteProduct = useCallback((id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      setInventoryData(prev => prev.filter(item => item.id !== id));
    }
  }, []);

  const handleRestockProduct = useCallback((id: string) => {
    console.log(`Restock product with ID: ${id}`);
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
            label="+ Add Product"
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
          placeholder="Search products by ID, name, category or supplier..."
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
            {inventoryData.filter(item => item.quantity <= item.reorderPoint).length}
          </p>
        </div>
        <div className="bg-[#1A1A1A] p-4 rounded-lg">
          <h3 className="text-gray-400 mb-1">Total Value</h3>
          <p className="text-2xl font-bold text-[#00E676]">
            ${inventoryData.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
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
            {filteredInventory.length > 0 ? (
              filteredInventory.map((item) => (
                <InventoryRow
                  key={item.id}
                  item={item}
                  onEdit={handleEditProduct}
                  onDelete={handleDeleteProduct}
                  onRestock={handleRestockProduct}
                />
              ))
            ) : (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
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
            Showing {filteredInventory.length} of {inventoryData.length} products
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-[#1A1A1A] rounded hover:bg-[#252525] disabled:opacity-50" disabled>
              Previous
            </button>
            <button className="px-3 py-1 bg-[#00E676] rounded text-black">1</button>
            <button className="px-3 py-1 bg-[#1A1A1A] rounded hover:bg-[#252525]">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}