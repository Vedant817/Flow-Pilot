'use client'
import { useState, useCallback, memo } from 'react'
import CustomerDashboard from '@/components/analytics/CustomerAnalytics'
import ProductDashboard from '@/components/analytics/ProductAnalytics'

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

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('customer')

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

        <div className="mt-6">
          {activeTab === 'customer' ? <CustomerDashboard /> : <ProductDashboard />}
        </div>
      </div>
    </div>
  )
}