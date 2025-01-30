"use client"
import { useState, useMemo } from "react"
import { LayoutGrid, Share2, Settings } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type View = "Table view" | "Board view"
type SortField = "name" | "email" | "nameOfOrg" | "orderNo" | "orderName"
type SortDirection = "asc" | "desc"

interface Person {
  id: string
  name: string
  email: string
  nameOfOrg: string
  avatar: string
}

interface Order {
  serialNo: number
  orderNo: string
  orderId: string
  orderName: string
  email: string
  nameOfOrg: string
  itemList: { itemId: string; quantity: number }[]
}

const initialPersons: Person[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    nameOfOrg: "Org A",
    avatar: "/placeholder-user.jpg",
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@example.com",
    nameOfOrg: "Org B",
    avatar: "/placeholder-user.jpg",
  },
  // Add more persons as needed
]

const initialOrders: Order[] = [
  {
    serialNo: 1,
    orderNo: "ORD001",
    orderId: "ID001",
    orderName: "First Order",
    email: "john@example.com",
    nameOfOrg: "Org A",
    itemList: [
      { itemId: "ITEM1", quantity: 2 },
      { itemId: "ITEM2", quantity: 1 },
    ],
  },
  {
    serialNo: 2,
    orderNo: "ORD002",
    orderId: "ID002",
    orderName: "Second Order",
    email: "jane@example.com",
    nameOfOrg: "Org B",
    itemList: [{ itemId: "ITEM3", quantity: 3 }],
  },
]

export function DataTable() {
  const [persons, setPersons] = useState<Person[]>(initialPersons)
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [selectedView, setSelectedView] = useState<View>("Table view")
  const [filterText, setFilterText] = useState("")
  const [sortConfig, setSortConfig] = useState<{
    field: SortField
    direction: SortDirection
  }>({ field: "name", direction: "asc" })
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const filteredAndSortedPersons = useMemo(() => {
    return persons
      .filter((person) => {
        return (
          filterText === "" ||
          Object.values(person).some((value) => value.toString().toLowerCase().includes(filterText.toLowerCase()))
        )
      })
      .sort((a, b) => {
        const aValue = a[sortConfig.field]
        const bValue = b[sortConfig.field]
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1
        return 0
      })
  }, [persons, filterText, sortConfig])

  const handleSort = (field: SortField) => {
    setSortConfig({
      field,
      direction: sortConfig.field === field && sortConfig.direction === "asc" ? "desc" : "asc",
    })
  }

  const handlePersonClick = (person: Person) => {
    setSelectedPerson(person)
  }

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order)
  }

  return (
    <div className="space-y-4 w-full px-4 py-2">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Person List</h1>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
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
            placeholder="Filter persons..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="h-9 w-[200px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>
      {selectedView === "Table view" ? (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th
                  className="p-4 text-left font-medium cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort("name")}
                >
                  Name {sortConfig.field === "name" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="p-4 text-left font-medium cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort("email")}
                >
                  Email {sortConfig.field === "email" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="p-4 text-left font-medium cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort("nameOfOrg")}
                >
                  Organization {sortConfig.field === "nameOfOrg" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedPersons.map((person) => (
                <tr
                  key={person.id}
                  className="border-b hover:bg-muted/50 cursor-pointer"
                  onClick={() => handlePersonClick(person)}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={person.avatar} />
                        <AvatarFallback>{person.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {person.name}
                    </div>
                  </td>
                  <td className="p-4">{person.email}</td>
                  <td className="p-4">{person.nameOfOrg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedPersons.map((person) => (
            <div
              key={person.id}
              className="rounded-lg border p-4 hover:bg-muted/50 cursor-pointer"
              onClick={() => handlePersonClick(person)}
            >
              <div className="flex items-center gap-3 mb-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={person.avatar} />
                  <AvatarFallback>{person.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <h3 className="font-semibold">{person.name}</h3>
              </div>
              <p className="text-sm">{person.email}</p>
              <p className="text-sm text-muted-foreground">{person.nameOfOrg}</p>
            </div>
          ))}
        </div>
      )}
      <PersonOrdersDialog
        person={selectedPerson}
        orders={orders.filter((order) => order.email === selectedPerson?.email)}
        onClose={() => setSelectedPerson(null)}
        onOrderClick={handleOrderClick}
      />
      <OrderDetailsDialog order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  )
}

interface PersonOrdersDialogProps {
  person: Person | null
  orders: Order[]
  onClose: () => void
  onOrderClick: (order: Order) => void
}

function PersonOrdersDialog({ person, orders, onClose, onOrderClick }: PersonOrdersDialogProps) {
  if (!person) return null

  return (
    <Dialog open={!!person} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{person.name}'s Orders</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p>
            <strong>Email:</strong> {person.email}
          </p>
          <p>
            <strong>Organization:</strong> {person.nameOfOrg}
          </p>
          <h4 className="font-semibold mt-4">Orders:</h4>
          {orders.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Order No</th>
                  <th className="p-2 text-left">Order Name</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.orderId} className="border-b">
                    <td className="p-2">{order.orderNo}</td>
                    <td className="p-2">{order.orderName}</td>
                    <td className="p-2">
                      <Button variant="outline" size="sm" onClick={() => onOrderClick(order)}>
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No orders found for this person.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Order Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p>
            <strong>Order No:</strong> {order.orderNo}
          </p>
          <p>
            <strong>Order ID:</strong> {order.orderId}
          </p>
          <p>
            <strong>Order Name:</strong> {order.orderName}
          </p>
          <p>
            <strong>Email:</strong> {order.email}
          </p>
          <p>
            <strong>Organization:</strong> {order.nameOfOrg}
          </p>
          <h4 className="font-semibold mt-4">Items:</h4>
          <ul>
            {order.itemList.map((item, index) => (
              <li key={index}>
                Item ID: {item.itemId}, Quantity: {item.quantity}
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}