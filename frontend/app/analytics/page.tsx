// app/analytics/page.tsx
'use client'

import { useState } from 'react'
import { Line, Pie, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend
)

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('customer')

  const orderTrendData = {
    labels: ['2024-04-09', '2024-05-26', '2024-07-16', '2024-09-04', '2024-10-23', '2024-12-12', '2025-02-18'],
    datasets: [{
      label: 'Orders',
      data: [2, 6, 4, 3, 5, 4, 2],
      borderColor: '#00C853',  // Darker Green
      backgroundColor: 'rgba(0, 200, 83, 0.2)', // Light green fill
      tension: 0.1
    }]
  }
  const orderStatusData = {
    labels: ['Delivered', 'Shipped', 'Processing', 'Pending'],
    datasets: [{
      data: [24, 26, 25, 25],
      backgroundColor: [
        '#B9F6CA',  // Lightest Green
        '#69F0AE',  // Light Neon Green
        '#00E676',  // Bright Light Green
        '#00C853',  // Slightly Darker Light Green
      ]
    }]
  }
  
  
  
  const customerSpendingData = {
    labels: ['Michael Wilson', 'Robert Johnson', 'David Miller', 'John Doe', 'James Taylor'],
    datasets: [
      {
        label: 'Total Spent',
        data: [20000, 15000, 14000, 12000, 10000],
        backgroundColor: 'rgba(0, 200, 83, 0.8)', // Darker Green
      },
      {
        label: 'Order Count',
        data: [28, 21, 18, 15, 12],
        backgroundColor: '#00E676', // Vibrant Green
      }
    ]
  }
  

  return (
    <div className="flex h-screen bg-[#0A0A0A] w-full">
      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-white">Analytics Dashboard</h1>
          <div className="flex gap-4">
            <button 
              onClick={() => setActiveTab('customer')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'customer' 
                  ? 'bg-[#00E676] text-black' 
                  : 'text-white bg-[#1A1A1A]'
              }`}
            >
              Customer Analysis
            </button>
            <button 
              onClick={() => setActiveTab('product')}
              className={`px-4 py-2 rounded-lg ${
                activeTab === 'product' 
                  ? 'bg-[#00E676] text-black' 
                  : 'text-white bg-[#1A1A1A]'
              }`}
            >
              Product Analysis
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Order Trend Chart */}
          <div className="bg-[#1A1A1A] p-4 rounded-lg h-[350px]">
            <h2 className="text-white mb-4">Order Trend (Last 30 Days)</h2>
            <Line 
              data={orderTrendData}
              options={{
                responsive: true,
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: {
                      color: '#333'
                    },
                    ticks: { color: '#fff' }
                  },
                  x: {
                    grid: {
                      color: '#333'
                    },
                    ticks: { color: '#fff' }
                  }
                },
                plugins: {
                  legend: {
                    labels: { color: '#fff' }
                  }
                }
              }}
            />
          </div>

          {/* Order Status Distribution */}
          <div className="bg-[#1A1A1A] p-4 rounded-lg h-[350px]">
            <h2 className="text-white mb-4">Order Status Distribution</h2>
            <Pie 
              data={orderStatusData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'right',
                    labels: { color: '#fff' }
                  }
                }
              }}
            />
          </div>

          {/* Top Customers */}
          <div className="bg-[#1A1A1A] p-4 rounded-lg col-span-2 h-[340px]">
            <h2 className="text-white mb-4">Top 10 Customers by Spending</h2>
            <Bar 
              data={customerSpendingData}
              options={{
                responsive: true,
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: {
                      color: '#333'
                    },
                    ticks: { color: '#fff' }
                  },
                  x: {
                    grid: {
                      color: '#333'
                    },
                    ticks: { color: '#fff' }
                  }
                },
                plugins: {
                  legend: {
                    labels: { color: '#fff' }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
