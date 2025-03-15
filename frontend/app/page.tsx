'use client'
import React, { useState, useCallback, useMemo, memo } from 'react'
import { Search, Share, Download, Grid } from 'lucide-react'
import { Order, OrderStatus } from '@/lib/constants/types';

const TableHeader = memo(() => (
  <thead className="bg-[#1A1A1A] sticky top-0">
    <tr>
      <th className="px-4 py-3 text-left">S.No.</th>
      <th className="px-4 py-3 text-left">Order ID ↑</th>
      <th className="px-4 py-3 text-left">Customer Name</th>
      <th className="px-4 py-3 text-left">Status</th>
      <th className="px-4 py-3 text-left">Order Date</th>
      <th className="px-4 py-3 text-left">Deadline Date</th>
    </tr>
  </thead>
));
TableHeader.displayName = 'TableHeader';

interface OrderRowProps {
  order: Order;
  index: number;
  onStatusChange: (orderId: string, newStatus: Order['status']) => void;
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label?: string;
  onClick?: () => void;
}

const OrderRow = memo(({ order, index, onStatusChange }: OrderRowProps) => {
  const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onStatusChange(order.id, e.target.value as Order['status']);
  }, [order.id, onStatusChange]);

  return (
    <tr className="border-b border-[#333] hover:bg-[#1A1A1A] transition-colors">
      <td className="px-4 py-3">{index + 1}</td>
      <td className="px-4 py-3">{order.id}</td>
      <td className="px-4 py-3">{order.customerName}</td>
      <td className="px-4 py-3">
        <select
          className="bg-[#1A1A1A] border border-[#333] rounded px-2 py-1 focus:border-[#00E676] focus:outline-none"
          value={order.status}
          onChange={handleStatusChange}
        >
          <option value="Processing">Processing</option>
          <option value="Pending">Pending</option>
          <option value="Completed">Completed</option>
        </select>
      </td>
      <td className="px-4 py-3">{order.orderDate}</td>
      <td className="px-4 py-3">{order.deadlineDate}</td>
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
  const [orders, setOrders] = useState([
    {
      id: 'ORD001',
      customerName: 'John Doe',
      status: 'Processing' as OrderStatus,
      orderDate: '2024-03-08',
      deadlineDate: '2024-03-15'
    },
    {
      id: 'ORD002',
      customerName: 'Jane Smith',
      status: 'Pending' as OrderStatus,
      orderDate: '2024-03-10',
      deadlineDate: '2024-03-20'
    },
    // Add more sample data for testing
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `ORD00${i + 3}`,
      customerName: `Customer ${i + 3}`,
      status: (["Processing", "Pending", "Completed"] as const)[i % 3] as OrderStatus,
      orderDate: `2024-03-${10 + i}`,
      deadlineDate: `2024-03-${20 + i}`
    }))
  ]); //TODO: Replace with actual API call

  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterText(e.target.value);
  }, []);

  const handleStatusChange = useCallback((orderId: string, newStatus: Order['status']) => {
    setOrders(prevOrders =>
      prevOrders.map(order =>
        order.id === orderId ? { ...order, status: newStatus } : order
      )
    );
  }, []);

  const filteredOrders = useMemo(() => {
    if (!filterText.trim()) return orders;

    const lowerCaseFilter = filterText.toLowerCase();
    return orders.filter(order =>
      order.id.toLowerCase().includes(lowerCaseFilter) ||
      order.customerName.toLowerCase().includes(lowerCaseFilter) ||
      order.status.toLowerCase().includes(lowerCaseFilter)
    );
  }, [orders, filterText]);

  return (
    <div className="flex h-screen bg-[#0A0A0A] w-full">
      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-white">Order Management</h1>
          <div className="flex gap-4">
            <ActionButton icon={<Share size={18} />} label="Share" />
            <ActionButton icon={<Download size={18} />} label="Export Data" />
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <ActionButton
              icon={<Grid size={18} />}
              label="Table view"
            />
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
        </div>

        <div className="overflow-auto flex-1 rounded-lg border border-[#333]">
          <table className="w-full text-white border-collapse">
            <TableHeader />
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order, index) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    index={index}
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

        <div className="mt-4 flex justify-between items-center text-white">
          <div>
            Showing {filteredOrders.length} of {orders.length} orders
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-[#1A1A1A] rounded hover:bg-[#252525]">Previous</button>
            <button className="px-3 py-1 bg-[#00E676] rounded text-black">1</button>
            <button className="px-3 py-1 bg-[#1A1A1A] rounded hover:bg-[#252525]">2</button>
            <button className="px-3 py-1 bg-[#1A1A1A] rounded hover:bg-[#252525]">3</button>
            <button className="px-3 py-1 bg-[#1A1A1A] rounded hover:bg-[#252525]">Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}