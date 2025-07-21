
import { NextResponse } from "next/server";
import { Order } from "@/models/Order";
import { Inventory } from "@/models/Inventory";
import dbConnect from "@/lib/mongodb";

// Enhanced Type definitions
interface Product {
    name: string;
    quantity: number;
}

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
    _id:string;
    name: string;
    category: string;
    quantity: number;
    price: number;
    stock_alert_level: number;
    warehouse_location: string;
    // Enterprise-level parameters
    supplier_lead_time_days?: number;
    supplier_reliability_score?: number; // 0 to 1
    product_lifecycle_stage?: 'new' | 'growth' | 'maturity' | 'decline';
}

interface SalesData {
    [productName: string]: {
        totalSold: number;
        orderCount: number;
        averagePerOrder: number;
        lastOrderDate: Date;
        salesTrend: number[]; // Daily sales for the analysis period
    };
}

interface InventoryWithAnalytics extends InventoryDocument {
    dailySalesVelocity: number;
    weeklySalesVelocity: number;
    monthlySalesVelocity: number;
    averageOrderSize: number;
    daysUntilStockout: number;
    reorderPoint: number;
    safetyStock: number;
    economicOrderQuantity: number;
    demandVariability: number; // Coefficient of variation
    forecastedDemand: number;
    confidenceScore: number;
}

interface ForecastingResult {
    product: string;
    current_stock: number;
    recommended_stock: number;
    urgency_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    days_until_stockout: number;
    projected_stockout_date: string;
    expected_daily_demand: number;
    reorder_point: number;
    economic_order_quantity: number;
    cost_impact: number;
    confidence_score: number;
    trend_direction: 'INCREASING' | 'STABLE' | 'DECREASING';
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
        average_confidence_score: number;
    };
    generated_at: string;
    next_analysis_recommended: string;
}

class AdvancedInventoryAnalytics {
    private salesData: SalesData = {};
    private inventoryData: InventoryWithAnalytics[] = [];
    private readonly DAYS_TO_ANALYZE = 90; // Extended for better trend analysis
    private readonly DEFAULT_LEAD_TIME_DAYS = 7;
    private readonly SERVICE_LEVEL = 0.95; // 95% service level
    private readonly Z_SCORE_95 = 1.645; // Z-score for 95% confidence

    constructor() {}

    private seasonalTrendSmoothing(data: number[], seasonalPeriod: number, alpha: number, beta: number, gamma: number): { forecast: number[], trend: 'INCREASING' | 'STABLE' | 'DECREASING' } {
        if (data.length < seasonalPeriod) {
            const simpleAvg = data.reduce((a, b) => a + b, 0) / data.length || 0;
            const direction = this.calculateTrend(data).direction;
            return { forecast: new Array(data.length).fill(simpleAvg), trend: direction };
        }

        let level = data.slice(0, seasonalPeriod).reduce((a, b) => a + b, 0) / seasonalPeriod;
        let trend = (data[seasonalPeriod - 1] - data[0]) / (seasonalPeriod - 1) || 0;
        const seasonal = new Array(seasonalPeriod).fill(0).map((_, i) => data[i] - level);
        
        const forecast: number[] = [];
        for (let i = 0; i < data.length; i++) {
            if (i < seasonalPeriod) {
                forecast.push(data[i]);
                continue;
            }
            
            const lastLevel = level;
            const lastTrend = trend;
            
            level = alpha * (data[i] - seasonal[i % seasonalPeriod]) + (1 - alpha) * (lastLevel + lastTrend);
            trend = beta * (level - lastLevel) + (1 - beta) * lastTrend;
            seasonal[i % seasonalPeriod] = gamma * (data[i] - level) + (1 - gamma) * seasonal[i % seasonalPeriod];
            
            const nextForecast = level + trend + seasonal[(i + 1) % seasonalPeriod];
            forecast.push(Math.max(0, nextForecast));
        }

        const overallTrendDirection = this.calculateTrend(forecast.slice(-30)).direction; // Trend over the last 30 days

        return { forecast, trend: overallTrendDirection };
    }

    // More sophisticated forecasting using weighted moving average
    private weightedMovingAverage(data: number[], weights: number[]): number {
        if (data.length === 0 || weights.length === 0) return 0;
        const recentData = data.slice(-weights.length);
        let weightedSum = 0;
        let weightSum = 0;
        for (let i = 0; i < recentData.length; i++) {
            weightedSum += recentData[i] * weights[i];
            weightSum += weights[i];
        }
        return weightSum > 0 ? weightedSum / weightSum : 0;
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
        if (slope > 0.15) direction = 'INCREASING'; // Higher threshold for significance
        else if (slope < -0.15) direction = 'DECREASING';
        
        return { slope, direction };
    }

    private calculateStandardDeviation(values: number[]): number {
        if (values.length < 2) return 0;
        const mean = values.reduce((a, b) => a + b) / values.length;
        const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / (values.length - 1); // Use sample stdev
        return Math.sqrt(variance);
    }

    private calculateEOQ(annualDemand: number, orderCost: number, holdingCostRate: number, itemPrice: number): number {
        if (annualDemand <= 0 || orderCost <= 0 || holdingCostRate <= 0 || itemPrice <= 0) return 0;
        const holdingCost = itemPrice * holdingCostRate;
        return Math.sqrt((2 * annualDemand * orderCost) / holdingCost);
    }

    private async processSalesData(orders: OrderDocument[]): Promise<void> {
        const salesByDay: { [date: string]: { [product: string]: number } } = {};
        
        orders.forEach(order => {
            const orderDate = new Date(order.date).toISOString().split('T')[0];
            if (!salesByDay[orderDate]) salesByDay[orderDate] = {};
            
            order.products.forEach(product => {
                const productName = product.name;
                salesByDay[orderDate][productName] = (salesByDay[orderDate][productName] || 0) + product.quantity;
                
                if (!this.salesData[productName]) {
                    this.salesData[productName] = {
                        totalSold: 0,
                        orderCount: 0,
                        averagePerOrder: 0,
                        lastOrderDate: new Date(0),
                        salesTrend: []
                    };
                }
                
                this.salesData[productName].totalSold += product.quantity;
                this.salesData[productName].orderCount += 1;
                if (new Date(order.date) > this.salesData[productName].lastOrderDate) {
                    this.salesData[productName].lastOrderDate = new Date(order.date);
                }
            });
        });

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - this.DAYS_TO_ANALYZE);
        
        const allProductNames = Object.keys(this.salesData);

        for (const productName of allProductNames) {
            const dailySales: number[] = [];
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                dailySales.push(salesByDay[dateStr]?.[productName] || 0);
            }
            this.salesData[productName].salesTrend = dailySales;
            this.salesData[productName].averagePerOrder = this.salesData[productName].totalSold / this.salesData[productName].orderCount;
        }
    }

    private analyzeInventory(inventory: InventoryDocument[]): void {
        this.inventoryData = inventory.map(item => {
            const productSales = this.salesData[item.name] || { salesTrend: [], averagePerOrder: 0, lastOrderDate: new Date(0) };
            const dailySales = productSales.salesTrend;

            // Advanced Forecasting using Seasonal-Trend Smoothing
            const { forecast, trend: forecastedTrend } = this.seasonalTrendSmoothing(dailySales, 7, 0.2, 0.1, 0.1);
            const forecastedDemand = forecast[forecast.length - 1] || 0;

            const dailyAverage = dailySales.length > 0 ? dailySales.reduce((a, b) => a + b) / dailySales.length : 0;
            const standardDeviation = this.calculateStandardDeviation(dailySales);
            
            const leadTime = item.supplier_lead_time_days || this.DEFAULT_LEAD_TIME_DAYS;
            
            const reliabilityFactor = 1 / (item.supplier_reliability_score || 0.9);
            const safetyStock = this.Z_SCORE_95 * standardDeviation * Math.sqrt(leadTime) * reliabilityFactor;

            const reorderPoint = (forecastedDemand * leadTime) + safetyStock;

            const annualDemand = forecastedDemand * 365;
            const estimatedOrderCost = 50;
            const estimatedHoldingCostRate = 0.25;
            const eoq = this.calculateEOQ(annualDemand, estimatedOrderCost, estimatedHoldingCostRate, item.price);

            const daysUntilStockout = forecastedDemand > 0 ? Math.floor(item.quantity / forecastedDemand) : Infinity;
            
            const demandVariability = dailyAverage > 0 ? standardDeviation / dailyAverage : 0;

            // Confidence score based on data volume, variability, and recency
            const daysSinceLastSale = (new Date().getTime() - productSales.lastOrderDate.getTime()) / (1000 * 3600 * 24);
            const recencyScore = Math.max(0, 1 - (daysSinceLastSale / this.DAYS_TO_ANALYZE));
            const confidenceScore = Math.max(0.5, (1 - demandVariability) * (dailySales.length / this.DAYS_TO_ANALYZE) * recencyScore);

            return {
                ...item,
                dailySalesVelocity: dailyAverage,
                weeklySalesVelocity: dailyAverage * 7,
                monthlySalesVelocity: dailyAverage * 30,
                averageOrderSize: productSales.averagePerOrder,
                daysUntilStockout,
                reorderPoint,
                safetyStock,
                economicOrderQuantity: eoq,
                demandVariability,
                forecastedDemand,
                forecastedTrend,
                confidenceScore
            };
        });
    }

    private generateForecastingResults(): ForecastingResult[] {
        return this.inventoryData
            .filter(item => item.quantity <= item.reorderPoint || item.daysUntilStockout <= (item.supplier_lead_time_days || this.DEFAULT_LEAD_TIME_DAYS) + 7)
            .map(item => {
                const trend = this.calculateTrend(this.salesData[item.name]?.salesTrend || []).direction;
                
                let lifecycleMultiplier = 1.0;
                switch(item.product_lifecycle_stage) {
                    case 'new': lifecycleMultiplier = 1.5; break;
                    case 'growth': lifecycleMultiplier = 1.2; break;
                    case 'decline': lifecycleMultiplier = 0.8; break;
                }

                const recommendedStock = Math.max(
                    item.reorderPoint + item.economicOrderQuantity,
                    item.stock_alert_level * 1.5
                ) * lifecycleMultiplier;

                let urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
                const leadTime = item.supplier_lead_time_days || this.DEFAULT_LEAD_TIME_DAYS;
                if (item.daysUntilStockout <= leadTime / 2) urgencyLevel = 'CRITICAL';
                else if (item.daysUntilStockout <= leadTime) urgencyLevel = 'HIGH';
                else if (item.daysUntilStockout <= leadTime + 7) urgencyLevel = 'MEDIUM';

                const costImpact = Math.max(0, (recommendedStock - item.quantity)) * item.price;

                const reasons: string[] = [];
                if (item.quantity <= item.reorderPoint) reasons.push(`Stock (${item.quantity}) is below reorder point (${Math.round(item.reorderPoint)})`);
                if (item.daysUntilStockout <= leadTime) reasons.push(`Projected to stock out in ${item.daysUntilStockout} days, which is within the lead time of ${leadTime} days.`);
                if (trend === 'INCREASING') reasons.push("Demand trend is increasing.");
                if (item.demandVariability > 0.5) reasons.push("High demand volatility detected.");
                if (item.product_lifecycle_stage === 'growth') reasons.push("Product is in a growth stage.");

                const recommendations: string[] = [];
                recommendations.push(`Order at least ${Math.round(recommendedStock - item.quantity)} units to reach recommended stock level.`);
                if (item.economicOrderQuantity > 0) recommendations.push(`Optimal order quantity is ~${Math.round(item.economicOrderQuantity)} units to balance costs.`);
                if (trend === 'INCREASING') recommendations.push("Consider adjusting baseline forecast upwards.");
                if ((item.supplier_reliability_score || 1) < 0.9) recommendations.push(`Supplier reliability is low (${item.supplier_reliability_score}), justifying higher safety stock.`);
                if (item.demandVariability > 0.75) recommendations.push("Demand is highly erratic. Recommend reviewing safety stock levels and forecasting model parameters.");

                const projectedStockoutDate = new Date();
                projectedStockoutDate.setDate(projectedStockoutDate.getDate() + item.daysUntilStockout);

                return {
                    product: item.name,
                    current_stock: item.quantity,
                    recommended_stock: Math.round(recommendedStock),
                    urgency_level: urgencyLevel,
                    days_until_stockout: item.daysUntilStockout === Infinity ? -1 : item.daysUntilStockout,
                    projected_stockout_date: item.daysUntilStockout === Infinity ? 'N/A' : projectedStockoutDate.toISOString().split('T')[0],
                    expected_daily_demand: parseFloat(item.forecastedDemand.toFixed(2)),
                    reorder_point: Math.round(item.reorderPoint),
                    economic_order_quantity: Math.round(item.economicOrderQuantity),
                    cost_impact: parseFloat(costImpact.toFixed(2)),
                    confidence_score: parseFloat(item.confidenceScore.toFixed(2)),
                    trend_direction: trend,
                    reasons,
                    recommendations
                };
            })
            .sort((a, b) => {
                const urgencyOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
                if (urgencyOrder[a.urgency_level] !== urgencyOrder[b.urgency_level]) {
                    return urgencyOrder[a.urgency_level] - urgencyOrder[b.urgency_level];
                }
                return a.days_until_stockout - b.days_until_stockout;
            });
    }

    async performAnalysis(): Promise<AnalyticsResponse> {
        await dbConnect();

        const analysisStartDate = new Date();
        analysisStartDate.setDate(analysisStartDate.getDate() - this.DAYS_TO_ANALYZE);
        
        const orders = await Order.find({
            date: { $gte: analysisStartDate.toISOString().split('T')[0] }
        }).lean() as unknown as OrderDocument[];

        const inventory = await Inventory.find({}).lean() as unknown as InventoryDocument[];

        if (!orders || !inventory) {
            throw new Error("Unable to fetch required data from the database.");
        }

        await this.processSalesData(orders);
        this.analyzeInventory(inventory);

        const urgentRestocking = this.generateForecastingResults();

        const totalCost = urgentRestocking.reduce((sum, item) => sum + item.cost_impact, 0);
        const avgConfidence = urgentRestocking.length > 0 
            ? urgentRestocking.reduce((sum, item) => sum + item.confidence_score, 0) / urgentRestocking.length 
            : 0;

        const summary = {
            total_products_analyzed: inventory.length,
            critical_items: urgentRestocking.filter(item => item.urgency_level === 'CRITICAL').length,
            high_priority_items: urgentRestocking.filter(item => ['CRITICAL', 'HIGH'].includes(item.urgency_level)).length,
            total_estimated_cost: parseFloat(totalCost.toFixed(2)),
            average_confidence_score: parseFloat(avgConfidence.toFixed(2))
        };

        const now = new Date();
        const nextAnalysis = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Recommend next analysis in 24 hours

        return {
            urgent_restocking: urgentRestocking,
            summary,
            generated_at: now.toISOString(),
            next_analysis_recommended: nextAnalysis.toISOString()
        };
    }
}

export async function GET(): Promise<NextResponse> {
    try {
        const analytics = new AdvancedInventoryAnalytics();
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
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        return NextResponse.json(
            { 
                error: "Failed to generate inventory analytics",
                details: errorMessage
            },
            { status: 500 }
        );
    }
}
