'use client'
import { ShoppingBag, Package, BarChart2, Bot } from "lucide-react";
import { useState, useCallback, memo } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const MENU_ITEMS = [
  { id: 1, icon: <ShoppingBag size={20} />, label: "Orders", href: "/" },
  { id: 2, icon: <Package size={20} />, label: "Inventory", href: "/inventory" },
  { id: 3, icon: <BarChart2 size={20} />, label: "Analytics", href: "/analytics" },
  { id: 4, icon: <Bot size={20} />, label: "Chatbot", href: "/chatbot" }
];

const MenuItem = memo(({ item, isActive, onClick }) => (
  <div
    onClick={onClick}
    className={`flex items-center p-3 rounded-lg mb-2 cursor-pointer transition-colors duration-200
              ${isActive ? 'bg-[#00E676]' : 'hover:bg-gray-900'}`}
  >
    <div className={isActive ? "text-white" : "text-[#00E676]"}>
      {item.icon}
    </div>
    <span className={`ml-3 ${isActive ? 'text-black' : 'text-white'}`}>{item.label}</span>
  </div>
));
MenuItem.displayName = 'MenuItem';

function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const navigate = useCallback((href) => {
    router.push(href);
  }, [router]);

  return (
    <aside className="w-64 bg-black p-4 h-screen sticky top-0">
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
        {MENU_ITEMS.map((item) => (
          <MenuItem
            key={item.id}
            item={item}
            isActive={pathname === item.href}
            onClick={() => navigate(item.href)}
          />
        ))}
      </nav>
    </aside>
  )
}

export default memo(Sidebar);