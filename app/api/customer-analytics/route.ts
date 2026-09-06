interface OrderLean {
    _id: unknown;
    date: string;
    name: string;
    email: string;
    products?: Array<{ name: string; quantity: number }>;
}

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Order } from "@/models/Order";

interface CustomerAnalytics {
    orderTrends: {
        dates: string[];
        counts: number[];
    };
    frequentCustomers: {
        names: string[];
        counts: number[];
    };
    topSpenders: {
        names: string[];
        amounts: number[];
    };
}

export async function GET(request: NextRequest) {
    try {
        await dbConnect();

        const url = new URL(request.url);
        const days = parseInt(url.searchParams.get('days') || '30');

        const orders = await Order.find({}).lean();

        if (!orders.length) {
            return NextResponse.json({
                orderTrends: { dates: [], counts: [] },
                frequentCustomers: { names: [], counts: [] },
                topSpenders: { names: [], amounts: [] }
            });
        }

        // Calculate date range for trends
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        // Generate order trends data
        const orderTrends = generateOrderTrends(orders, startDate, endDate);
        
        // Generate frequent customers data
        const frequentCustomers = generateFrequentCustomers(orders);
        
        // Generate top spenders data
        const topSpenders = generateTopSpenders(orders);

        const result: CustomerAnalytics = {
            orderTrends,
            frequentCustomers,
            topSpenders
        };

        return NextResponse.json(result);

    } catch (error) {
        console.error("Error in customer analytics:", error);
        return NextResponse.json({
            error: "Failed to generate customer analytics",
            details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}

function generateOrderTrends(orders: OrderLean[], startDate: Date, endDate: Date) {
    const dateMap = new Map<string, number>();
    
    // Initialize all dates in range with 0
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        dateMap.set(dateStr, 0);
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Count orders by date
    orders.forEach(order => {
        const orderDate = new Date(order.date);
        if (orderDate >= startDate && orderDate <= endDate) {
            const dateStr = orderDate.toISOString().split('T')[0];
            dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
        }
    });

    // Convert to arrays sorted by date
    const sortedEntries = Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    
    return {
        dates: sortedEntries.map(([date]) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        counts: sortedEntries.map(([, count]) => count)
    };
}

function generateFrequentCustomers(orders: OrderLean[]) {
    const customerMap = new Map<string, number>();

    // Count orders per customer
    orders.forEach(order => {
        const customerName = order.name || 'Unknown';
        customerMap.set(customerName, (customerMap.get(customerName) || 0) + 1);
    });

    // Sort by frequency and take top 10
    const sortedCustomers = Array.from(customerMap.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

    return {
        names: sortedCustomers.map(([name]) => name),
        counts: sortedCustomers.map(([, count]) => count)
    };
}

function generateTopSpenders(orders: OrderLean[]) {
    const customerSpending = new Map<string, number>();

    // Calculate spending per customer (based on number of products as proxy for spending)
    orders.forEach(order => {
        const customerName = order.name || 'Unknown';
        const totalProducts = order.products?.reduce((sum: number, product) => sum + (product.quantity || 0), 0) || 0;
        // Using product count * 100 as proxy for spending amount
        const estimatedSpending = totalProducts * 100;
        
        customerSpending.set(customerName, (customerSpending.get(customerName) || 0) + estimatedSpending);
    });

    // Sort by spending and take top 10
    const sortedSpenders = Array.from(customerSpending.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

    return {
        names: sortedSpenders.map(([name]) => name),
        amounts: sortedSpenders.map(([, amount]) => Math.round(amount))
    };
}