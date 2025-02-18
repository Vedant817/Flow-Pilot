"use client"

import { useState } from "react"
import { Plus, Search, Download, Settings2, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { products } from "@/lib/data"
import { motion } from "framer-motion"

export function InventoryView() {
    const [search, setSearch] = useState("")
    const filteredProducts = products.filter((product) => 
        product.name.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="p-4 md:p-6 space-y-6"
        >
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
                        Inventory Management
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Manage your products and stock levels
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="hidden md:flex">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Product
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Add New Product</DialogTitle>
                            </DialogHeader>
                            {/* Add product form */}
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Search and Filter Section */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg shadow-sm">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search products..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="hidden md:flex">
                        <Filter className="mr-2 h-4 w-4" />
                        Filters
                    </Button>
                    <Button variant="outline" className="hidden md:flex">
                        <Settings2 className="mr-2 h-4 w-4" />
                        Columns
                    </Button>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table className="w-full min-w-max">
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead className="font-semibold">Product ID</TableHead>
                                <TableHead className="font-semibold">Name</TableHead>
                                <TableHead className="font-semibold">Category</TableHead>
                                <TableHead className="font-semibold">Price</TableHead>
                                <TableHead className="font-semibold">Quantity</TableHead>
                                <TableHead className="font-semibold">Reorder Point</TableHead>
                                <TableHead className="font-semibold">Supplier</TableHead>
                                <TableHead className="font-semibold">Last Restocked</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProducts.map((product) => (
                                <TableRow 
                                    key={product.id}
                                    className="hover:bg-gray-50 transition-colors"
                                >
                                    <TableCell className="font-medium">{product.id}</TableCell>
                                    <TableCell>{product.name}</TableCell>
                                    <TableCell>
                                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                            {product.category}
                                        </span>
                                    </TableCell>
                                    <TableCell>${product.price.toFixed(2)}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            product.quantity <= product.reorderPoint 
                                            ? "bg-red-50 text-red-700" 
                                            : "bg-green-50 text-green-700"
                                        }`}>
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
        </motion.div>
    )
}
