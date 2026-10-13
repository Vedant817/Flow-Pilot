'use client'
import { useState, useCallback, memo, useEffect } from 'react'
import { 
    BarChart3, 
    TrendingUp, 
    Users, 
    Package, 
    DollarSign, 
    ShoppingCart,
    ArrowUpRight,
    ArrowDownRight,
    Calendar,
    RefreshCw,
    Eye,
    Star,
    Clock,
    CheckCircle2
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AnalyticsData {
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

const StatCard = memo(({ 
    title, 
    value, 
    subtitle, 
    icon, 
    growth, 
    color = 'bg-blue-50 text-blue-600',
    loading = false 
}: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    growth?: number;
    color?: string;
    loading?: boolean;
}) => (
    <Card className="bg-white border border-slate-200 hover:shadow-lg transition-all duration-200">
        <CardContent className="p-6">
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
                    {loading ? (
                        <div className="animate-pulse">
                            <div className="h-8 bg-slate-200 rounded w-24 mb-2"></div>
                            <div className="h-4 bg-slate-200 rounded w-16"></div>
                        </div>
                    ) : (
                        <>
                            <p className="text-3xl font-bold text-slate-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>
                            {(subtitle || growth !== undefined) && (
                                <div className="flex items-center gap-2 mt-1">
                                    {growth !== undefined && (
                                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                                            growth >= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                            {growth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                            {Math.abs(growth)}%
                                        </span>
                                    )}
                                    {subtitle && (
                                        <span className="text-xs text-slate-500">{subtitle}</span>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                    {icon}
                </div>
            </div>
        </CardContent>
    </Card>
));
StatCard.displayName = 'StatCard';

const SimpleChart = memo(({ 
    data, 
    title, 
    loading = false
}: {
    data: number[];
    title: string;
    loading?: boolean;
}) => {
    const maxValue = Math.max(...data, 1);
    
    if (loading) {
        return (
            <div className="animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-32 mb-4"></div>
                <div className="space-y-2">
                    {Array(5).fill(0).map((_, i) => (
                        <div key={i} className="h-8 bg-slate-200 rounded"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>
            <div className="flex items-end gap-1 h-40">
                {data.map((value, index) => (
                    <div
                        key={index}
                        className="flex-1 bg-gradient-to-t from-blue-500 to-blue-300 rounded-t transition-all duration-300 hover:from-blue-600 hover:to-blue-400"
                        style={{
                            height: `${(value / maxValue) * 100}%`,
                            minHeight: '8px'
                        }}
                        title={`Value: ${value}`}
                    />
                ))}
            </div>
        </div>
    );
});
SimpleChart.displayName = 'SimpleChart';

const TabButton = memo(({ label, isActive, onClick, icon }: { 
    label: string; 
    isActive: boolean; 
    onClick: () => void;
    icon: React.ReactNode;
}) => (
    <button 
        onClick={onClick}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            isActive 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' 
                : 'text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
        }`}
    >
        {icon}
        {label}
    </button>
));
TabButton.displayName = 'TabButton';

export default function AnalyticsPage() {
    const [activeTab, setActiveTab] = useState('overview');
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState(30);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await fetch(`/api/analytics-overview?days=${timeRange}`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const analyticsData = await response.json();
            setData(analyticsData);
        } catch (error) {
            console.error('Error fetching analytics:', error);
            setError(error instanceof Error ? error.message : 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    }, [timeRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleTabChange = useCallback((tab: string) => {
        setActiveTab(tab);
    }, []);

    const handleTimeRangeChange = useCallback((range: number) => {
        setTimeRange(range);
    }, []);

    const handleRefresh = useCallback(() => {
        fetchData();
    }, [fetchData]);

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
                <Card className="max-w-md mx-auto mt-20">
                    <CardContent className="p-6 text-center">
                        <div className="text-red-500 mb-4">
                            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">Failed to Load Analytics</h3>
                        <p className="text-slate-600 mb-4">{error}</p>
                        <button 
                            onClick={handleRefresh}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Try Again
                        </button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <div className="p-6">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 mb-2">Analytics Dashboard</h1>
                            <p className="text-slate-600">Comprehensive insights into your business performance</p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-500" />
                                <select 
                                    value={timeRange}
                                    onChange={(e) => handleTimeRangeChange(Number(e.target.value))}
                                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value={7}>Last 7 days</option>
                                    <option value={30}>Last 30 days</option>
                                    <option value={90}>Last 90 days</option>
                                </select>
                            </div>
                            <button
                                onClick={handleRefresh}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="mb-6">
                    <div className="flex flex-wrap gap-3">
                        <TabButton 
                            label="Overview"
                            icon={<Eye className="w-4 h-4" />}
                            isActive={activeTab === 'overview'}
                            onClick={() => handleTabChange('overview')}
                        />
                        <TabButton 
                            label="Performance"
                            icon={<BarChart3 className="w-4 h-4" />}
                            isActive={activeTab === 'performance'}
                            onClick={() => handleTabChange('performance')}
                        />
                        <TabButton 
                            label="Customers"
                            icon={<Users className="w-4 h-4" />}
                            isActive={activeTab === 'customers'}
                            onClick={() => handleTabChange('customers')}
                        />
                    </div>
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Key Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard
                                title="Total Revenue"
                                value={data?.summary.totalRevenue ? `₹${data.summary.totalRevenue.toLocaleString()}` : '₹0'}
                                growth={data?.summary.revenueGrowth}
                                subtitle="vs last period"
                                icon={<DollarSign className="w-6 h-6" />}
                                color="bg-green-50 text-green-600"
                                loading={loading}
                            />
                            <StatCard
                                title="Total Orders"
                                value={data?.summary.totalOrders || 0}
                                growth={data?.summary.orderGrowth}
                                subtitle="vs last period"
                                icon={<ShoppingCart className="w-6 h-6" />}
                                color="bg-blue-50 text-blue-600"
                                loading={loading}
                            />
                            <StatCard
                                title="Total Customers"
                                value={data?.summary.totalCustomers || 0}
                                subtitle="unique customers"
                                icon={<Users className="w-6 h-6" />}
                                color="bg-purple-50 text-purple-600"
                                loading={loading}
                            />
                            <StatCard
                                title="Avg Order Value"
                                value={data?.summary.averageOrderValue ? `₹${data.summary.averageOrderValue}` : '₹0'}
                                subtitle="per order"
                                icon={<TrendingUp className="w-6 h-6" />}
                                color="bg-orange-50 text-orange-600"
                                loading={loading}
                            />
                        </div>

                        {/* Activity Overview */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard
                                title="Recent Orders"
                                value={data?.recentActivity.recentOrders || 0}
                                subtitle="in selected period"
                                icon={<Calendar className="w-6 h-6" />}
                                color="bg-cyan-50 text-cyan-600"
                                loading={loading}
                            />
                            <StatCard
                                title="Pending Orders"
                                value={data?.recentActivity.pendingOrders || 0}
                                subtitle="need attention"
                                icon={<Clock className="w-6 h-6" />}
                                color="bg-yellow-50 text-yellow-600"
                                loading={loading}
                            />
                            <StatCard
                                title="Fulfilled Orders"
                                value={data?.recentActivity.fulfilledOrders || 0}
                                subtitle="completed"
                                icon={<CheckCircle2 className="w-6 h-6" />}
                                color="bg-green-50 text-green-600"
                                loading={loading}
                            />
                            <StatCard
                                title="Low Stock Items"
                                value={data?.recentActivity.lowStockItems || 0}
                                subtitle="need restock"
                                icon={<Package className="w-6 h-6" />}
                                color="bg-red-50 text-red-600"
                                loading={loading}
                            />
                        </div>

                        {/* Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="bg-white border border-slate-200">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-blue-600" />
                                        Order Trends
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <SimpleChart 
                                        data={data?.chartData.orderTrends.orders || []}
                                        title="Daily Orders"
                                        loading={loading}
                                    />
                                </CardContent>
                            </Card>

                            <Card className="bg-white border border-slate-200">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Package className="w-5 h-5 text-green-600" />
                                        Product Performance
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <SimpleChart 
                                        data={data?.chartData.productPerformance.sales || []}
                                        title="Sales by Category"
                                        loading={loading}
                                    />
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {/* Performance Tab */}
                {activeTab === 'performance' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard
                                title="Conversion Rate"
                                value={`${data?.performanceMetrics.conversionRate || 0}%`}
                                subtitle="visitor to customer"
                                icon={<TrendingUp className="w-6 h-6" />}
                                color="bg-blue-50 text-blue-600"
                                loading={loading}
                            />
                            <StatCard
                                title="Fulfillment Rate"
                                value={`${data?.performanceMetrics.fulfillmentRate || 0}%`}
                                subtitle="orders completed"
                                icon={<CheckCircle2 className="w-6 h-6" />}
                                color="bg-green-50 text-green-600"
                                loading={loading}
                            />
                            <StatCard
                                title="Avg Processing"
                                value={data?.performanceMetrics.averageProcessingTime || 'N/A'}
                                subtitle="order to fulfillment"
                                icon={<Clock className="w-6 h-6" />}
                                color="bg-purple-50 text-purple-600"
                                loading={loading}
                            />
                            <StatCard
                                title="Customer Rating"
                                value={data?.performanceMetrics.customerSatisfaction || 0}
                                subtitle="satisfaction score"
                                icon={<Star className="w-6 h-6" />}
                                color="bg-yellow-50 text-yellow-600"
                                loading={loading}
                            />
                        </div>

                        <Card className="bg-white border border-slate-200">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <DollarSign className="w-5 h-5 text-green-600" />
                                    Revenue Trends
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <SimpleChart 
                                    data={data?.chartData.orderTrends.revenue || []}
                                    title="Daily Revenue (₹)"
                                    loading={loading}
                                />
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Customers Tab */}
                {activeTab === 'customers' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <StatCard
                                title="New Customers"
                                value={data?.chartData.customerInsights.newCustomers || 0}
                                subtitle="in selected period"
                                icon={<Users className="w-6 h-6" />}
                                color="bg-blue-50 text-blue-600"
                                loading={loading}
                            />
                            <StatCard
                                title="Returning Customers"
                                value={data?.chartData.customerInsights.returningCustomers || 0}
                                subtitle="repeat buyers"
                                icon={<Users className="w-6 h-6" />}
                                color="bg-green-50 text-green-600"
                                loading={loading}
                            />
                            <StatCard
                                title="Top Selling Product"
                                value={data?.summary.topSellingProduct || 'N/A'}
                                subtitle="most popular item"
                                icon={<Package className="w-6 h-6" />}
                                color="bg-purple-50 text-purple-600"
                                loading={loading}
                            />
                        </div>

                        <Card className="bg-white border border-slate-200">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Star className="w-5 h-5 text-yellow-600" />
                                    Top Spenders
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="space-y-3">
                                        {Array(5).fill(0).map((_, i) => (
                                            <div key={i} className="animate-pulse flex justify-between items-center">
                                                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                                                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {data?.chartData.customerInsights.topSpenders.map((customer, index) => (
                                            <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-bold">
                                                        {index + 1}
                                                    </div>
                                                    <span className="font-medium text-slate-900">{customer.name}</span>
                                                </div>
                                                <span className="font-bold text-green-600">₹{customer.amount.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}