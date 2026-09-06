interface DeadstockActionRequest {
    action: 'apply_discount' | 'set_price' | 'mark_for_liquidation';
    productIds: string[];
    discountPercentage?: number; 
    newPrice?: number; 
}

export const exampleRequests = {
    applyDiscount: {
        action: 'apply_discount',
        productIds: ['64f1b2c3d4e5f6a7b8c9d0e1', '64f1b2c3d4e5f6a7b8c9d0e2'],
        discountPercentage: 30
    } as DeadstockActionRequest,

    setPrice: {
        action: 'set_price',
        productIds: ['64f1b2c3d4e5f6a7b8c9d0e3'],
        newPrice: 150
    } as DeadstockActionRequest,

    markForLiquidation: {
        action: 'mark_for_liquidation',
        productIds: ['64f1b2c3d4e5f6a7b8c9d0e4', '64f1b2c3d4e5f6a7b8c9d0e5']
    } as DeadstockActionRequest
};

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

export const deadstockAnalysisExamples = {
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

export const deadstockUtils = {
    formatCurrency: (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
        }).format(value);
    },

    getRiskLevelColor: (riskLevel: string) => {
        const colors = {
            critical: '#dc2626',
            high: '#ea580c',
            medium: '#d97706',
            low: '#16a34a'
        };
        return colors[riskLevel as keyof typeof colors] || '#6b7280';
    },

    getABCCategoryStyle: (category: 'A' | 'B' | 'C') => {
        const styles = {
            A: { background: '#fef2f2', border: '#dc2626', text: '#dc2626' },
            B: { background: '#fefce8', border: '#d97706', text: '#d97706' },
            C: { background: '#f0fdf4', border: '#16a34a', text: '#16a34a' }
        };
        return styles[category];
    },

    calculatePercentageChange: (oldValue: number, newValue: number) => {
        if (oldValue === 0) return 0;
        return ((newValue - oldValue) / oldValue) * 100;
    },

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

export const integrationPatterns = {
    dashboardWidget: `
    const summary = await deadstockAnalysisExamples.fetchDeadstockAnalysis();
    const { critical_items_count, total_deadstock_value } = summary.deadstock_analysis.summary;
    
    if (critical_items_count > 0) {
        showAlert(\`⚠️ \${critical_items_count} critical deadstock items require immediate attention\`);
    }
    `,

    detailedAnalysis: `
    const report = await deadstockAnalysisExamples.fetchDeadstockReport(true);
    
    const categoryA = report.deadstock_report.abc_analysis.a_category;
    const categoryB = report.deadstock_report.abc_analysis.b_category;
    const categoryC = report.deadstock_report.abc_analysis.c_category;
    `,

    batchOperations: `
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