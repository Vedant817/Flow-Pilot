// app/orders/page.tsx
'use client'

// import { useState } from 'react'
export default function OrdersPage() {
//   const [filterText, setFilterText] = useState('')
// const [selectedOrder, setSelectedOrder] = useState(null);

  return (
    <div className="flex h-screen bg-[#0A0A0A] w-full">
      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-white">Order Management</h1>
          <div className="flex gap-4">
            <button className="text-white bg-[#252525] px-4 py-2 rounded-lg hover:bg-[#00E676]">
              Share
            </button>
            <button className="text-white bg-[#252525] px-4 py-2 rounded-lg hover:bg-[#00E676]">
              Export Data
            </button>
            <button className="text-white bg-[#252525] px-4 py-2 rounded-lg hover:bg-[#00E676]">
              Settings
            </button>
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <button className="bg-[#00E676] text-white px-4 py-2 rounded-lg flex items-center gap-2">
              <span>⊞</span> Table view
            </button>
            <input
              type="text"
              placeholder="Filter orders..."
              className="px-4 py-2 rounded-lg bg-[#1A1A1A] border border-[#333] text-white focus:outline-none focus:border-[#00E676]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-white">
            <thead className="bg-[#1A1A1A]">
              <tr>
                <th className="px-4 py-3 text-left">S.No.</th>
                <th className="px-4 py-3 text-left">Order ID ↑</th>
                <th className="px-4 py-3 text-left">Customer Name</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Order Date</th>
                <th className="px-4 py-3 text-left">Deadline Date</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#333] hover:bg-[#1A1A1A]">
                <td className="px-4 py-3">1</td>
                <td className="px-4 py-3">ORD001</td>
                <td className="px-4 py-3">John Doe</td>
                <td className="px-4 py-3">
                  <select className="bg-[#1A1A1A] border border-[#333] rounded px-2 py-1">
                    <option>Processing</option>
                    <option>Pending</option>
                    <option>Completed</option>
                  </select>
                </td>
                <td className="px-4 py-3">2024-03-08</td>
                <td className="px-4 py-3">2024-03-15</td>
              </tr>
              <tr className="border-b border-[#333] hover:bg-[#1A1A1A]">
                <td className="px-4 py-3">2</td>
                <td className="px-4 py-3">ORD002</td>
                <td className="px-4 py-3">Jane Smith</td>
                <td className="px-4 py-3">
                  <select className="bg-[#1A1A1A] border border-[#333] rounded px-2 py-1">
                    <option>Pending</option>
                    <option>Processing</option>
                    <option>Completed</option>
                  </select>
                </td>
                <td className="px-4 py-3">2024-03-10</td>
                <td className="px-4 py-3">2024-03-20</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
