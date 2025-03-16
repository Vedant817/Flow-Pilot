'use client'
import React, { useState, useCallback, useMemo, memo, useEffect } from 'react'
import { Search} from 'lucide-react'
import axios from 'axios';
import { OrderDetails } from '@/lib/constants/types';

interface Product {
  name: string;
  product?: string;
  quantity: number;
};

const TableHeader = memo(() => (
  <thead className="bg-[#1A1A1A] sticky top-0 z-10">
    <tr>
      <th className="px-4 py-3 text-left">S.No.</th>
      <th className="px-4 py-3 text-left">Order ID ↑</th>
      <th className="px-4 py-3 text-left">Customer Name</th>
      <th className="px-4 py-3 text-left">Status</th>
      <th className="px-4 py-3 text-left">Order Date</th>
      <th className="px-4 py-3 text-left">Products</th>
    </tr>
  </thead>
));
TableHeader.displayName = 'TableHeader';

interface OrderRowProps {
  order: OrderDetails;
  index: number;
  onStatusChange: (orderId: string, newStatus: string) => void;
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label?: string;
  onClick?: () => void;
}

const OrderRow = memo(({ order, index, onStatusChange }: OrderRowProps) => {
  const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    
    axios.put(`${process.env.NEXT_PUBLIC_API_URL}/update-status`, {
      orderId: order.orderLink || order.Order_Link || '',
      status: newStatus
    })
    .then(response => {
      console.log(response);
      onStatusChange(order.orderLink || order.Order_Link || '', newStatus);
    })
    .catch(error => {
      console.error('Error updating order status:', error);
    })
  }, [order, onStatusChange]);

  const orderLink = order.orderLink || order.Order_Link || '';
  const name = order.name || order.Customer_Name || '';
  const status = order.status || order.Status || 'pending fulfillment';
  const date = order.date || order.Date || '';
  const time = order.time || order.Time || '';

  // Format products for display
  const productsDisplay = () => {
    const products = order.Products || order.Products || [];
    if (products.length === 0) return 'No products';

    return products.slice(0, 2).map((p: Product) => {
      const productName = p.name || p.product || '';
      const quantity = p.quantity || 0;
      return `${productName} (${quantity})`;
    }).join(', ') + (products.length > 2 ? ` +${products.length - 2} more` : '');
  };

  return (
    <tr className="border-b border-[#333] hover:bg-[#1A1A1A] transition-colors">
      <td className="px-4 py-3">{index + 1}</td>
      <td className="px-4 py-3">{orderLink || `Order-${index + 1}`}</td>
      <td className="px-4 py-3">{name}</td>
      <td className="px-4 py-3">
        <select
          className="bg-[#1A1A1A] border border-[#333] rounded px-2 py-1 focus:border-[#00E676] focus:outline-none"
          value={status}
          onChange={handleStatusChange}
        >
          <option value="pending fulfillment">Pending Fulfillment</option>
          <option value="partially fulfilled">Partially Fulfilled</option>
          <option value="fulfilled">Fulfilled</option>
        </select>
      </td>
      <td className="px-4 py-3">{date} {time}</td>
      <td className="px-4 py-3">{productsDisplay()}</td>
    </tr>
  );
});
OrderRow.displayName = 'OrderRow';

const ActionButton = memo(({ icon, label, onClick }: ActionButtonProps) => (
  <button
    onClick={onClick}
    className="text-white bg-[#252525] px-4 py-2 rounded-lg hover:bg-[#00E676] transition-colors flex items-center gap-2"
    aria-label={label}
  >
    {icon}
    {label && <span>{label}</span>}
  </button>
));
ActionButton.displayName = 'ActionButton';

export default function OrdersPage() {
  const [filterText, setFilterText] = useState('');
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 10;

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/get-orders`);
        setOrders(response.data);
        setError('');
      } catch (err) {
        console.error('Error fetching orders:', err);
        setError('Failed to load orders. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterText(e.target.value);
    setCurrentPage(1); // Reset to first page when filtering
  }, []);

  const handleStatusChange = useCallback((orderId: string, newStatus: string) => {
    setOrders(prevOrders =>
      prevOrders.map(order =>
        (order.orderLink === orderId || order.Order_Link === orderId)
          ? { ...order, status: newStatus }
          : order
      )
    );
    // Here you would typically make an API call to update the status on the backend
  }, []);

  const filteredOrders = useMemo(() => {
    if (!filterText.trim()) return orders;

    const lowerCaseFilter = filterText.toLowerCase();
    return orders.filter(order => {
      const orderLink = (order.orderLink || order.Order_Link || '').toLowerCase();
      const name = (order.name || order.Customer_Name || '').toLowerCase();
      const status = (order.status || order.Status || '').toLowerCase();
      const email = (order.email || order.Email || '').toLowerCase();

      return orderLink.includes(lowerCaseFilter) ||
        name.includes(lowerCaseFilter) ||
        status.includes(lowerCaseFilter) ||
        email.includes(lowerCaseFilter);
    });
  }, [orders, filterText]);

  // Calculate pagination
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);

  const paginate = (pageNumber: number) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  return (
    <div className="flex h-screen bg-[#0A0A0A] w-full">
      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        <div className="flex space-x-4 items-center mb-6">
          <h1 className="text-3xl font-semibold text-white">Order Management</h1>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter orders..."
              value={filterText}
              onChange={handleFilterChange}
              className="pl-10 px-4 py-2 rounded-lg bg-[#1A1A1A] border border-[#333] text-white focus:outline-none focus:border-[#00E676] w-64"
            />
          </div>
        </div>

        <div className="overflow-auto flex-1 rounded-lg border border-[#333]">
          {loading ? (
            <div className="flex justify-center items-center h-64 text-white">
              Loading orders...
            </div>
          ) : error ? (
            <div className="flex justify-center items-center h-64 text-red-500">
              {error}
            </div>
          ) : (
            <div className="overflow-auto flex-1 rounded-lg border border-[#333] max-h-full scrollbar-thin scrollbar-thumb-[#00E676] scrollbar-track-[#1A1A1A]">
              <table className="w-full text-white border-collapse">
                <TableHeader />
                <tbody>
                  {currentOrders.length > 0 ? (
                    currentOrders.map((order, index) => (
                      <OrderRow
                        key={index}
                        order={order}
                        index={indexOfFirstOrder + index}
                        onStatusChange={handleStatusChange}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                        No orders found matching your filter criteria
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          )}
        </div>

        <div className="mt-4 flex justify-between items-center text-white">
          <div>
            Showing {currentOrders.length} of {filteredOrders.length} orders
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 bg-[#1A1A1A] rounded hover:bg-[#252525]"
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Show pages around current page
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  className={`px-3 py-1 rounded ${currentPage === pageNum ? 'bg-[#00E676] text-black' : 'bg-[#1A1A1A] hover:bg-[#252525]'
                    }`}
                  onClick={() => paginate(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              className="px-3 py-1 bg-[#1A1A1A] rounded hover:bg-[#252525]"
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
