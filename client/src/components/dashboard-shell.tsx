"use client"
import { useState } from "react"
import Link from "next/link"
import { Search, ZapIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { DataTable } from "./data-table"

type View = "persons" | "inventory"

const privateItems = [
  { label: "Persons", count: "16", view: "persons" },
  { label: "Inventory", count: "6", view: "inventory" },
] as const

export function DashboardShell() {
  const [search, setSearch] = useState("")
  const [currentView, setCurrentView] = useState<View>("persons")

  return (
    <SidebarProvider className="w-full">
      <div className="flex min-h-screen flex-1">
        <Sidebar className="">
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
                    placeholder="Search persons..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9"
                  />
                  <Button variant="ghost" size="icon" className="h-9 w-9 border">
                    <Search className="h-9 w-9" />
                  </Button>
                </div>
              </div>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {privateItems.map((item) => (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        onClick={() => setCurrentView(item.view)}
                        data-active={currentView === item.view}
                      >
                        <span>{item.label}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{item.count}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <div className="flex flex-1 flex-col ">
          <header className="flex h-14 items-center justify-between border-b px-6">
            <SidebarTrigger />
            <div className="flex items-center gap-4">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/placeholder-user.jpg" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </div>
          </header>
          <DataTable />
        </div>
      </div>
    </SidebarProvider>
  )
}