"use client"
import { useState, useMemo } from "react"
import { LayoutGrid, Share2, Settings } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { NewContactDialog } from "./new-contact-dialog"

type Status = "To contact" | "To followup" | "Negotiation" | "Complete"
type View = "Table view" | "Board view"
type SortField = "name" | "email" | "company" | "jobTitle" | "status"
type SortDirection = "asc" | "desc"

interface Contact {
  name: string
  email: string
  company: string
  companyLogo: string
  jobTitle: string
  status: Status
}

const initialContacts: Contact[] = [
  {
    name: "Jerome Bell",
    email: "jerome.bell@loom.com",
    company: "Loom",
    companyLogo: "/placeholder.svg?height=32&width=32",
    jobTitle: "Founder",
    status: "To contact",
  },
  {
    name: "Albert Flores",
    email: "albert.flores@notion.com",
    company: "Notion",
    companyLogo: "/placeholder.svg?height=32&width=32",
    jobTitle: "President of Sales",
    status: "To followup",
  },
  // Add more contacts as needed
]

export function DataTable() {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts)
  const [selectedView, setSelectedView] = useState<View>("Table view")
  const [filterText, setFilterText] = useState("")
  const [filterStatus, setFilterStatus] = useState<Status | "All">("All")
  const [sortConfig, setSortConfig] = useState<{
    field: SortField
    direction: SortDirection
  }>({ field: "name", direction: "asc" })

  const filteredAndSortedContacts = useMemo(() => {
    return contacts
      .filter((contact) => {
        const matchesText =
          filterText === "" ||
          Object.values(contact).some((value) => value.toString().toLowerCase().includes(filterText.toLowerCase()))
        const matchesStatus = filterStatus === "All" || contact.status === filterStatus
        return matchesText && matchesStatus
      })
      .sort((a, b) => {
        const aValue = a[sortConfig.field]
        const bValue = b[sortConfig.field]
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1
        return 0
      })
  }, [contacts, filterText, filterStatus, sortConfig])

  const handleSort = (field: SortField) => {
    setSortConfig({
      field,
      direction: sortConfig.field === field && sortConfig.direction === "asc" ? "desc" : "asc",
    })
  }

  const handleNewContact = (data: Contact) => {
    setContacts([...contacts, { ...data, companyLogo: "/placeholder.svg?height=32&width=32" }])
  }

  return (
    <div className="space-y-4 w-full px-4 py-2">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Business angels list</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button variant="outline" size="sm">
            Invite members
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
          <div className="flex items-center gap-2">
            <Input
              placeholder="Filter contacts..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="h-9 w-[200px]"
            />
            <Select value={filterStatus} onValueChange={(value: Status | "All") => setFilterStatus(value)}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Status</SelectItem>
                <SelectItem value="To contact">To contact</SelectItem>
                <SelectItem value="To followup">To followup</SelectItem>
                <SelectItem value="Negotiation">Negotiation</SelectItem>
                <SelectItem value="Complete">Complete</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button variant="outline" size="sm">
            Import/Export
          </Button>
          <NewContactDialog onSave={handleNewContact} />
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
                  Person name {sortConfig.field === "name" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="p-4 text-left font-medium cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort("email")}
                >
                  Emails {sortConfig.field === "email" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="p-4 text-left font-medium cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort("company")}
                >
                  Companies {sortConfig.field === "company" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="p-4 text-left font-medium cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort("jobTitle")}
                >
                  Job title {sortConfig.field === "jobTitle" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="p-4 text-left font-medium cursor-pointer hover:bg-muted/70"
                  onClick={() => handleSort("status")}
                >
                  Status {sortConfig.field === "status" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedContacts.map((contact) => (
                <tr key={contact.email} className="border-b">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="/placeholder-user.jpg" />
                        <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {contact.name}
                    </div>
                  </td>
                  <td className="p-4 text-muted-foreground">{contact.email}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <img src={contact.companyLogo || "/placeholder.svg"} alt={contact.company} className="h-5 w-5" />
                      {contact.company}
                    </div>
                  </td>
                  <td className="p-4">{contact.jobTitle}</td>
                  <td className="p-4">
                    <StatusBadge status={contact.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedContacts.map((contact) => (
            <div key={contact.email} className="rounded-lg border p-4">
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder-user.jpg" />
                  <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">{contact.name}</h3>
                  <p className="text-sm text-muted-foreground">{contact.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <img src={contact.companyLogo || "/placeholder.svg"} alt={contact.company} className="h-5 w-5" />
                  <span>{contact.company}</span>
                </div>
                <p>{contact.jobTitle}</p>
                <StatusBadge status={contact.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const colors = {
    "To contact": "text-orange-600",
    "To followup": "text-blue-600",
    Negotiation: "text-pink-600",
    Complete: "text-green-600",
  }

  return <span className={colors[status]}>{status}</span>
}

