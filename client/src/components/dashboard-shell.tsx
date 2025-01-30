"use client"
import { useState } from "react"
import Link from "next/link"
import { BarChart2, Calendar, FileText, Home, LayoutGrid, Users, Zap } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { DashboardView } from "./view/dashboard-view"
import { UsersView } from "./view/users-view"
import { CalendarView } from "./view/calendar-view"
import { DataTable } from "./data-table"

type View =
  | "dashboard"
  | "users"
  | "notes"
  | "calendar"
  | "reports"
  | "document"
  | "business-angels"
  | "clients"
  | "distributors"
  | "partners"
  | "prospects"
  | "suppliers"
  | "vcs"

const sidebarItems = [
  { icon: Home, label: "Dashboard", view: "dashboard" },
  { icon: Users, label: "Users", view: "users" },
  { icon: FileText, label: "Notes", view: "notes" },
  { icon: Calendar, label: "Calendar", view: "calendar" },
  { icon: BarChart2, label: "Reports", view: "reports" },
  { icon: LayoutGrid, label: "Document", view: "document" },
] as const

const privateItems = [
  { label: "Business angels list", count: "16", view: "business-angels" },
  { label: "Clients", count: "6", view: "clients" },
  { label: "Distributors", count: "6", view: "distributors" },
  { label: "Partners", count: "6", view: "partners" },
  { label: "Prospects", count: "6", view: "prospects" },
  { label: "Suppliers", count: "6", view: "suppliers" },
  { label: "VCs", count: "6", view: "vcs" },
] as const

export function DashboardShell() {
  const [search, setSearch] = useState("")
  const [currentView, setCurrentView] = useState<View>("business-angels")

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return <DashboardView />
      case "users":
        return <UsersView />
      case "calendar":
        return <CalendarView />
      case "business-angels":
        return <DataTable />
      default:
        return <div>View not implemented yet</div>
    }
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader className="border-b p-4">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <div className="h-6 w-6 rounded bg-primary" />
              Mailite.inc
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search email or someone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9"
                  />
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Zap className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sidebarItems.map((item) => (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        onClick={() => setCurrentView(item.view)}
                        data-active={currentView === item.view}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Private</SidebarGroupLabel>
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
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b px-6">
            <SidebarTrigger />
            <div className="flex items-center gap-4">
              <Button variant="outline" className="h-8">
                Upgrade Plan
              </Button>
              <Avatar className="h-8 w-8">
                <AvatarImage src="/placeholder-user.jpg" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1 p-6">{renderView()}</main>
        </div>
      </div>
    </SidebarProvider>
  )
}

