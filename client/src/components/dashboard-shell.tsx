"use client"

import { useState } from "react"
import Link from "next/link"
import { BarChart3, Box, MessageSquare, Search, ShoppingCart, ZapIcon, BellRing } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { DataTable } from "./data-table"
import InventoryView from "./inventory-view"
import { Analytics } from "./analytics"
import ChatbotView from "./chatbot-view"

type View = "orders" | "inventory" | "analytics" | "chatbot"

const navigationItems = [
  { label: "Orders", icon: ShoppingCart, view: "orders" as const, count: "25" },
  { label: "Inventory", icon: Box, view: "inventory" as const, count: "150" },
  { label: "Analytics", icon: BarChart3, view: "analytics" as const },
  { label: "Chatbot", icon: MessageSquare, view: "chatbot" as const },
]

export function DashboardShell() {
  const [search, setSearch] = useState("")
  const [currentView, setCurrentView] = useState<View>("orders")

  return (
    <SidebarProvider className="w-full">
      <div className="flex min-h-screen md:flex-1 flex-col lg:flex-row">
        <Sidebar className="border-r">
          <SidebarHeader className="border-b p-4">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <ZapIcon className="h-6 w-6" />
              Order Management
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <div className="py-4 px-2 pb-0">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9"
                  />
                  <Button variant="ghost" size="icon" className="h-9 w-9 border">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Management</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton onClick={() => setCurrentView(item.view)} isActive={currentView === item.view}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                        {item.count && <span className="ml-auto text-xs text-muted-foreground">{item.count}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <div className="flex flex-1 flex-col w-full">
          <header className="flex h-14 items-center justify-between border-b px-4 lg:px-6">
            <SidebarTrigger />
            <div className="flex items-center gap-4 relative">
              {/* Notification Bell with Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="relative p-2 rounded-full hover:bg-gray-200">
                    <BellRing className="h-6 w-6 text-gray-600 hover:text-gray-800" />
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-4 bg-white shadow-lg rounded-md">
                  <h3 className="text-sm font-semibold text-gray-700">Offers & Vouchers</h3>
                  <ul className="mt-2 space-y-2">
                    <li className="p-2 bg-gray-100 rounded-md text-sm">🎉 Get 20% off on your next purchase!</li>
                    <li className="p-2 bg-gray-100 rounded-md text-sm">🚀 Free shipping on orders above Rs 999!</li>
                    <li className="p-2 bg-gray-100 rounded-md text-sm">🔖 Exclusive deal: Buy 1 Get 1 Free!</li>
                  </ul>
                </PopoverContent>
              </Popover>

              {/* User Avatar */}
              <Avatar className="h-8 w-8">
                <AvatarImage src="/placeholder-user.jpg" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1 p-4 lg:p-6">
            {currentView === "orders" && <DataTable />}
            {currentView === "inventory" && <InventoryView />}
            {currentView === "analytics" && <Analytics />}
            {currentView === "chatbot" && <ChatbotView />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
