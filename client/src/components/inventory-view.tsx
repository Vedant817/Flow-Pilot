"use client"
import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { products } from "@/lib/data"

export default function InventoryView() {
    const [search, setSearch] = useState("")

    const filteredProducts = products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()))

    return (
        <div className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
                <h1 className="text-xl md:text-2xl font-semibold">Inventory Management</h1>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button className="w-full md:w-auto">
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
                    className="w-full md:max-w-sm"
                />
            </div>

            {/* Responsive Table Wrapper */}
            <div className="overflow-x-auto rounded-md border">
                <Table className="w-full min-w-max">
                    <TableHeader className="hidden md:table-header-group">
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
                            <TableRow key={product.id} className="flex flex-col md:table-row border-b md:border-0 p-4 md:p-0">
                                <TableCell className="md:table-cell">
                                    <span className="font-medium md:hidden">Product ID: </span>
                                    {product.id}
                                </TableCell>
                                <TableCell className="md:table-cell">
                                    <span className="font-medium md:hidden">Name: </span>
                                    {product.name}
                                </TableCell>
                                <TableCell className="md:table-cell">
                                    <span className="font-medium md:hidden">Category: </span>
                                    {product.category}
                                </TableCell>
                                <TableCell className="md:table-cell">
                                    <span className="font-medium md:hidden">Price: </span>
                                    ${product.price.toFixed(2)}
                                </TableCell>
                                <TableCell className="md:table-cell">
                                    <span className="font-medium md:hidden">Quantity: </span>
                                    <span className={product.quantity <= product.reorderPoint ? "text-red-500 font-medium" : ""}>
                                        {product.quantity}
                                    </span>
                                </TableCell>
                                <TableCell className="md:table-cell">
                                    <span className="font-medium md:hidden">Reorder Point: </span>
                                    {product.reorderPoint}
                                </TableCell>
                                <TableCell className="md:table-cell">
                                    <span className="font-medium md:hidden">Supplier: </span>
                                    {product.supplier}
                                </TableCell>
                                <TableCell className="md:table-cell">
                                    <span className="font-medium md:hidden">Last Restocked: </span>
                                    {product.lastRestocked}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
