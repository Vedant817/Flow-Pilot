// Utility functions for deadstock analysis
export interface DeadstockMetrics {
    velocityScore: number; // How fast the product moves (sales per month)
    turnoverRatio: number; // Inventory turnover ratio
    ageScore: number; // How long since last sale
    demandTrend: 'increasing' | 'decreasing' | 'stable' | 'no_data';
    seasonalPattern: boolean;
}

export interface SalesHistoryEntry {
    date: string;
    quantity: number;
}

/**
 * Calculate comprehensive deadstock metrics for a product
 */
export function calculateDeadstockMetrics(
    salesHistory: SalesHistoryEntry[],
    currentStock: number
): DeadstockMetrics {
    const currentDate = new Date();
    
    // Calculate velocity score (sales per month)
    const velocityScore = calculateVelocityScore(salesHistory);
    
    // Calculate turnover ratio
    const turnoverRatio = calculateTurnoverRatio(salesHistory, currentStock);
    
    // Calculate age score
    const ageScore = calculateAgeScore(salesHistory, currentDate);
    
    // Determine demand trend
    const demandTrend = calculateDemandTrend(salesHistory);
    
    // Check for seasonal patterns
    const seasonalPattern = detectSeasonalPattern(salesHistory);
    
    return {
        velocityScore,
        turnoverRatio,
        ageScore,
        demandTrend,
        seasonalPattern
    };
}

/**
 * Calculate how fast the product moves (monthly velocity)
 */
export function calculateVelocityScore(salesHistory: SalesHistoryEntry[]): number {
    if (!salesHistory.length) return 0;
    
    const currentDate = new Date();
    const threeMonthsAgo = new Date(currentDate.getTime() - (90 * 24 * 60 * 60 * 1000));
    
    const recentSales = salesHistory.filter(sale => new Date(sale.date) >= threeMonthsAgo);
    const totalQuantity = recentSales.reduce((sum, sale) => sum + sale.quantity, 0);
    
    // Return monthly velocity
    return totalQuantity / 3;
}

/**
 * Calculate inventory turnover ratio
 */
export function calculateTurnoverRatio(salesHistory: SalesHistoryEntry[], currentStock: number): number {
    if (!salesHistory.length || currentStock === 0) return 0;
    
    const currentDate = new Date();
    const oneYearAgo = new Date(currentDate.getTime() - (365 * 24 * 60 * 60 * 1000));
    
    const yearSales = salesHistory.filter(sale => new Date(sale.date) >= oneYearAgo);
    const totalSold = yearSales.reduce((sum, sale) => sum + sale.quantity, 0);
    
    // Annual turnover ratio = Annual sales / Average inventory
    // Using current stock as proxy for average inventory
    return totalSold / currentStock;
}

/**
 * Calculate age score based on time since last sale
 */
export function calculateAgeScore(salesHistory: SalesHistoryEntry[], currentDate: Date): number {
    if (!salesHistory.length) return 999; // Never sold
    
    const lastSale = salesHistory.reduce((latest, sale) => {
        const saleDate = new Date(sale.date);
        return saleDate > latest ? saleDate : latest;
    }, new Date(0));
    
    const daysSinceLastSale = Math.ceil((currentDate.getTime() - lastSale.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysSinceLastSale;
}

/**
 * Determine demand trend over time
 */
export function calculateDemandTrend(salesHistory: SalesHistoryEntry[]): 'increasing' | 'decreasing' | 'stable' | 'no_data' {
    if (salesHistory.length < 4) return 'no_data';
    
    // Sort by date
    const sortedSales = [...salesHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Split into first half and second half
    const midPoint = Math.floor(sortedSales.length / 2);
    const firstHalf = sortedSales.slice(0, midPoint);
    const secondHalf = sortedSales.slice(midPoint);
    
    const firstHalfAvg = firstHalf.reduce((sum, sale) => sum + sale.quantity, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, sale) => sum + sale.quantity, 0) / secondHalf.length;
    
    const changePercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
    
    if (changePercent > 10) return 'increasing';
    if (changePercent < -10) return 'decreasing';
    return 'stable';
}

/**
 * Detect seasonal sales patterns
 */
export function detectSeasonalPattern(salesHistory: SalesHistoryEntry[]): boolean {
    if (salesHistory.length < 12) return false; // Need at least a year of data
    
    // Group sales by month
    const monthlyData: { [month: number]: number } = {};
    
    salesHistory.forEach(sale => {
        const month = new Date(sale.date).getMonth();
        monthlyData[month] = (monthlyData[month] || 0) + sale.quantity;
    });
    
    const monthlyAverages = Object.values(monthlyData);
    const overallAverage = monthlyAverages.reduce((sum, val) => sum + val, 0) / monthlyAverages.length;
    
    // Check if any month has significantly higher/lower sales (>50% deviation)
    const hasSignificantVariation = monthlyAverages.some(avg => 
        Math.abs(avg - overallAverage) / overallAverage > 0.5
    );
    
    return hasSignificantVariation;
}

/**
 * Generate detailed deadstock report for a single product
 */
export function generateProductDeadstockReport(
    productName: string,
    metrics: DeadstockMetrics,
    currentStock: number,
    stockValue: number,
    riskLevel: 'critical' | 'high' | 'medium' | 'low'
): string {
    const reports: string[] = [];
    
    reports.push(`=== DEADSTOCK ANALYSIS: ${productName.toUpperCase()} ===`);
    reports.push(`Risk Level: ${riskLevel.toUpperCase()}`);
    reports.push(`Current Stock: ${currentStock} units`);
    reports.push(`Stock Value: ₹${stockValue.toLocaleString()}`);
    reports.push('');
    
    reports.push('PERFORMANCE METRICS:');
    reports.push(`• Velocity Score: ${metrics.velocityScore.toFixed(2)} units/month`);
    reports.push(`• Turnover Ratio: ${metrics.turnoverRatio.toFixed(2)}x annually`);
    reports.push(`• Days Since Last Sale: ${metrics.ageScore}`);
    reports.push(`• Demand Trend: ${metrics.demandTrend.replace('_', ' ').toUpperCase()}`);
    reports.push(`• Seasonal Pattern: ${metrics.seasonalPattern ? 'YES' : 'NO'}`);
    reports.push('');
    
    // Risk-specific insights
    switch (riskLevel) {
        case 'critical':
            reports.push('⚠️ CRITICAL DEADSTOCK ALERT:');
            reports.push('• Immediate liquidation required');
            reports.push('• Consider 40-60% discount or bundle deals');
            reports.push('• High risk of total loss if no action taken');
            break;
            
        case 'high':
            reports.push('🔸 HIGH RISK DEADSTOCK:');
            reports.push('• Action required within 30 days');
            reports.push('• Implement promotional strategies');
            reports.push('• Monitor closely for further deterioration');
            break;
            
        case 'medium':
            reports.push('🔹 MEDIUM RISK MONITORING:');
            reports.push('• Enhanced marketing recommended');
            reports.push('• Consider cross-selling opportunities');
            reports.push('• Review reorder policies');
            break;
            
        case 'low':
            reports.push('✅ LOW RISK - MONITOR:');
            reports.push('• Continue regular monitoring');
            reports.push('• Normal sales patterns observed');
            reports.push('• No immediate action required');
            break;
    }
    
    return reports.join('\n');
}

/**
 * Calculate the financial impact of deadstock
 */
export interface FinancialImpact {
    tiedUpCapital: number;
    storageCosts: number;
    opportunityCost: number;
    depreciationRisk: number;
    totalImpact: number;
}

export function calculateFinancialImpact(
    stockValue: number,
    monthsInStock: number,
    storageRate: number = 0.02, // 2% per month default
    opportunityRate: number = 0.01, // 1% per month default
    depreciationRate: number = 0.005 // 0.5% per month default
): FinancialImpact {
    const tiedUpCapital = stockValue;
    const storageCosts = stockValue * storageRate * monthsInStock;
    const opportunityCost = stockValue * opportunityRate * monthsInStock;
    const depreciationRisk = stockValue * depreciationRate * monthsInStock;
    
    return {
        tiedUpCapital,
        storageCosts,
        opportunityCost,
        depreciationRisk,
        totalImpact: tiedUpCapital + storageCosts + opportunityCost + depreciationRisk
    };
}

/**
 * Generate ABC analysis for deadstock prioritization
 */
export interface ABCAnalysis {
    category: 'A' | 'B' | 'C';
    priority: 'high' | 'medium' | 'low';
    reason: string;
}

export function performABCAnalysis(
    stockValue: number,
    velocityScore: number,
    ageScore: number
): ABCAnalysis {
    // A items: High value, low velocity, old age (highest priority)
    if (stockValue > 50000 && velocityScore < 5 && ageScore > 60) {
        return {
            category: 'A',
            priority: 'high',
            reason: 'High-value deadstock with low movement - immediate attention required'
        };
    }
    
    // B items: Medium value or medium velocity with some age
    if ((stockValue > 10000 && velocityScore < 10 && ageScore > 30) ||
        (stockValue > 25000 && ageScore > 45)) {
        return {
            category: 'B',
            priority: 'medium',
            reason: 'Medium-value deadstock - monitor and implement promotional strategies'
        };
    }
    
    // C items: Low value or recent items
    return {
        category: 'C',
        priority: 'low',
        reason: 'Low-value or recent deadstock - regular monitoring sufficient'
    };
}