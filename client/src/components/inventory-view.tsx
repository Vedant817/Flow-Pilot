"use client"
import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { products } from "@/lib/data"

export function InventoryView() {
    const [search, setSearch] = useState("")

    const filteredProducts = products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()))

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-semibold">Inventory Management</h1>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Product
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Product</DialogTitle>
                        </DialogHeader>
                        {/* Add product form */}
                    </DialogContent>
                </Dialog>
            </div>
            <div className="mb-4">
                <Input
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm"
                />
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Reorder Point</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Last Restocked</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProducts.map((product) => (
                            <TableRow key={product.id}>
                                <TableCell>{product.id}</TableCell>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>{product.category}</TableCell>
                                <TableCell>${product.price.toFixed(2)}</TableCell>
                                <TableCell>
                                    <span className={product.quantity <= product.reorderPoint ? "text-red-500 font-medium" : ""}>
                                        {product.quantity}
                                    </span>
                                </TableCell>
                                <TableCell>{product.reorderPoint}</TableCell>
                                <TableCell>{product.supplier}</TableCell>
                                <TableCell>{product.lastRestocked}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

