// components/Sidebar.tsx
'use client'
import { ShoppingBag, Package, BarChart2, Bot } from "lucide-react";
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Sidebar() {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState(0)
    const menuItems = [
      { icon: <ShoppingBag size={20} className="text-[#00E676]" />, label: "Orders", href: "/" },
      { icon: <Package size={20} className="text-[#00E676]" />, label: "Inventory", href: "/inventory" },
      { icon: <BarChart2 size={20} className="text-[#00E676]" />, label: "Analytics", href: "/analytics" },
      { icon: <Bot size={20} className="text-[#00E676]" />, label: "Chatbot", href: "/chatbot" }
    ];    
  
    return (
      <div className="w-64 bg-black p-4">
        <div className="flex items-center mb-6">
          {/* Stylish Logo */}
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00E676] to-[#1A1A1A] flex items-center justify-center text-white font-bold text-xl shadow-lg">
            SE
          </div>
          <div className="ml-3">
            <h2 className="text-white">Shresth</h2>
            <p className="text-gray-400 text-sm">Electronics</p>
          </div>
        </div>
        
        <nav>
          {menuItems.map((item) => (
            <div key={item.label} 
                 onClick={() => item.href ? router.push(item.href) : setActiveTab(item.id)}
                 className={`flex items-center p-3 rounded-lg mb-2 
                            ${item.active ? 'bg-[#00E676]' : 'hover:bg-gray-900'}`}>
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
