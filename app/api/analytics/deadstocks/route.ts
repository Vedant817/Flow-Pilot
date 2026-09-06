import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Inventory } from "@/models/Inventory";
import { Order } from "@/models/Order";

interface IInventoryLean {
    _id: unknown;
    name: string;
    category: string;
    quantity: number;
    price: number;
    stock_alert_level: number;
    warehouse_location: string;
}

interface IOrderLean {
    _id: unknown;
    date: string;
    products: Array<{ name: string; quantity: number }>;
}

interface DeadstockItem {
    productId: string;
    productName: string;
    category: string;
    currentStock: number;
    stockValue: number;
    price: number;
    daysSinceLastSale: number;
    totalQuantitySold: number;
    lastSaleDate: string | null;
    averageMonthlyDemand: number;
    monthsOfStockRemaining: number;
    deadstockRisk: 'critical' | 'high' | 'medium' | 'low';
    recommendedAction: string;
    potentialLoss: number;
    warehouseLocation: string;
}

interface DeadstockAnalysisResult {
    deadstock_analysis: {
        critical_deadstock: DeadstockItem[];
        high_risk_items: DeadstockItem[];
        medium_risk_items: DeadstockItem[];
        low_risk_items: DeadstockItem[];
        summary: {
            total_items_analyzed: number;
            total_deadstock_value: number;
            critical_items_count: number;
            high_risk_items_count: number;
            potential_savings: number;
            analysis_date: string;
            recommendations: string[];
        };
    };
}

export async function GET(request: NextRequest) {
    try {
        await dbConnect();

        const url = new URL(request.url);
        const daysThreshold = parseInt(url.searchParams.get('days') || '90'); // Default 90 days
        const minStockValue = parseFloat(url.searchParams.get('minValue') || '0'); // Minimum stock value to consider
        const category = url.searchParams.get('category'); // Optional category filter

        const inventory = await Inventory.find(category ? { category } : {}).lean();
        const orders = await Order.find({}).lean();

        if (!inventory.length) {
            return NextResponse.json({
                deadstock_analysis: {
                    critical_deadstock: [],
                    high_risk_items: [],
                    medium_risk_items: [],
                    low_risk_items: [],
                    summary: {
                        total_items_analyzed: 0,
                        total_deadstock_value: 0,
                        critical_items_count: 0,
                        high_risk_items_count: 0,
                        potential_savings: 0,
                        analysis_date: new Date().toISOString(),
                        recommendations: []
                    }
                }
            });
        }

        const productSalesData = analyzeProductSales(orders);
        const currentDate = new Date();
        
        const deadstockItems: DeadstockItem[] = inventory.map(item => {
            const salesData = productSalesData[item.name] || {
                totalSold: 0,
                lastSaleDate: null,
                salesHistory: []
            };

            const daysSinceLastSale = salesData.lastSaleDate 
                ? Math.ceil((currentDate.getTime() - new Date(salesData.lastSaleDate).getTime()) / (1000 * 60 * 60 * 24))
                : 999;

            const stockValue = item.quantity * item.price;
            
            const averageMonthlyDemand = calculateAverageMonthlyDemand(salesData.salesHistory);
            const monthsOfStockRemaining = averageMonthlyDemand > 0 ? item.quantity / averageMonthlyDemand : 999;

            const riskLevel = determineDeadstockRisk(
                daysSinceLastSale, 
                monthsOfStockRemaining, 
                item.quantity, 
                item.stock_alert_level,
                averageMonthlyDemand
            );

            const { recommendedAction, potentialLoss } = generateRecommendations(
                item, 
                riskLevel, 
                stockValue, 
                daysSinceLastSale, 
                monthsOfStockRemaining
            );

            return {
                productId: item._id.toString(),
                productName: item.name,
                category: item.category,
                currentStock: item.quantity,
                stockValue: stockValue,
                price: item.price,
                daysSinceLastSale: daysSinceLastSale,
                totalQuantitySold: salesData.totalSold,
                lastSaleDate: salesData.lastSaleDate,
                averageMonthlyDemand: averageMonthlyDemand,
                monthsOfStockRemaining: monthsOfStockRemaining,
                deadstockRisk: riskLevel,
                recommendedAction: recommendedAction,
                potentialLoss: potentialLoss,
                warehouseLocation: item.warehouse_location
            };
        });

        const filteredItems = deadstockItems.filter(item => item.stockValue >= minStockValue);

        const criticalDeadstock = filteredItems.filter(item => 
            item.deadstockRisk === 'critical' && item.daysSinceLastSale >= daysThreshold
        );
        const highRiskItems = filteredItems.filter(item => 
            item.deadstockRisk === 'high' && item.daysSinceLastSale >= (daysThreshold * 0.7)
        );
        const mediumRiskItems = filteredItems.filter(item => 
            item.deadstockRisk === 'medium' && item.daysSinceLastSale >= (daysThreshold * 0.5)
        );
        const lowRiskItems = filteredItems.filter(item => 
            item.deadstockRisk === 'low' && item.daysSinceLastSale >= (daysThreshold * 0.3)
        );
        const totalDeadstockValue = criticalDeadstock.reduce((sum, item) => sum + item.stockValue, 0) +
                                   highRiskItems.reduce((sum, item) => sum + item.stockValue, 0);
        
        const potentialSavings = criticalDeadstock.reduce((sum, item) => sum + item.potentialLoss, 0) +
                               highRiskItems.reduce((sum, item) => sum + item.potentialLoss * 0.7, 0);

        const recommendations = generateGeneralRecommendations(
            criticalDeadstock.length,
            highRiskItems.length,
            totalDeadstockValue
        );

        const sortByPotentialLoss = (a: DeadstockItem, b: DeadstockItem) => b.potentialLoss - a.potentialLoss;
        
        criticalDeadstock.sort(sortByPotentialLoss);
        highRiskItems.sort(sortByPotentialLoss);
        mediumRiskItems.sort(sortByPotentialLoss);
        lowRiskItems.sort(sortByPotentialLoss);

        const result: DeadstockAnalysisResult = {
            deadstock_analysis: {
                critical_deadstock: criticalDeadstock,
                high_risk_items: highRiskItems,
                medium_risk_items: mediumRiskItems,
                low_risk_items: lowRiskItems,
                summary: {
                    total_items_analyzed: filteredItems.length,
                    total_deadstock_value: totalDeadstockValue,
                    critical_items_count: criticalDeadstock.length,
                    high_risk_items_count: highRiskItems.length,
                    potential_savings: potentialSavings,
                    analysis_date: new Date().toISOString(),
                    recommendations: recommendations
                }
            }
        };

        return NextResponse.json(result);

    } catch (error) {
        console.error("Error in deadstock analysis:", error);
        return NextResponse.json({
            error: "Failed to generate deadstock analysis",
            details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}

function analyzeProductSales(orders: IOrderLean[]) {
    const salesData: { [productName: string]: { totalSold: number; lastSaleDate: string | null; salesHistory: { date: string; quantity: number }[] } } = {};

    orders.forEach(order => {
        if (!order?.products || !Array.isArray(order.products)) return;

        order.products.forEach((product: { name: string; quantity: number }) => {
            if (!product?.name || typeof product.quantity !== 'number') return;

            const productName = product.name;
            if (!salesData[productName]) {
                salesData[productName] = {
                    totalSold: 0,
                    lastSaleDate: null,
                    salesHistory: []
                };
            }

            salesData[productName].totalSold += product.quantity;
            salesData[productName].salesHistory.push({
                date: order.date,
                quantity: product.quantity
            });

            if (!salesData[productName].lastSaleDate || 
                new Date(order.date) > new Date(salesData[productName].lastSaleDate!)) {
                salesData[productName].lastSaleDate = order.date;
            }
        });
    });

    return salesData;
}

function calculateAverageMonthlyDemand(salesHistory: { date: string; quantity: number }[]): number {
    if (!salesHistory.length) return 0;

    const currentDate = new Date();
    const sixMonthsAgo = new Date(currentDate.getTime() - (6 * 30 * 24 * 60 * 60 * 1000));

    const recentSales = salesHistory.filter(sale => new Date(sale.date) >= sixMonthsAgo);
    
    if (!recentSales.length) return 0;

    const totalQuantity = recentSales.reduce((sum, sale) => sum + sale.quantity, 0);
    const monthsOfData = Math.max(1, Math.ceil(recentSales.length / 4));
    
    return totalQuantity / monthsOfData;
}

function determineDeadstockRisk(
    daysSinceLastSale: number,
    monthsOfStockRemaining: number,
    currentStock: number,
    stockAlertLevel: number,
    averageMonthlyDemand: number
): 'critical' | 'high' | 'medium' | 'low' {
    
    if (daysSinceLastSale >= 120 || monthsOfStockRemaining >= 12 || currentStock > stockAlertLevel * 5) {
        return 'critical';
    }
    
    if (daysSinceLastSale >= 60 || monthsOfStockRemaining >= 6 || 
        (currentStock > stockAlertLevel * 3 && averageMonthlyDemand < 2)) {
        return 'high';
    }
    
    if (daysSinceLastSale >= 30 || monthsOfStockRemaining >= 3) {
        return 'medium';
    }
    
    return 'low';
}

function generateRecommendations(
    item: IInventoryLean,
    riskLevel: 'critical' | 'high' | 'medium' | 'low',
    stockValue: number,
    daysSinceLastSale: number,
    monthsOfStockRemaining: number
): { recommendedAction: string; potentialLoss: number } {
    
    let recommendedAction = "";
    let potentialLoss = 0;

    switch (riskLevel) {
        case 'critical':
            if (daysSinceLastSale >= 180) {
                recommendedAction = `URGENT: Liquidate immediately. Consider 40-60% discount, bundle deals, or donate for tax benefits. Product has been unsold for ${daysSinceLastSale} days.`;
                potentialLoss = stockValue * 0.5;
            } else {
                recommendedAction = `CRITICAL: Implement aggressive marketing, 30-40% discount, or consider product bundling. ${monthsOfStockRemaining.toFixed(1)} months of stock remaining.`;
                potentialLoss = stockValue * 0.35;
            }
            break;
            
        case 'high':
            recommendedAction = `HIGH PRIORITY: Apply 20-30% discount, run promotional campaigns, or consider seasonal clearance. ${monthsOfStockRemaining.toFixed(1)} months of stock at current demand.`;
            potentialLoss = stockValue * 0.25;
            break;
            
        case 'medium':
            recommendedAction = `MODERATE ACTION: Implement 10-20% promotional pricing, improve product visibility, or cross-sell with popular items.`;
            potentialLoss = stockValue * 0.15;
            break;
            
        case 'low':
            recommendedAction = `MONITOR: Regular stock level monitoring, consider slight promotional activities during peak seasons.`;
            potentialLoss = stockValue * 0.05;
            break;
    }

    return { recommendedAction, potentialLoss };
}

function generateGeneralRecommendations(
    criticalCount: number,
    highRiskCount: number,
    totalValue: number
): string[] {
    const recommendations: string[] = [];

    if (criticalCount > 0) {
        recommendations.push(`${criticalCount} critical deadstock items require immediate action to prevent total loss.`);
    }

    if (highRiskCount > 0) {
        recommendations.push(`${highRiskCount} high-risk items should be addressed within 30 days to minimize losses.`);
    }

    if (totalValue > 50000) {
        recommendations.push(`Total deadstock value of ₹${totalValue.toLocaleString()} represents significant capital tied up - consider liquidation strategies.`);
    }

    recommendations.push("Implement regular deadstock monitoring (weekly/monthly) to prevent future accumulation.");
    recommendations.push("Review purchasing patterns and demand forecasting to reduce future deadstock risk.");
    recommendations.push("Consider implementing just-in-time inventory management for slow-moving categories.");

    return recommendations;
}

export async function POST(request: NextRequest) {
    try {
        await dbConnect();
        
        const { action, productIds, discountPercentage, newPrice } = await request.json();

        if (!action || !productIds || !Array.isArray(productIds)) {
            return NextResponse.json({
                error: "Missing required fields: action and productIds array"
            }, { status: 400 });
        }

        const results = [];

        for (const productId of productIds) {
            const product = await Inventory.findById(productId);
            if (!product) {
                results.push({ productId, error: "Product not found" });
                continue;
            }

            switch (action) {
                case 'apply_discount':
                    if (!discountPercentage) {
                        results.push({ productId, error: "Discount percentage required" });
                        continue;
                    }
                    const discountedPrice = product.price * (1 - discountPercentage / 100);
                    product.price = Math.round(discountedPrice);
                    await product.save();
                    results.push({ 
                        productId, 
                        message: `Applied ${discountPercentage}% discount`,
                        oldPrice: product.price / (1 - discountPercentage / 100),
                        newPrice: product.price
                    });
                    break;

                case 'set_price':
                    if (!newPrice) {
                        results.push({ productId, error: "New price required" });
                        continue;
                    }
                    const oldPrice = product.price;
                    product.price = newPrice;
                    await product.save();
                    results.push({ 
                        productId, 
                        message: "Price updated successfully",
                        oldPrice,
                        newPrice
                    });
                    break;

                case 'mark_for_liquidation':
                    results.push({ 
                        productId, 
                        message: "Marked for liquidation - implement clearance strategy"
                    });
                    break;

                default:
                    results.push({ productId, error: "Invalid action" });
            }
        }

        return NextResponse.json({
            message: "Deadstock actions processed",
            results
        });

    } catch (error) {
        console.error("Error processing deadstock actions:", error);
        return NextResponse.json({
            error: "Failed to process deadstock actions",
            details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}