// Define interfaces for lean documents
interface OrderLean {
    _id: unknown;
    date: string;
    name: string;
    email: string;
    status: string;
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

interface OverviewAnalytics {
    summary: {
        totalOrders: number;
        totalRevenue: number;
        averageOrderValue: number;
        totalProducts: number;
        totalCustomers: number;
        revenueGrowth: number;
        orderGrowth: number;
        topSellingProduct: string;
    };
    recentActivity: {
        recentOrders: number;
        pendingOrders: number;
        fulfilledOrders: number;
        lowStockItems: number;
    };
    performanceMetrics: {
        conversionRate: number;
        fulfillmentRate: number;
        averageProcessingTime: string;
        customerSatisfaction: number;
    };
    chartData: {
        orderTrends: {
            dates: string[];
            orders: number[];
            revenue: number[];
        };
        productPerformance: {
            categories: string[];
            sales: number[];
        };
        customerInsights: {
            newCustomers: number;
            returningCustomers: number;
            topSpenders: Array<{ name: string; amount: number }>;
        };
    };
}

export async function GET(request: NextRequest) {
    try {
        await dbConnect();

        // Get query parameters
        const url = new URL(request.url);
        const days = parseInt(url.searchParams.get('days') || '30');

        const orders = await Order.find({}).lean();
        const inventory = await Inventory.find({}).lean();

        // Calculate date ranges
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        const prevStartDate = new Date();
        prevStartDate.setDate(endDate.getDate() - (days * 2));
        const prevEndDate = new Date();
        prevEndDate.setDate(endDate.getDate() - days);

        // Generate analytics data
        const summary = generateSummary(orders, inventory, startDate, endDate, prevStartDate, prevEndDate);
        const recentActivity = generateRecentActivity(orders, inventory, startDate, endDate);
        const performanceMetrics = generatePerformanceMetrics(orders, startDate, endDate);
        const chartData = generateChartData(orders, inventory, startDate, endDate);

        const result: OverviewAnalytics = {
            summary,
            recentActivity,
            performanceMetrics,
            chartData
        };

        return NextResponse.json(result);

    } catch (error) {
        console.error("Error in analytics overview:", error);
        return NextResponse.json({
            error: "Failed to generate analytics overview",
            details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}

function generateSummary(orders: OrderLean[], inventory: InventoryLean[], startDate: Date, endDate: Date, prevStartDate: Date, prevEndDate: Date) {
    // Create price map
    const priceMap = new Map<string, number>();
    inventory.forEach(item => {
        priceMap.set(item.name, item.price || 0);
    });

    // Current period orders
    const currentOrders = orders.filter(order => {
        const orderDate = new Date(order.date);
        return orderDate >= startDate && orderDate <= endDate;
    });

    // Previous period orders
    const previousOrders = orders.filter(order => {
        const orderDate = new Date(order.date);
        return orderDate >= prevStartDate && orderDate <= prevEndDate;
    });

    // Calculate totals
    const totalOrders = currentOrders.length;
    const prevTotalOrders = previousOrders.length;

    let totalRevenue = 0;
    let prevTotalRevenue = 0;
    const uniqueCustomers = new Set<string>();

    // Calculate current period revenue
    currentOrders.forEach(order => {
        uniqueCustomers.add(order.email || order.name);
        if (order.products && Array.isArray(order.products)) {
            order.products.forEach((product) => {
                if (product.name && typeof product.quantity === 'number') {
                    const price = priceMap.get(product.name) || 50;
                    totalRevenue += product.quantity * price;
                }
            });
        }
    });

    // Calculate previous period revenue
    previousOrders.forEach(order => {
        if (order.products && Array.isArray(order.products)) {
            order.products.forEach((product) => {
                if (product.name && typeof product.quantity === 'number') {
                    const price = priceMap.get(product.name) || 50;
                    prevTotalRevenue += product.quantity * price;
                }
            });
        }
    });

    // Find top selling product
    const productSales = new Map<string, number>();
    currentOrders.forEach(order => {
        if (order.products && Array.isArray(order.products)) {
            order.products.forEach((product) => {
                if (product.name && typeof product.quantity === 'number') {
                    productSales.set(product.name, (productSales.get(product.name) || 0) + product.quantity);
                }
            });
        }
    });

    const topSellingProduct = productSales.size > 0 
        ? Array.from(productSales.entries()).sort(([, a], [, b]) => b - a)[0][0]
        : 'No sales data';

    // Calculate growth rates
    const revenueGrowth = prevTotalRevenue > 0 
        ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 
        : 0;

    const orderGrowth = prevTotalOrders > 0 
        ? ((totalOrders - prevTotalOrders) / prevTotalOrders) * 100 
        : 0;

    return {
        totalOrders,
        totalRevenue: Math.round(totalRevenue),
        averageOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
        totalProducts: inventory.length,
        totalCustomers: uniqueCustomers.size,
        revenueGrowth: Math.round(revenueGrowth * 100) / 100,
        orderGrowth: Math.round(orderGrowth * 100) / 100,
        topSellingProduct
    };
}

function generateRecentActivity(orders: OrderLean[], inventory: InventoryLean[], startDate: Date, endDate: Date) {
    const recentOrders = orders.filter(order => {
        const orderDate = new Date(order.date);
        return orderDate >= startDate && orderDate <= endDate;
    }).length;

    const pendingOrders = orders.filter(order => order.status === 'pending fulfillment').length;
    const fulfilledOrders = orders.filter(order => order.status === 'fulfilled').length;
    const lowStockItems = inventory.filter(item => item.quantity <= item.stock_alert_level).length;

    return {
        recentOrders,
        pendingOrders,
        fulfilledOrders,
        lowStockItems
    };
}

function generatePerformanceMetrics(orders: OrderLean[], startDate: Date, endDate: Date) {
    const recentOrders = orders.filter(order => {
        const orderDate = new Date(order.date);
        return orderDate >= startDate && orderDate <= endDate;
    });

    const totalOrders = recentOrders.length;
    const fulfilledOrders = recentOrders.filter(order => order.status === 'fulfilled').length;

    return {
        conversionRate: 85.5, // Mock data - would need website traffic data
        fulfillmentRate: totalOrders > 0 ? Math.round((fulfilledOrders / totalOrders) * 100) : 0,
        averageProcessingTime: '2.3 hours', // Mock data - would need actual processing time tracking
        customerSatisfaction: 4.2 // Mock data - would come from feedback system
    };
}

function generateChartData(orders: OrderLean[], inventory: InventoryLean[], startDate: Date, endDate: Date) {
    // Create price map
    const priceMap = new Map<string, number>();
    inventory.forEach(item => {
        priceMap.set(item.name, item.price || 0);
    });

    // Generate order trends
    const dateMap = new Map<string, { orders: number; revenue: number }>();
    
    // Initialize all dates
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        dateMap.set(dateStr, { orders: 0, revenue: 0 });
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Fill in actual data
    orders.forEach(order => {
        const orderDate = new Date(order.date);
        if (orderDate >= startDate && orderDate <= endDate) {
            const dateStr = orderDate.toISOString().split('T')[0];
            const current = dateMap.get(dateStr) || { orders: 0, revenue: 0 };
            
            current.orders += 1;
            
            if (order.products && Array.isArray(order.products)) {
                order.products.forEach((product) => {
                    if (product.name && typeof product.quantity === 'number') {
                        const price = priceMap.get(product.name) || 50;
                        current.revenue += product.quantity * price;
                    }
                });
            }
            
            dateMap.set(dateStr, current);
        }
    });

    const sortedDates = Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    
    const orderTrends = {
        dates: sortedDates.map(([date]) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        orders: sortedDates.map(([, data]) => data.orders),
        revenue: sortedDates.map(([, data]) => Math.round(data.revenue))
    };

    // Generate product performance by category
    const categoryMap = new Map<string, number>();
    inventory.forEach(item => {
        categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + (item.quantity || 0));
    });

    const productPerformance = {
        categories: Array.from(categoryMap.keys()),
        sales: Array.from(categoryMap.values())
    };

    // Generate customer insights
    const customerSpending = new Map<string, number>();
    orders.forEach(order => {
        const customer = order.email || order.name || 'Unknown';
        let orderValue = 0;
        
        if (order.products && Array.isArray(order.products)) {
            order.products.forEach((product) => {
                if (product.name && typeof product.quantity === 'number') {
                    const price = priceMap.get(product.name) || 50;
                    orderValue += product.quantity * price;
                }
            });
        }
        
        customerSpending.set(customer, (customerSpending.get(customer) || 0) + orderValue);
    });

    const topSpenders = Array.from(customerSpending.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, amount]) => ({ name, amount: Math.round(amount) }));

    const customerInsights = {
        newCustomers: Math.floor(customerSpending.size * 0.3), // Mock: 30% new customers
        returningCustomers: Math.floor(customerSpending.size * 0.7), // Mock: 70% returning
        topSpenders
    };

    return {
        orderTrends,
        productPerformance,
        customerInsights
    };
}