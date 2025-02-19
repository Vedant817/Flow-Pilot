// components/Sidebar.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
export default function Sidebar() {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState(0)
    const menuItems = [
        { icon: '🛍️', label: 'Orders',href:"/"},  // Show pending orders
        { icon: '📦', label: 'Inventory',href:"/inventory" },  // Show low stock alerts
        { icon: '📊', label: 'Analytics', href:"/analytics" },
        { icon: '🤖', label: 'Chatbot', href:"/chatbot"}  // Show unread messages
        // { icon: '📦', label: 'Inventory', badge: 2 },
      ]      
  
    return (
      <div className="w-64 bg-black p-4">
        <div className="flex items-center mb-6">
          <div className="w-10 h-10 bg-green-500 rounded-full" />
          <div className="ml-3">
            <h2 className="text-white">Nick Schedov</h2>
            <p className="text-gray-400 text-sm">Kuji Podcast</p>
          </div>
        </div>
        
        <nav>
          {menuItems.map((item) => (
            <div key={item.label} 
                 onClick={() => item.href ? router.push(item.href) : setActiveTab(item.id)}
                 className={`flex items-center p-3 rounded-lg mb-2 
                            ${item.active ? 'bg-green-500' : 'hover:bg-gray-900'}`}>
              <span>{item.icon}</span>
              <span className="ml-3">{item.label}</span>
              {item.badge && (
                <span className="ml-auto bg-red-500 px-2 rounded-full text-sm">
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </nav>
      </div>
    )
  }
  