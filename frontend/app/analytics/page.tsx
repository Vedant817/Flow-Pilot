'use client'
import { useState, useMemo, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
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

const Line = dynamic(() => import('react-chartjs-2').then((mod) => mod.Line), { ssr: false })
const Pie = dynamic(() => import('react-chartjs-2').then((mod) => mod.Pie), { ssr: false })
const Bar = dynamic(() => import('react-chartjs-2').then((mod) => mod.Bar), { ssr: false })

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

const chartOptions = {
  responsive: true,
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: '#333' },
      ticks: { color: '#fff' }
    },
    x: {
      grid: { color: '#333' },
      ticks: { color: '#fff' }
    }
  },
  plugins: {
    legend: { labels: { color: '#fff' } }
  }
}

const MemoizedLine = memo(Line)
const MemoizedPie = memo(Pie)
const MemoizedBar = memo(Bar)

const TabButton = memo(({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`px-4 py-2 rounded-lg transition-colors ${
      isActive ? 'bg-[#00E676] text-black' : 'text-white bg-[#1A1A1A] hover:bg-[#252525]'
    }`}
  >
    {label}
  </button>
))
TabButton.displayName = 'TabButton'

const ChartContainer = memo(({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-[#1A1A1A] p-4 rounded-lg h-[350px]">
    <h2 className="text-white mb-4">{title}</h2>
    {children}
  </div>
))
ChartContainer.displayName = 'ChartContainer'

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('customer')

  const orderTrendData = useMemo(() => ({
    labels: ['2024-04-09', '2024-05-26', '2024-07-16', '2024-09-04', '2024-10-23', '2024-12-12', '2025-02-18'],
    datasets: [{
      label: 'Orders',
      data: [2, 6, 4, 3, 5, 4, 2],
      borderColor: '#00C853',
      backgroundColor: 'rgba(0, 200, 83, 0.2)',
      tension: 0.1
    }]
  }), [])

  const orderStatusData = useMemo(() => ({
    labels: ['Delivered', 'Shipped', 'Processing', 'Pending'],
    datasets: [{
      data: [24, 26, 25, 25],
      backgroundColor: ['#B9F6CA', '#69F0AE', '#00E676', '#00C853']
    }]
  }), [])

  const customerSpendingData = useMemo(() => ({
    labels: ['Michael Wilson', 'Robert Johnson', 'David Miller', 'John Doe', 'James Taylor'],
    datasets: [
      {
        label: 'Total Spent',
        data: [20000, 15000, 14000, 12000, 10000],
        backgroundColor: 'rgba(0, 200, 83, 0.8)',
      },
      {
        label: 'Order Count',
        data: [28, 21, 18, 15, 12],
        backgroundColor: '#00E676',
      }
    ]
  }), [])

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
  }, [])

  return (
    <div className="flex min-h-screen bg-[#0A0A0A] w-full">
      <div className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-white">Analytics Dashboard</h1>
          <div className="flex gap-4">
            <TabButton 
              label="Customer Analysis"
              isActive={activeTab === 'customer'}
              onClick={() => handleTabChange('customer')}
            />
            <TabButton 
              label="Product Analysis"
              isActive={activeTab === 'product'}
              onClick={() => handleTabChange('product')}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <ChartContainer title="Order Trend (Last 30 Days)">
            <MemoizedLine data={orderTrendData} options={chartOptions} />
          </ChartContainer>

          <ChartContainer title="Order Status Distribution">
            <MemoizedPie 
              data={orderStatusData}
              options={{
                ...chartOptions,
                plugins: {
                  ...chartOptions.plugins,
                  legend: { ...chartOptions.plugins.legend, position: 'right' as const }
                }
              }}
            />
          </ChartContainer>

          <ChartContainer title="Top 10 Customers by Spending">
            <MemoizedBar data={customerSpendingData} options={chartOptions} />
          </ChartContainer>
        </div>
      </div>
    </div>
  )
}
