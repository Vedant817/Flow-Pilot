"use client"
import { useState, useMemo } from "react"
import { LayoutGrid, Share2, Settings, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"

type View = "Table view" | "Board view"
type SortField = "orderId" | "customerName" | "status" | "orderDate" | "deadlineDate"
type SortDirection = "asc" | "desc"

interface Order {
  serialNo: number
  orderId: string
  customerName: string
  status: "Pending" | "Processing" | "Shipped" | "Delivered" | "Cancelled"
  orderDate: string
  deadlineDate: string
  email: string
  items: {
    itemId: string
    name: string
    quantity: number
    specification: string
    status: "Filled" | "Cancelled" | "Pending"
  }[]
}

const initialOrders: Order[] = [
  {
    serialNo: 1,
    orderId: "ORD001",
    customerName: "John Doe",
    status: "Processing",
    orderDate: "2024-03-08",
    deadlineDate: "2024-03-15",
    email: "john@example.com",
    items: [
      { itemId: "ITEM1", name: "Product A", quantity: 2, specification: "Model X", status: "Filled" },
      { itemId: "ITEM2", name: "Product B", quantity: 1, specification: "Model Y", status: "Pending" },
    ],
  },
  {
    serialNo: 2,
    orderId: "ORD002",
    customerName: "Jane Smith",
    status: "Pending",
    orderDate: "2024-03-10",
    deadlineDate: "2024-03-20",
    email: "jane@example.com",
    items: [{ itemId: "ITEM3", name: "Product C", quantity: 3, specification: "Model Z", status: "Filled" }],
  },
  // Add more sample orders as needed
]

export function DataTable() {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [selectedView, setSelectedView] = useState<View>("Table view")
  const [filterText, setFilterText] = useState("")
  const [sortConfig, setSortConfig] = useState<{
    field: SortField
    direction: SortDirection
  }>({ field: "orderId", direction: "asc" })
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  const filteredAndSortedOrders = useMemo(() => {
    return orders
      .filter((order) => {
        return (
          filterText === "" ||
          Object.values(order).some((value) => value.toString().toLowerCase().includes(filterText.toLowerCase()))
        )
      })
      .sort((a, b) => {
        const aValue = a[sortConfig.field]
        const bValue = b[sortConfig.field]
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1
        return 0
      })
  }, [orders, filterText, sortConfig])

  const handleSort = (field: SortField) => {
    setSortConfig({
      field,
      direction: sortConfig.field === field && sortConfig.direction === "asc" ? "desc" : "asc",
    })
  }

  const handleOrderClick = (order: Order) => {
    if (window.innerWidth <= 640) {
      setExpandedOrderId(expandedOrderId === order.orderId ? null : order.orderId)
    } else {
      setSelectedOrder(order)
    }
  }

  const handleStatusChange = (orderId: string, newStatus: Order["status"]) => {
    setOrders(orders.map((order) => (order.orderId === orderId ? { ...order, status: newStatus } : order)))
  }

  return (
    <div className="space-y-4 w-full px-4 py-2">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Order List</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button variant="outline" size="sm">
            Export Data
          </Button>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <LayoutGrid className="mr-2 h-4 w-4" />
                {selectedView}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSelectedView("Table view")}>Table view</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedView("Board view")}>Board view</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Input
            placeholder="Filter orders..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="h-9 w-full sm:w-[200px]"
          />
        </div>
        <Button variant="outline" size="sm">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          {/* Desktop view */}
          <table className="w-full hidden sm:table">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-4 text-left font-medium">S.No.</th>
                <th
                  className="p-4 text-left font-medium cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort("orderId")}
                >
                  Order ID {sortConfig.field === "orderId" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="p-4 text-left font-medium cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort("customerName")}
                >
                  Customer Name {sortConfig.field === "customerName" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="p-4 text-left font-medium cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort("status")}
                >
                  Status {sortConfig.field === "status" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="p-4 text-left font-medium cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort("orderDate")}
                >
                  Order Date {sortConfig.field === "orderDate" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="p-4 text-left font-medium cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort("deadlineDate")}
                >
                  Deadline Date {sortConfig.field === "deadlineDate" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedOrders.map((order) => (
                <tr
                  key={order.orderId}
                  className="border-b hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleOrderClick(order)}
                >
                  <td className="p-4">{order.serialNo}</td>
                  <td className="p-4">{order.orderId}</td>
                  <td className="p-4">{order.customerName}</td>
                  <td className="p-4">
                    <Select
                      value={order.status}
                      onValueChange={(value) => handleStatusChange(order.orderId, value as Order["status"])}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Processing">Processing</SelectItem>
                        <SelectItem value="Shipped">Shipped</SelectItem>
                        <SelectItem value="Delivered">Delivered</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-4">{order.orderDate}</td>
                  <td className="p-4">{order.deadlineDate}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile view */}
          <div className="sm:hidden">
            {filteredAndSortedOrders.map((order) => (
              <Card key={order.orderId} className="mb-4">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center" onClick={() => handleOrderClick(order)}>
                    <div>
                      <p className="font-semibold">{order.orderId}</p>
                      <p className="text-sm text-gray-600">{order.customerName}</p>
                    </div>
                    <div className="flex items-center">
                      <span className="mr-2">{order.status}</span>
                      {expandedOrderId === order.orderId ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                  {expandedOrderId === order.orderId && (
                    <div className="mt-4 space-y-2">
                      <p>
                        <strong>Order Date:</strong> {order.orderDate}
                      </p>
                      <p>
                        <strong>Deadline Date:</strong> {order.deadlineDate}
                      </p>
                      <p>
                        <strong>Email:</strong> {order.email}
                      </p>
                      <div>
                        <strong>Status:</strong>
                        <Select
                          value={order.status}
                          onValueChange={(value) => handleStatusChange(order.orderId, value as Order["status"])}
                        >
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Processing">Processing</SelectItem>
                            <SelectItem value="Shipped">Shipped</SelectItem>
                            <SelectItem value="Delivered">Delivered</SelectItem>
                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
      <OrderDetailsDialog order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  )
}

interface OrderDetailsDialogProps {
  order: Order | null
  onClose: () => void
}

function OrderDetailsDialog({ order, onClose }: OrderDetailsDialogProps) {
  if (!order) return null

  return (
    <Dialog open={!!order} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Order Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <p>
              <strong>Customer Name:</strong> {order.customerName}
            </p>
            <p>
              <strong>Order ID:</strong> {order.orderId}
            </p>
            <p>
              <strong>Email:</strong> {order.email}
            </p>
            <p>
              <strong>Order Date:</strong> {order.orderDate}
            </p>
            <p>
              <strong>Deadline Date:</strong> {order.deadlineDate}
            </p>
            <p>
              <strong>Status:</strong> {order.status}
            </p>
          </div>
          <h4 className="font-semibold mt-4">Items:</h4>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-left">S.No.</th>
                  <th className="p-2 text-left">Item Name</th>
                  <th className="p-2 text-left">Quantity</th>
                  <th className="p-2 text-left">Specification</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, index) => (
                  <tr key={item.itemId} className="border-b">
                    <td className="p-2">{index + 1}</td>
                    <td className="p-2">{item.name}</td>
                    <td className="p-2">{item.quantity}</td>
                    <td className="p-2">{item.specification}</td>
                    <td className="p-2">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}