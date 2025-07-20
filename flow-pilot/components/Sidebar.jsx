'use client'
import { ShoppingBag, Package, BarChart2, Bot, MessageSquare, AlertTriangle, LogOutIcon } from "lucide-react";
import { useCallback, memo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { SignInButton, useUser } from '@clerk/nextjs';
import { Button } from "@ariakit/react";

const MENU_ITEMS = [
  { id: 1, icon: <ShoppingBag size={20} />, label: "Orders", href: "/orders" },
  { id: 2, icon: <Package size={20} />, label: "Inventory", href: "/inventory" },
  { id: 3, icon: <BarChart2 size={20} />, label: "Analytics", href: "/analytics" },
  { id: 4, icon: <AlertTriangle size={20} />, label: "Errors", href: "/errors" },
  { id: 5, icon: <MessageSquare size={20} />, label: "Feedback", href: "/feedback" },
  { id: 6, icon: <Bot size={20} />, label: "Chatbot", href: "/chatbot" },
];

const MenuItem = memo(({ item, isActive, onClick }) => (
  <div
    onClick={onClick}
    className={`flex items-center p-3 rounded-lg mb-2 cursor-pointer transition-colors duration-200
              ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'}`}
  >
    <div className={isActive ? "text-white" : "text-slate-700"}>
      {item.icon}
    </div>
    <span className={`ml-3 ${isActive ? 'text-white' : 'text-slate-800'}`}>{item.label}</span>
  </div>
));
MenuItem.displayName = 'MenuItem';

function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();

  const navigate = useCallback((href) => {
    router.push(href);
  }, [router]);

  const getInitials = () => {
    if (!user) return "KE";
    const username = user.username || user.firstName || "";
    return username.substring(0, 2).toUpperCase() || "KE";
  };

  return (
    <aside className="w-64 bg-white/80 backdrop-blur-md border-r border-slate-200/50 shadow-sm p-4 h-screen sticky top-0 flex flex-col">
      <div className="flex flex-col h-full">
        <div className="flex items-center mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
            {getInitials()}
          </div>
          <div className="ml-3">
            <h2 className="text-slate-900 text-md font-medium">
              {user ? user.username || user.firstName : "undefined"}
            </h2>
          </div>
        </div>

        <nav className="flex-1">
          {MENU_ITEMS.map((item) => (
            <MenuItem
              key={item.id}
              item={item}
              isActive={pathname === item.href}
              onClick={() => navigate(item.href)}
            />
          ))}
        </nav>

        <div className="mt-auto flex space-x-2 items-center border-y-2 border-slate-200 p-2 rounded-lg hover:bg-slate-100">
          <SignInButton>
            <Button className="flex items-center gap-2">
              Logout
              <LogOutIcon size={20} />
            </Button>
          </SignInButton>
        </div>
      </div>
    </aside>
  );
}

export default memo(Sidebar);