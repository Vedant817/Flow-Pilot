"use client"
import { useState } from "react"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
} from "recharts"
import { TabsContent, Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { customers, orders, products } from "@/lib/data"

// Prepare data for charts
const ordersByDate = orders.reduce(
    (acc, order) => {
        const date = order.orderDate
        acc[date] = (acc[date] || 0) + 1
        return acc
    },
    {} as Record<string, number>,
)

const orderTrendData = Object.entries(ordersByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
        date,
        Orders: count,
    }))

const customerSpendingData = customers
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10)
    .map((customer) => ({
        name: customer.name,
        "Total Spent": customer.totalSpent,
        "Order Count": customer.totalOrders,
    }))

const categoryData = products.reduce(
    (acc, product) => {
        acc[product.category] = (acc[product.category] || 0) + product.quantity
        return acc
    },
    {} as Record<string, number>,
)

const inventoryByCategory = Object.entries(categoryData).map(([name, value]) => ({
    name,
    value,
}))

const productPerformance = products
    .map((product) => ({
        name: product.name,
        "Current Stock": product.quantity,
        "Reorder Point": product.reorderPoint,
    }))
    .sort((a, b) => a["Current Stock"] - b["Current Stock"])

const orderStatusData = orders.reduce(
    (acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1
        return acc
    },
    {} as Record<string, number>,
)

const orderStatusChart = Object.entries(orderStatusData).map(([name, value]) => ({
    name,
    value,
}))

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"]

export function Analytics() {
    const [view, setView] = useState<"customers" | "products">("customers")

    return (
        <div className="p-6">
            <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                    <h1 className="text-2xl font-semibold">Analytics Dashboard</h1>
                    <TabsList>
                        <TabsTrigger value="customers">Customer Analysis</TabsTrigger>
                        <TabsTrigger value="products">Product Analysis</TabsTrigger>
                    </TabsList>
                </div>
                <div className="grid gap-6">
                    <TabsContent value="customers">
                        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Order Trend (Last 30 Days)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={320} minHeight={200}>
                                        <LineChart data={orderTrendData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Line type="monotone" dataKey="Orders" stroke="#8884d8" activeDot={{ r: 8 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Order Status Distribution</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={320} minHeight={200}>
                                        <PieChart>
                                            <Pie
                                                data={orderStatusChart}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                outerRadius={80}
                                                fill="#8884d8"
                                                dataKey="value"
                                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            >
                                                {orderStatusChart.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                            <Card className="md:col-span-2">
                                <CardHeader>
                                    <CardTitle>Top 10 Customers by Spending</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={320} minHeight={200}>
                                        <BarChart data={customerSpendingData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" />
                                            <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                                            <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                                            <Tooltip />
                                            <Legend />
                                            <Bar yAxisId="left" dataKey="Total Spent" fill="#8884d8" />
                                            <Bar yAxisId="right" dataKey="Order Count" fill="#82ca9d" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                    <TabsContent value="products">
                        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Inventory by Category</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={320} minHeight={200}>
                                        <PieChart>
                                            <Pie
                                                data={inventoryByCategory}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                outerRadius={80}
                                                fill="#8884d8"
                                                dataKey="value"
                                                label={({ name, value }) => `${name}: ${value}`}
                                            >
                                                {inventoryByCategory.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Stock Levels vs Reorder Points</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={320} minHeight={200}>
                                        <BarChart data={productPerformance}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Bar dataKey="Current Stock" fill="#8884d8" />
                                            <Bar dataKey="Reorder Point" fill="#82ca9d" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}