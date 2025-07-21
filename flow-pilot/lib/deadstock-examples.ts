/**
 * Test script to demonstrate deadstock analysis functionality
 * This file shows example API calls and expected responses
 */

// Example API calls for deadstock analysis

// 1. Basic deadstock analysis
// GET /api/analytics/deadstacks
// Returns categorized deadstock items with risk levels

// 2. Filtered deadstock analysis by category
// GET /api/analytics/deadstacks?category=electronics&days=60&minValue=1000
// Parameters:
// - category: Filter by product category
// - days: Minimum days since last sale (default: 90)
// - minValue: Minimum stock value to consider (default: 0)

// 3. Enhanced deadstock report
// GET /api/analytics/deadstock-report?includeReports=true&warehouse=warehouse1
// Parameters:
// - includeReports: Include detailed reports for each item
// - warehouse: Filter by warehouse location
// - category: Filter by category
// - minValue: Minimum stock value threshold

// 4. Apply deadstock actions
// POST /api/analytics/deadstacks
// Body examples:

interface DeadstockActionRequest {
    action: 'apply_discount' | 'set_price' | 'mark_for_liquidation';
    productIds: string[];
    discountPercentage?: number; // Required for 'apply_discount'
    newPrice?: number; // Required for 'set_price'
}

// Example requests:

export const exampleRequests = {
    // Apply 30% discount to critical deadstock items
    applyDiscount: {
        action: 'apply_discount',
        productIds: ['64f1b2c3d4e5f6a7b8c9d0e1', '64f1b2c3d4e5f6a7b8c9d0e2'],
        discountPercentage: 30
    } as DeadstockActionRequest,

    // Set new price for specific items
    setPrice: {
        action: 'set_price',
        productIds: ['64f1b2c3d4e5f6a7b8c9d0e3'],
        newPrice: 150
    } as DeadstockActionRequest,

    // Mark items for liquidation
    markForLiquidation: {
        action: 'mark_for_liquidation',
        productIds: ['64f1b2c3d4e5f6a7b8c9d0e4', '64f1b2c3d4e5f6a7b8c9d0e5']
    } as DeadstockActionRequest
};

// Expected response structure for GET /api/analytics/deadstacks
export interface DeadstockAnalysisResponse {
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

// Expected response structure for GET /api/analytics/deadstock-report
export interface DeadstockReportResponse {
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

interface EnhancedDeadstockItem extends DeadstockItem {
    metrics: {
        velocityScore: number;
        turnoverRatio: number;
        ageScore: number;
        demandTrend: 'increasing' | 'decreasing' | 'stable' | 'no_data';
        seasonalPattern: boolean;
    };
    financialImpact: {
        tiedUpCapital: number;
        storageCosts: number;
        opportunityCost: number;
        depreciationRisk: number;
        totalImpact: number;
    };
    abcAnalysis: {
        category: 'A' | 'B' | 'C';
        priority: 'high' | 'medium' | 'low';
        reason: string;
    };
    detailedReport: string;
}

// Usage examples in a React component:

export const deadstockAnalysisExamples = {
    // Fetch basic deadstock analysis
    fetchDeadstockAnalysis: async () => {
        try {
            const response = await fetch('/api/analytics/deadstacks');
            const data: DeadstockAnalysisResponse = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching deadstock analysis:', error);
            throw error;
        }
    },

    // Fetch filtered deadstock analysis
    fetchFilteredAnalysis: async (category?: string, days?: number, minValue?: number) => {
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (days) params.append('days', days.toString());
        if (minValue) params.append('minValue', minValue.toString());

        try {
            const response = await fetch(`/api/analytics/deadstacks?${params.toString()}`);
            const data: DeadstockAnalysisResponse = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching filtered deadstock analysis:', error);
            throw error;
        }
    },

    // Fetch comprehensive deadstock report
    fetchDeadstockReport: async (includeReports: boolean = false, warehouse?: string) => {
        const params = new URLSearchParams();
        if (includeReports) params.append('includeReports', 'true');
        if (warehouse) params.append('warehouse', warehouse);

        try {
            const response = await fetch(`/api/analytics/deadstock-report?${params.toString()}`);
            const data: DeadstockReportResponse = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching deadstock report:', error);
            throw error;
        }
    },

    // Apply deadstock actions
    applyDeadstockActions: async (request: DeadstockActionRequest) => {
        try {
            const response = await fetch('/api/analytics/deadstacks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error applying deadstock actions:', error);
            throw error;
        }
    }
};

// Utility functions for frontend usage
export const deadstockUtils = {
    // Format currency values
    formatCurrency: (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
        }).format(value);
    },

    // Get risk level color for UI
    getRiskLevelColor: (riskLevel: string) => {
        const colors = {
            critical: '#dc2626', // red-600
            high: '#ea580c',     // orange-600
            medium: '#d97706',   // amber-600
            low: '#16a34a'       // green-600
        };
        return colors[riskLevel as keyof typeof colors] || '#6b7280';
    },

    // Get ABC category styling
    getABCCategoryStyle: (category: 'A' | 'B' | 'C') => {
        const styles = {
            A: { background: '#fef2f2', border: '#dc2626', text: '#dc2626' },
            B: { background: '#fefce8', border: '#d97706', text: '#d97706' },
            C: { background: '#f0fdf4', border: '#16a34a', text: '#16a34a' }
        };
        return styles[category];
    },

    // Calculate percentage change
    calculatePercentageChange: (oldValue: number, newValue: number) => {
        if (oldValue === 0) return 0;
        return ((newValue - oldValue) / oldValue) * 100;
    },

    // Sort items by priority (critical first, then by value)
    sortByPriority: (items: DeadstockItem[]) => {
        const riskPriority = { critical: 4, high: 3, medium: 2, low: 1 };
        return items.sort((a, b) => {
            const aPriority = riskPriority[a.deadstockRisk];
            const bPriority = riskPriority[b.deadstockRisk];
            
            if (aPriority !== bPriority) {
                return bPriority - aPriority;
            }
            
            return b.stockValue - a.stockValue;
        });
    }
};

// Integration patterns for different use cases
export const integrationPatterns = {
    // Dashboard widget - show summary only
    dashboardWidget: `
    // Fetch summary data for dashboard
    const summary = await deadstockAnalysisExamples.fetchDeadstockAnalysis();
    const { critical_items_count, total_deadstock_value } = summary.deadstock_analysis.summary;
    
    // Display critical alerts
    if (critical_items_count > 0) {
        showAlert(\`⚠️ \${critical_items_count} critical deadstock items require immediate attention\`);
    }
    `,

    // Detailed analysis page
    detailedAnalysis: `
    // Fetch comprehensive report
    const report = await deadstockAnalysisExamples.fetchDeadstockReport(true);
    
    // Display by ABC categories
    const categoryA = report.deadstock_report.abc_analysis.a_category;
    const categoryB = report.deadstock_report.abc_analysis.b_category;
    const categoryC = report.deadstock_report.abc_analysis.c_category;
    `,

    // Batch operations
    batchOperations: `
    // Apply discount to all critical items
    const criticalItems = data.deadstock_analysis.critical_deadstock;
    const criticalIds = criticalItems.map(item => item.productId);
    
    await deadstockAnalysisExamples.applyDeadstockActions({
        action: 'apply_discount',
        productIds: criticalIds,
        discountPercentage: 40
    });
    `
};

console.log('Deadstock Analysis API documentation and examples loaded successfully!');
console.log('Available endpoints:');
console.log('1. GET /api/analytics/deadstacks - Basic deadstock analysis');
console.log('2. GET /api/analytics/deadstock-report - Comprehensive deadstock report');
console.log('3. POST /api/analytics/deadstacks - Apply deadstock actions');