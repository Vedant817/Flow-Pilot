import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Inventory } from "@/models/Inventory";
import { Order } from "@/models/Order";
import { 
    calculateDeadstockMetrics, 
    generateProductDeadstockReport, 
    calculateFinancialImpact,
    performABCAnalysis,
    DeadstockMetrics,
    FinancialImpact,
    ABCAnalysis
} from "@/lib/deadstock-utils";

interface IOrderLean {
    _id: unknown;
    date: string;
    products: Array<{ name: string; quantity: number }>;
}

interface CategoryBreakdownData {
    item_count: number;
    total_value: number;
    avg_age_days: number;
    velocity_score: number;
    items?: EnhancedDeadstockItem[];
    total_age_days?: number;
    total_velocity?: number;
}

interface ExecutiveSummary {
    total_deadstock_value: number;
    total_items_analyzed: number;
    critical_items: number;
    high_risk_items: number;
    total_financial_impact: number;
    priority_actions_required: number;
    report_date: string;
}

interface EnhancedDeadstockItem {
    productId: string;
    productName: string;
    category: string;
    currentStock: number;
    stockValue: number;
    price: number;
    metrics: DeadstockMetrics;
    financialImpact: FinancialImpact;
    abcAnalysis: ABCAnalysis;
    riskLevel: 'critical' | 'high' | 'medium' | 'low';
    detailedReport: string;
    warehouseLocation: string;
}

interface DeadstockReportResult {
    deadstock_report: {
        executive_summary: {
            total_deadstock_value: number;
            total_items_analyzed: number;
            critical_items: number;
            high_risk_items: number;
            total_financial_impact: number;
            priority_actions_required: number;
            report_date: string;
        };
        category_breakdown: {
            [category: string]: {
                item_count: number;
                total_value: number;
                avg_age_days: number;
                velocity_score: number;
            };
        };
        abc_analysis: {
            a_category: EnhancedDeadstockItem[];
            b_category: EnhancedDeadstockItem[];
            c_category: EnhancedDeadstockItem[];
        };
        risk_analysis: {
            critical: EnhancedDeadstockItem[];
            high: EnhancedDeadstockItem[];
            medium: EnhancedDeadstockItem[];
            low: EnhancedDeadstockItem[];
        };
        recommendations: {
            immediate_actions: string[];
            short_term_strategies: string[];
            long_term_improvements: string[];
        };
    };
}

export async function GET(request: NextRequest) {
    try {
        await dbConnect();

        const url = new URL(request.url);
        const category = url.searchParams.get('category');
        const warehouseLocation = url.searchParams.get('warehouse');
        const includeReports = url.searchParams.get('includeReports') === 'true';
        const minValue = parseFloat(url.searchParams.get('minValue') || '0');

        const filterQuery: Record<string, string> = {};
        if (category) filterQuery.category = category;
        if (warehouseLocation) filterQuery.warehouse_location = warehouseLocation;

        const inventory = await Inventory.find(filterQuery).lean();
        const orders = await Order.find({}).lean();

        if (!inventory.length) {
            return NextResponse.json({
                deadstock_report: {
                    executive_summary: {
                        total_deadstock_value: 0,
                        total_items_analyzed: 0,
                        critical_items: 0,
                        high_risk_items: 0,
                        total_financial_impact: 0,
                        priority_actions_required: 0,
                        report_date: new Date().toISOString()
                    },
                    category_breakdown: {},
                    abc_analysis: { a_category: [], b_category: [], c_category: [] },
                    risk_analysis: { critical: [], high: [], medium: [], low: [] },
                    recommendations: {
                        immediate_actions: [],
                        short_term_strategies: [],
                        long_term_improvements: []
                    }
                }
            });
        }

        const productSalesData = analyzeProductSales(orders);
        
        const enhancedDeadstockItems: EnhancedDeadstockItem[] = inventory.map(item => {
            const salesData = productSalesData[item.name] || {
                totalSold: 0,
                lastSaleDate: null,
                salesHistory: []
            };

            const stockValue = item.quantity * item.price;

            if (stockValue < minValue) {
                return null;
            }

            const metrics = calculateDeadstockMetrics(
                salesData.salesHistory,
                item.quantity
            );

            const riskLevel = determineEnhancedRiskLevel(metrics, item.quantity, item.stock_alert_level);

            const monthsInStock = metrics.ageScore / 30;
            const financialImpact = calculateFinancialImpact(stockValue, monthsInStock);

            const abcAnalysis = performABCAnalysis(stockValue, metrics.velocityScore, metrics.ageScore);

            const detailedReport = includeReports ? 
                generateProductDeadstockReport(item.name, metrics, item.quantity, stockValue, riskLevel) : 
                '';

            return {
                productId: item._id.toString(),
                productName: item.name,
                category: item.category,
                currentStock: item.quantity,
                stockValue,
                price: item.price,
                metrics,
                financialImpact,
                abcAnalysis,
                riskLevel,
                detailedReport,
                warehouseLocation: item.warehouse_location
            };
        }).filter(item => item !== null) as EnhancedDeadstockItem[];

        const executiveSummary = {
            total_deadstock_value: enhancedDeadstockItems.reduce((sum, item) => sum + item.stockValue, 0),
            total_items_analyzed: enhancedDeadstockItems.length,
            critical_items: enhancedDeadstockItems.filter(item => item.riskLevel === 'critical').length,
            high_risk_items: enhancedDeadstockItems.filter(item => item.riskLevel === 'high').length,
            total_financial_impact: enhancedDeadstockItems.reduce((sum, item) => sum + item.financialImpact.totalImpact, 0),
            priority_actions_required: enhancedDeadstockItems.filter(item => 
                item.riskLevel === 'critical' || item.abcAnalysis.priority === 'high'
            ).length,
            report_date: new Date().toISOString()
        };

        const categoryBreakdown: { [category: string]: CategoryBreakdownData } = {};
        enhancedDeadstockItems.forEach(item => {
            if (!categoryBreakdown[item.category]) {
                categoryBreakdown[item.category] = {
                    items: [],
                    item_count: 0,
                    total_value: 0,
                    avg_age_days: 0,
                    velocity_score: 0,
                    total_age_days: 0,
                    total_velocity: 0
                };
            }
            categoryBreakdown[item.category].items!.push(item);
            categoryBreakdown[item.category].item_count++;
            categoryBreakdown[item.category].total_value += item.stockValue;
            categoryBreakdown[item.category].total_age_days! += item.metrics.ageScore;
            categoryBreakdown[item.category].total_velocity! += item.metrics.velocityScore;
        });

        Object.keys(categoryBreakdown).forEach(category => {
            const cat = categoryBreakdown[category];
            cat.avg_age_days = cat.total_age_days! / cat.item_count;
            cat.velocity_score = cat.total_velocity! / cat.item_count;
            delete cat.items;
        });

        const abcAnalysis = {
            a_category: enhancedDeadstockItems.filter(item => item.abcAnalysis.category === 'A')
                .sort((a, b) => b.stockValue - a.stockValue),
            b_category: enhancedDeadstockItems.filter(item => item.abcAnalysis.category === 'B')
                .sort((a, b) => b.stockValue - a.stockValue),
            c_category: enhancedDeadstockItems.filter(item => item.abcAnalysis.category === 'C')
                .sort((a, b) => b.stockValue - a.stockValue)
        };

        const riskAnalysis = {
            critical: enhancedDeadstockItems.filter(item => item.riskLevel === 'critical')
                .sort((a, b) => b.financialImpact.totalImpact - a.financialImpact.totalImpact),
            high: enhancedDeadstockItems.filter(item => item.riskLevel === 'high')
                .sort((a, b) => b.financialImpact.totalImpact - a.financialImpact.totalImpact),
            medium: enhancedDeadstockItems.filter(item => item.riskLevel === 'medium')
                .sort((a, b) => b.financialImpact.totalImpact - a.financialImpact.totalImpact),
            low: enhancedDeadstockItems.filter(item => item.riskLevel === 'low')
                .sort((a, b) => b.financialImpact.totalImpact - a.financialImpact.totalImpact)
        };

        const recommendations = generateComprehensiveRecommendations(
            executiveSummary,
            categoryBreakdown,
            abcAnalysis
        );

        const result: DeadstockReportResult = {
            deadstock_report: {
                executive_summary: executiveSummary,
                category_breakdown: categoryBreakdown,
                abc_analysis: abcAnalysis,
                risk_analysis: riskAnalysis,
                recommendations
            }
        };

        return NextResponse.json(result);

    } catch (error) {
        console.error("Error generating enhanced deadstock report:", error);
        return NextResponse.json({
            error: "Failed to generate deadstock report",
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

function determineEnhancedRiskLevel(
    metrics: DeadstockMetrics,
    currentStock: number,
    stockAlertLevel: number
): 'critical' | 'high' | 'medium' | 'low' {
    
    if ((metrics.ageScore >= 120 && metrics.velocityScore < 1) ||
        (metrics.turnoverRatio < 0.5 && metrics.ageScore >= 90) ||
        (currentStock > stockAlertLevel * 5 && metrics.velocityScore < 2)) {
        return 'critical';
    }
    
    if ((metrics.ageScore >= 60 && metrics.velocityScore < 3) ||
        (metrics.turnoverRatio < 1 && metrics.ageScore >= 45) ||
        (currentStock > stockAlertLevel * 3 && metrics.velocityScore < 5)) {
        return 'high';
    }
    
    if ((metrics.ageScore >= 30 && metrics.velocityScore < 5) ||
        (metrics.turnoverRatio < 2 && metrics.ageScore >= 30)) {
        return 'medium';
    }
    
    return 'low';
}

function generateComprehensiveRecommendations(
    summary: ExecutiveSummary,
    categoryBreakdown: { [category: string]: CategoryBreakdownData },
    abcAnalysis: {
        a_category: EnhancedDeadstockItem[];
        b_category: EnhancedDeadstockItem[];
        c_category: EnhancedDeadstockItem[];
    }
): { immediate_actions: string[]; short_term_strategies: string[]; long_term_improvements: string[] } {
    
    const immediateActions: string[] = [];
    const shortTermStrategies: string[] = [];
    const longTermImprovements: string[] = [];

    if (summary.critical_items > 0) {
        immediateActions.push(`URGENT: ${summary.critical_items} critical deadstock items require immediate liquidation`);
        immediateActions.push("Implement emergency clearance sales with 40-60% discounts");
        immediateActions.push("Contact bulk buyers or liquidation companies");
    }

    if (abcAnalysis.a_category.length > 0) {
        immediateActions.push(`Focus on ${abcAnalysis.a_category.length} high-value (Category A) deadstock items first`);
    }

    if (summary.high_risk_items > 0) {
        shortTermStrategies.push(`Address ${summary.high_risk_items} high-risk items within 30 days`);
        shortTermStrategies.push("Implement targeted promotional campaigns");
    }

    shortTermStrategies.push("Review and adjust reorder points for slow-moving categories");
    shortTermStrategies.push("Implement weekly deadstock monitoring reports");

    const worstCategories = Object.entries(categoryBreakdown)
        .sort((a: [string, CategoryBreakdownData], b: [string, CategoryBreakdownData]) => b[1].total_value - a[1].total_value)
        .slice(0, 3);
    
    if (worstCategories.length > 0) {
        shortTermStrategies.push(`Focus on worst-performing categories: ${worstCategories.map((cat: [string, CategoryBreakdownData]) => cat[0]).join(', ')}`);
    }

    longTermImprovements.push("Implement demand forecasting system to prevent future deadstock");
    longTermImprovements.push("Establish supplier agreements for return/exchange of slow-moving items");
    longTermImprovements.push("Develop seasonal clearance strategies");
    longTermImprovements.push("Implement ABC analysis for purchasing decisions");
    longTermImprovements.push("Consider just-in-time inventory for slow-moving categories");

    if (summary.total_financial_impact > 100000) {
        longTermImprovements.push("Consider implementing inventory optimization software");
    }

    return {
        immediate_actions: immediateActions,
        short_term_strategies: shortTermStrategies,
        long_term_improvements: longTermImprovements
    };
}