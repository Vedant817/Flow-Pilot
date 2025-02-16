"use client"

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Box, MessageSquare, Search, ShoppingCart, Zap, BellRing, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { DataTable } from "./data-table";
import { InventoryView } from "./inventory-view";
import { Analytics } from "./analytics";
import { ChatbotView } from "./chatbot-view";
import { motion } from "framer-motion";
import { FeedbackSection } from "./feedback-section";
import { InventoryForecasting } from "./inventory-forecasting";
import { DeadStock } from "./deadstock";

type View = "orders" | "inventory" | "analytics" | "chatbot" | "feedback" | "inventory-forecasting"|"deadstock";

const navigationItems = [
  { label: "Orders", icon: ShoppingCart, view: "orders" as const, count: "25", color: "text-blue-600" },
  { label: "Inventory", icon: Box, view: "inventory" as const, count: "150", color: "text-green-600" },
  { label: "Analytics", icon: BarChart3, view: "analytics" as const, color: "text-purple-600", subsections: ["Sales", "Customer Trends", "Revenue"] },
  { label: "Chatbot", icon: MessageSquare, view: "chatbot" as const, color: "text-orange-600" },
  { label: "Feedback", icon: Star, view: "feedback" as const, color: "text-yellow-600" },
  { label: "Inventory Forecasting", icon: Box, view: "inventory-forecasting" as const, color: "text-green-600" },
  { label: "Deadstock", icon: Star, view: "deadstock" as const, color: "text-red-600" },
];

export function DashboardShell() {
  const [search, setSearch] = useState("");
  const [currentView, setCurrentView] = useState<View>("orders");
  const [currentSubsection, setCurrentSubsection] = useState<string | null>(null);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen md:flex-1 flex-col lg:flex-row bg-gray-50">
        <Sidebar className="border-r bg-white shadow-sm">
          <SidebarHeader className="border-b p-6">
            <Link href="/" className="flex items-center gap-3 font-bold text-xl hover:text-blue-600 transition-colors">
              <Zap className="h-7 w-7 text-blue-600" />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
                Order Management
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <div className="py-6 px-4">
                <div className="flex items-center gap-2 relative">
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-10 pl-10 rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <Search className="h-4 w-4 absolute left-3 text-gray-400" />
                </div>
              </div>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Management</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.label}>
                      <motion.div whileHover={{ x: 5 }} transition={{ duration: 0.2 }}>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setCurrentView(item.view);
                            if (item.subsections) setCurrentSubsection(item.subsections[0]);
                          }}
                          className={`w-full justify-start gap-3 ${
                            currentView === item.view ? "bg-blue-50 text-blue-600" : "hover:bg-gray-100"
                          }`}
                        >
                          <item.icon className={`h-5 w-5 ${item.color}`} />
                          <span>{item.label}</span>
                          {item.count && (
                            <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-xs">
                              {item.count}
                            </span>
                          )}
                        </Button>
                      </motion.div>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b bg-white px-6 shadow-sm">
            <SidebarTrigger className="lg:hidden" />
            <div className="flex items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <BellRing className="h-6 w-6" />
                    <span className="absolute -right-1 -top-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <div className="space-y-2">
                    <h3 className="font-medium">Notifications</h3>
                    <div className="space-y-1">{/* Add notification items here */}</div>
                  </div>
                </PopoverContent>
              </Popover>
              <Avatar>
                <AvatarImage src="/placeholder-user.jpg" alt="User" />
                <AvatarFallback>AD</AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6 h-full">
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
    {currentView === "orders" && <DataTable />}
    {currentView === "inventory" && <InventoryView />}
    
    {currentView === "analytics" && (
      <div>
        <div className="flex gap-4 mb-4">
          {navigationItems.find((item) => item.view === "analytics")?.subsections?.map((sub) => (
            <Button
              key={sub}
              variant={currentSubsection === sub ? "default" : "outline"}
              onClick={() => setCurrentSubsection(sub)}
            >
              {sub}
            </Button>
          ))}
        </div>
        <Analytics subsection={currentSubsection} />
      </div>
    )}

    {currentView === "chatbot" && <ChatbotView />}
    {currentView === "feedback" && <FeedbackSection />}
    {currentView === "inventory-forecasting" && <InventoryForecasting />}
    {currentView === "deadstock" && <DeadStock/>}
  </motion.div>
</main>

        </div>
      </div>
    </SidebarProvider>
  );
}
