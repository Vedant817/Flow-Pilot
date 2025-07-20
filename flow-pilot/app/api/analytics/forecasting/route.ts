import { NextResponse } from "next/server";
import { Order } from "@/models/Order";
import { Inventory } from "@/models/Inventory";
import dbConnect from "@/lib/mongodb";

// Type definitions for database models
interface OrderDocument {
    _id: string;
    name: string;
    phone: string;
    email: string;
    date: string;
    time: string;
    products: Product[];
    status: string;
    orderLink: string;
}

interface InventoryDocument {
    _id: string;
    name: string;
    category: string;
    quantity: number;
    price: number;
    stock_alert_level: number;
    warehouse_location: string;
}

interface Product {
    name: string;
    quantity: number;
}

interface SalesData {
    [productName: string]: {
        totalSold: number;
        orderCount: number;
        averagePerOrder: number;
        lastOrderDate: Date;
        salesTrend: number[];
    };
}

interface InventoryWithAnalytics {
    _id: string;
    name: string;
    category: string;
    quantity: number;
    price: number;
    stock_alert_level: number;
    warehouse_location: string;
    dailySalesVelocity: number;
    weeklySalesVelocity: number;
    monthlySalesVelocity: number;
    averageOrderSize: number;
    daysUntilStockout: number;
    reorderPoint: number;
    economicOrderQuantity: number;
    seasonalityFactor: number;
    demandVariability: number;
    forecastAccuracy: number;
}

interface ForecastingResult {
    product: string;
    current_stock: number;
    recommended_stock: number;
    urgency_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    days_until_stockout: number;
    expected_daily_demand: number;
    reorder_point: number;
    economic_order_quantity: number;
    cost_impact: number;
    confidence_score: number;
    trend_direction: 'INCREASING' | 'STABLE' | 'DECREASING';
    seasonality_factor: number;
    reasons: string[];
    recommendations: string[];
}

interface AnalyticsResponse {
    urgent_restocking: ForecastingResult[];
    summary: {
        total_products_analyzed: number;
        critical_items: number;
        high_priority_items: number;
        total_estimated_cost: number;
        confidence_score: number;
    };
    generated_at: string;
    next_analysis_recommended: string;
}

class InventoryAnalytics {
    private salesData: SalesData = {};
    private inventoryData: InventoryWithAnalytics[] = [];
    private readonly DAYS_TO_ANALYZE = 30;
    private readonly LEAD_TIME_DAYS = 7;
    private readonly SERVICE_LEVEL = 0.95;
    private readonly Z_SCORE_95 = 1.645;

    constructor() {}

    private calculateMovingAverage(sales: number[], periods: number): number {
        if (sales.length < periods) return sales.reduce((a, b) => a + b, 0) / sales.length;
        const recent = sales.slice(-periods);
        return recent.reduce((a, b) => a + b, 0) / periods;
    }

    private calculateExponentialSmoothing(sales: number[], alpha: number = 0.3): number {
        if (sales.length === 0) return 0;
        if (sales.length === 1) return sales[0];
        
        let forecast = sales[0];
        for (let i = 1; i < sales.length; i++) {
            forecast = alpha * sales[i] + (1 - alpha) * forecast;
        }
        return forecast;
    }

    private calculateTrend(sales: number[]): { slope: number; direction: 'INCREASING' | 'STABLE' | 'DECREASING' } {
        if (sales.length < 2) return { slope: 0, direction: 'STABLE' };
        
        const n = sales.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const y = sales;
        
        const xMean = x.reduce((a, b) => a + b) / n;
        const yMean = y.reduce((a, b) => a + b) / n;
        
        const numerator = x.reduce((sum, xi, i) => sum + (xi - xMean) * (y[i] - yMean), 0);
        const denominator = x.reduce((sum, xi) => sum + Math.pow(xi - xMean, 2), 0);
        
        const slope = denominator === 0 ? 0 : numerator / denominator;
        
        let direction: 'INCREASING' | 'STABLE' | 'DECREASING' = 'STABLE';
        if (slope > 0.1) direction = 'INCREASING';
        else if (slope < -0.1) direction = 'DECREASING';
        
        return { slope, direction };
    }

    private calculateSeasonality(sales: number[]): number {
        if (sales.length < 7) return 1;
        
        const weeklyAverages: number[] = [];
        for (let i = 0; i < sales.length; i += 7) {
            const week = sales.slice(i, i + 7);
            if (week.length > 0) {
                weeklyAverages.push(week.reduce((a, b) => a + b) / week.length);
            }
        }
        
        if (weeklyAverages.length < 2) return 1;
        
        const overallAverage = weeklyAverages.reduce((a, b) => a + b) / weeklyAverages.length;
        const variance = weeklyAverages.reduce((sum, avg) => sum + Math.pow(avg - overallAverage, 2), 0) / weeklyAverages.length;
        const coefficient = Math.sqrt(variance) / overallAverage;
        
        return Math.max(1, 1 + coefficient);
    }

    private calculateEOQ(annualDemand: number, orderCost: number, holdingCost: number): number {
        if (annualDemand <= 0 || orderCost <= 0 || holdingCost <= 0) return 0;
        return Math.sqrt((2 * annualDemand * orderCost) / holdingCost);
    }

    private calculateStandardDeviation(sales: number[]): number {
        if (sales.length < 2) return 0;
        const mean = sales.reduce((a, b) => a + b) / sales.length;
        const variance = sales.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / sales.length;
        return Math.sqrt(variance);
    }

    private async processSalesData(orders: OrderDocument[]): Promise<void> {
        const salesByDay: { [date: string]: { [product: string]: number } } = {};
        
        orders.forEach(order => {
            const orderDate = new Date(order.date).toISOString().split('T')[0];
            if (!salesByDay[orderDate]) salesByDay[orderDate] = {};
            
            order.products.forEach((product: Product) => {
                const productName = product.name;
                if (!salesByDay[orderDate][productName]) {
                    salesByDay[orderDate][productName] = 0;
                }
                salesByDay[orderDate][productName] += product.quantity;
                
                if (!this.salesData[productName]) {
                    this.salesData[productName] = {
                        totalSold: 0,
                        orderCount: 0,
                        averagePerOrder: 0,
                        lastOrderDate: new Date(order.date),
                        salesTrend: []
                    };
                }
                
                this.salesData[productName].totalSold += product.quantity;
                this.salesData[productName].orderCount += 1;
                this.salesData[productName].lastOrderDate = new Date(order.date);
            });
        });

        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (this.DAYS_TO_ANALYZE * 24 * 60 * 60 * 1000));
        
        Object.keys(this.salesData).forEach(productName => {
            const dailySales: number[] = [];
            
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                dailySales.push(salesByDay[dateStr]?.[productName] || 0);
            }
            
            this.salesData[productName].salesTrend = dailySales;
            this.salesData[productName].averagePerOrder = 
                this.salesData[productName].orderCount > 0 
                    ? this.salesData[productName].totalSold / this.salesData[productName].orderCount 
                    : 0;
        });
    }

    private analyzeInventory(inventory: InventoryDocument[]): void {
        this.inventoryData = inventory.map(item => {
            const productSales = this.salesData[item.name] || {
                totalSold: 0,
                orderCount: 0,
                averagePerOrder: 0,
                lastOrderDate: new Date(),
                salesTrend: []
            };

            const dailySales = productSales.salesTrend;
            const dailyAverage = dailySales.length > 0 ? dailySales.reduce((a, b) => a + b) / dailySales.length : 0;
            const weeklyAverage = dailyAverage * 7;
            const monthlyAverage = dailyAverage * 30;

            const standardDeviation = this.calculateStandardDeviation(dailySales);
            const trend = this.calculateTrend(dailySales);
            const seasonalityFactor = this.calculateSeasonality(dailySales);

            const averageDemandDuringLeadTime = dailyAverage * this.LEAD_TIME_DAYS;
            const safetyStock = this.Z_SCORE_95 * standardDeviation * Math.sqrt(this.LEAD_TIME_DAYS);
            const reorderPoint = averageDemandDuringLeadTime + safetyStock;

            const annualDemand = dailyAverage * 365;
            const estimatedOrderCost = 50;
            const estimatedHoldingCost = item.price * 0.25;
            const eoq = this.calculateEOQ(annualDemand, estimatedOrderCost, estimatedHoldingCost);

            const daysUntilStockout = dailyAverage > 0 ? Math.floor(item.quantity / dailyAverage) : 999;

            const demandVariability = dailyAverage > 0 ? standardDeviation / dailyAverage : 0;

            const forecastAccuracy = Math.max(0.5, 1 - Math.abs(trend.slope) * 0.1 - demandVariability * 0.2);

            return {
                ...item,
                dailySalesVelocity: dailyAverage,
                weeklySalesVelocity: weeklyAverage,
                monthlySalesVelocity: monthlyAverage,
                averageOrderSize: productSales.averagePerOrder,
                daysUntilStockout,
                reorderPoint,
                economicOrderQuantity: eoq,
                seasonalityFactor,
                demandVariability,
                forecastAccuracy
            };
        });
    }

    private generateForecastingResults(): ForecastingResult[] {
        return this.inventoryData
            .filter(item => {
                return (
                    item.quantity <= item.reorderPoint ||
                    item.quantity <= item.stock_alert_level ||
                    item.daysUntilStockout <= 14
                );
            })
            .map(item => {
                const recommendedStock = Math.max(
                    item.reorderPoint + item.economicOrderQuantity,
                    item.stock_alert_level * 2,
                    item.dailySalesVelocity * 30
                );

                let urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
                if (item.daysUntilStockout <= 3) urgencyLevel = 'CRITICAL';
                else if (item.daysUntilStockout <= 7) urgencyLevel = 'HIGH';
                else if (item.daysUntilStockout <= 14) urgencyLevel = 'MEDIUM';

                const trend = this.calculateTrend(this.salesData[item.name]?.salesTrend || []);
                
                const costImpact = (recommendedStock - item.quantity) * item.price;

                const reasons: string[] = [];
                const recommendations: string[] = [];

                if (item.quantity <= item.stock_alert_level) {
                    reasons.push("Stock below alert level");
                }
                if (item.daysUntilStockout <= 7) {
                    reasons.push(`Will run out in ${item.daysUntilStockout} days`);
                }
                if (trend.direction === 'INCREASING') {
                    reasons.push("Increasing demand trend detected");
                    recommendations.push("Consider increasing regular order quantity");
                }
                if (item.seasonalityFactor > 1.2) {
                    reasons.push("High demand variability detected");
                    recommendations.push("Maintain higher safety stock levels");
                }

                recommendations.push(`Reorder when stock reaches ${Math.round(item.reorderPoint)} units`);
                if (item.economicOrderQuantity > 0) {
                    recommendations.push(`Optimal order quantity: ${Math.round(item.economicOrderQuantity)} units`);
                }

                return {
                    product: item.name,
                    current_stock: item.quantity,
                    recommended_stock: Math.round(recommendedStock),
                    urgency_level: urgencyLevel,
                    days_until_stockout: item.daysUntilStockout,
                    expected_daily_demand: Math.round(item.dailySalesVelocity * 100) / 100,
                    reorder_point: Math.round(item.reorderPoint),
                    economic_order_quantity: Math.round(item.economicOrderQuantity),
                    cost_impact: Math.round(costImpact * 100) / 100,
                    confidence_score: Math.round(item.forecastAccuracy * 100) / 100,
                    trend_direction: trend.direction,
                    seasonality_factor: Math.round(item.seasonalityFactor * 100) / 100,
                    reasons,
                    recommendations
                };
            })
            .sort((a, b) => {
                const urgencyOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
                const urgencyDiff = urgencyOrder[a.urgency_level] - urgencyOrder[b.urgency_level];
                if (urgencyDiff !== 0) return urgencyDiff;
                return a.days_until_stockout - b.days_until_stockout;
            });
    }

    async performAnalysis(): Promise<AnalyticsResponse> {
        try {
            await dbConnect();

            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
            
            const orders = await Order.find({
                date: {
                    $gte: sixtyDaysAgo.toISOString().split('T')[0]
                }
            }).lean() as unknown as OrderDocument[];

            const inventory = await Inventory.find({}).lean() as unknown as InventoryDocument[];

            if (!orders || !inventory) {
                throw new Error("Unable to fetch required data");
            }

            await this.processSalesData(orders);
            this.analyzeInventory(inventory);

            const urgentRestocking = this.generateForecastingResults();

            const summary = {
                total_products_analyzed: inventory.length,
                critical_items: urgentRestocking.filter(item => item.urgency_level === 'CRITICAL').length,
                high_priority_items: urgentRestocking.filter(item => ['CRITICAL', 'HIGH'].includes(item.urgency_level)).length,
                total_estimated_cost: urgentRestocking.reduce((sum, item) => sum + item.cost_impact, 0),
                confidence_score: urgentRestocking.length > 0 
                    ? urgentRestocking.reduce((sum, item) => sum + item.confidence_score, 0) / urgentRestocking.length 
                    : 0
            };

            const now = new Date();
            const nextAnalysis = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next day

            return {
                urgent_restocking: urgentRestocking,
                summary: {
                    ...summary,
                    total_estimated_cost: Math.round(summary.total_estimated_cost * 100) / 100,
                    confidence_score: Math.round(summary.confidence_score * 100) / 100
                },
                generated_at: now.toISOString(),
                next_analysis_recommended: nextAnalysis.toISOString()
            };

        } catch (error) {
            console.error("Error in inventory analysis:", error);
            throw error;
        }
    }
}

export async function GET(): Promise<NextResponse> {
    try {
        const analytics = new InventoryAnalytics();
        const results = await analytics.performAnalysis();
        
        return NextResponse.json(results, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
    } catch (error) {
        console.error("Analytics API Error:", error);
        return NextResponse.json(
            { 
                error: "Failed to generate inventory analytics",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

export async function POST(): Promise<NextResponse> {
    return NextResponse.json({ message: "POST method not implemented yet" }, { status: 501 });
}