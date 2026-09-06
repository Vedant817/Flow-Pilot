// Define interfaces for lean documents
interface OrderLean {
    _id: unknown;
    date: string;
    name: string;
    email: string;
    products?: Array<{ name: string; quantity: number }>;
}

interface InventoryLean {
    _id: unknown;
    name: string;
    category: string;
    quantity: number;
    price: number;
    stock_alert_level: number;
}

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { Inventory } from "@/models/Inventory";

interface ProductAnalytics {
    productSales: {
        labels: string[];
        datasets: Array<{
            label: string;
            data: number[];
            backgroundColor: string;
        }>;
    };
    revenuePerDay: {
        dates: string[];
        revenues: number[];
    };
}

export async function GET(request: NextRequest) {
    try {
        await dbConnect();

        // Get query parameters for customization
        const url = new URL(request.url);
        const days = parseInt(url.searchParams.get('days') || '30');

        const orders = await Order.find({}).lean();
        const inventory = await Inventory.find({}).lean();

        if (!orders.length) {
            return NextResponse.json({
                productSales: { labels: [], datasets: [] },
                revenuePerDay: { dates: [], revenues: [] }
            });
        }

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        // Generate product sales data
        const productSales = generateProductSalesData(orders, inventory);
        
        // Generate revenue per day data
        const revenuePerDay = generateRevenuePerDay(orders, inventory, startDate, endDate);

        const result: ProductAnalytics = {
            productSales,
            revenuePerDay
        };

        return NextResponse.json(result);

    } catch (error) {
        console.error("Error in product analytics:", error);
        return NextResponse.json({
            error: "Failed to generate product analytics",
            details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}

function generateProductSalesData(orders: OrderLean[], inventory: InventoryLean[]) {
    const productSales = new Map<string, number>();

    // Create inventory price map for revenue calculation
    const priceMap = new Map<string, number>();
    inventory.forEach(item => {
        priceMap.set(item.name, item.price || 0);
    });

    // Count product sales
    orders.forEach(order => {
        if (order.products && Array.isArray(order.products)) {
            order.products.forEach((product) => {
                if (product.name && typeof product.quantity === 'number') {
                    const currentSales = productSales.get(product.name) || 0;
                    productSales.set(product.name, currentSales + product.quantity);
                }
            });
        }
    });

    // Sort products by sales volume and take top 10 and bottom 5
    const sortedProducts = Array.from(productSales.entries())
        .sort(([, a], [, b]) => b - a);

    const topProducts = sortedProducts.slice(0, 10);
    const bottomProducts = sortedProducts.slice(-5).reverse();

    // Combine for chart display
    const allProductsForChart = [...topProducts, ...bottomProducts];
    
    const labels = allProductsForChart.map(([name]) => name.length > 20 ? name.substring(0, 17) + '...' : name);
    const salesData = allProductsForChart.map(([, quantity]) => quantity);
    
    // Generate revenue data (quantity * price)
    const revenueData = allProductsForChart.map(([name, quantity]) => {
        const price = priceMap.get(name) || 50; // Default price if not found
        return quantity * price;
    });

    return {
        labels,
        datasets: [
            {
                label: 'Units Sold',
                data: salesData,
                backgroundColor: 'rgba(59, 130, 246, 0.8)' // Blue
            },
            {
                label: 'Revenue (₹)',
                data: revenueData,
                backgroundColor: 'rgba(16, 185, 129, 0.8)' // Green
            }
        ]
    };
}

function generateRevenuePerDay(orders: OrderLean[], inventory: InventoryLean[], startDate: Date, endDate: Date) {
    const dateMap = new Map<string, number>();
    
    // Create inventory price map
    const priceMap = new Map<string, number>();
    inventory.forEach(item => {
        priceMap.set(item.name, item.price || 0);
    });

    // Initialize all dates in range with 0
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        dateMap.set(dateStr, 0);
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate revenue by date
    orders.forEach(order => {
        const orderDate = new Date(order.date);
        if (orderDate >= startDate && orderDate <= endDate) {
            const dateStr = orderDate.toISOString().split('T')[0];
            
            // Calculate order total revenue
            let orderRevenue = 0;
            if (order.products && Array.isArray(order.products)) {
                order.products.forEach((product) => {
                    if (product.name && typeof product.quantity === 'number') {
                        const price = priceMap.get(product.name) || 50; // Default price
                        orderRevenue += product.quantity * price;
                    }
                });
            }
            
            dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + orderRevenue);
        }
    });

    // Convert to arrays sorted by date
    const sortedEntries = Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    
    return {
        dates: sortedEntries.map(([date]) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        revenues: sortedEntries.map(([, revenue]) => Math.round(revenue))
    };
}