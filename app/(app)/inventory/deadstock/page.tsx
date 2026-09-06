'use client';
import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    Loader, 
    RefreshCw, 
    AlertTriangle, 
    Package, 
    TrendingDown, 
    Search, 
    Filter, 
    DollarSign,
    Clock,
    BarChart3,
    FileText,
    ArrowLeft,
    Eye,
    X,
    Calendar,
    MapPin,
    Tag
} from "lucide-react";
import { useRouter } from "next/navigation";

const API_ENDPOINT = process.env.NEXT_PUBLIC_API_URL;

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

interface DeadstockAnalysis {
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
}

interface DeadstockResponse {
    deadstock_analysis: DeadstockAnalysis;
}

interface StatsCardProps {
    title: string;
    value: string | number;
    subtitle: string;
    icon: React.ReactNode;
    color: string;
    trend?: string;
}

interface ActionButtonProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
    disabled?: boolean;
}

interface DeadstockCardProps {
    item: DeadstockItem;
    onShowDetails: (item: DeadstockItem) => void;
}

interface DeadstockDetailsModalProps {
    item: DeadstockItem | null;
    isOpen: boolean;
    onClose: () => void;
}

const LoadingState = () => (
    <Card className="bg-white border border-slate-200">
        <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-600 font-medium">Analyzing deadstock...</p>
                <p className="text-sm text-slate-500 mt-1">Please wait while we process your inventory data</p>
            </div>
        </CardContent>
    </Card>
);

const ErrorState = ({ onRetry, message = "Failed to load deadstock analysis" }: { onRetry: () => void; message?: string }) => (
    <Card className="bg-white border border-red-200">
        <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                <p className="text-red-600 font-medium text-lg">{message}</p>
                <button
                    onClick={onRetry}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                    Try Again
                </button>
            </div>
        </CardContent>
    </Card>
);

const StatsCard = ({ title, value, subtitle, icon, color, trend }: StatsCardProps) => (
    <Card className="bg-white border border-slate-200 hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-600">{title}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
                    <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
                    {trend && (
                        <p className="text-xs text-slate-400 mt-1">{trend}</p>
                    )}
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                    {icon}
                </div>
            </div>
        </CardContent>
    </Card>
);

const ActionButton = ({ icon, label, onClick, variant = 'secondary', disabled = false }: ActionButtonProps) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
            variant === 'primary'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-sm hover:shadow-md'
        }`}
        aria-label={label}
    >
        {icon}
        <span>{label}</span>
    </button>
);

const getRiskConfig = (risk: string) => {
    switch (risk) {
        case 'critical':
            return {
                color: 'bg-red-50 text-red-700 border-red-200',
                icon: <AlertTriangle className="w-4 h-4" />,
                dot: 'bg-red-500',
                bgClass: 'bg-red-50'
            };
        case 'high':
            return {
                color: 'bg-orange-50 text-orange-700 border-orange-200',
                icon: <TrendingDown className="w-4 h-4" />,
                dot: 'bg-orange-500',
                bgClass: 'bg-orange-50'
            };
        case 'medium':
            return {
                color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
                icon: <Clock className="w-4 h-4" />,
                dot: 'bg-yellow-500',
                bgClass: 'bg-yellow-50'
            };
        case 'low':
            return {
                color: 'bg-green-50 text-green-700 border-green-200',
                icon: <BarChart3 className="w-4 h-4" />,
                dot: 'bg-green-500',
                bgClass: 'bg-green-50'
            };
        default:
            return {
                color: 'bg-slate-50 text-slate-700 border-slate-200',
                icon: <Package className="w-4 h-4" />,
                dot: 'bg-slate-500',
                bgClass: 'bg-slate-50'
            };
    }
};

const DeadstockCard = ({ item, onShowDetails }: DeadstockCardProps) => {
    const riskConfig = getRiskConfig(item.deadstockRisk);
    
    return (
        <Card className="bg-white border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 group">
            <CardHeader className="pb-3">
                <CardTitle className="flex justify-between items-start">
                    <div className="space-y-1">
                        <span className="text-sm font-medium text-slate-600">Product</span>
                        <p className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {item.productName}
                        </p>
                    </div>
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${riskConfig.color}`}>
                        {riskConfig.icon}
                        {item.deadstockRisk.charAt(0).toUpperCase() + item.deadstockRisk.slice(1)}
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-600">Stock Information</p>
                            <p className="text-slate-900 font-medium">{item.currentStock} units</p>
                            <p className="text-xs text-slate-500">₹{item.stockValue.toLocaleString()} value</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <TrendingDown className="w-4 h-4 text-red-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-600">Days Since Last Sale</p>
                            <p className="text-slate-900 font-medium">{item.daysSinceLastSale} days</p>
                            <p className="text-xs text-slate-500">
                                {item.monthsOfStockRemaining < 999 ? `${item.monthsOfStockRemaining.toFixed(1)} months remaining` : 'No demand data'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <DollarSign className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-600">Potential Loss</p>
                            <p className="text-slate-900 font-medium">₹{item.potentialLoss.toLocaleString()}</p>
                            <p className="text-xs text-slate-500">Category: {item.category}</p>
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between gap-3">
                        <button
                            onClick={() => onShowDetails(item)}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all text-sm font-medium"
                        >
                            <Eye className="w-4 h-4" />
                            View Details
                        </button>
                        <div className="text-xs text-slate-500">
                            <MapPin className="w-3 h-3 inline mr-1" />
                            {item.warehouseLocation}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const DeadstockDetailsModal = ({ item, isOpen, onClose }: DeadstockDetailsModalProps) => {
    if (!isOpen || !item) return null;

    const riskConfig = getRiskConfig(item.deadstockRisk);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold">Deadstock Details</h2>
                            <p className="text-blue-100 mt-1">Complete analysis for {item.productName}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border border-slate-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-slate-900">
                                    <Package className="w-5 h-5 text-blue-600" />
                                    Product Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-sm font-medium text-slate-600">Product Name</label>
                                        <p className="text-lg font-bold text-slate-900">{item.productName}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-600">Category</label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Tag className="w-4 h-4 text-slate-400" />
                                            <p className="text-slate-900 font-medium">{item.category}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-600">Risk Level</label>
                                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium mt-1 ${riskConfig.color}`}>
                                            {riskConfig.icon}
                                            {item.deadstockRisk.charAt(0).toUpperCase() + item.deadstockRisk.slice(1)} Risk
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-600">Warehouse Location</label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <MapPin className="w-4 h-4 text-slate-400" />
                                            <p className="text-slate-900">{item.warehouseLocation}</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border border-slate-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-slate-900">
                                    <BarChart3 className="w-5 h-5 text-green-600" />
                                    Stock & Financial Data
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-sm font-medium text-slate-600">Current Stock</label>
                                        <p className="text-slate-900 font-medium text-lg">{item.currentStock} units</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-600">Unit Price</label>
                                        <p className="text-slate-900 font-medium">₹{item.price.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-600">Total Stock Value</label>
                                        <p className="text-slate-900 font-medium text-lg">₹{item.stockValue.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-600">Potential Loss</label>
                                        <p className="text-red-600 font-bold text-lg">₹{item.potentialLoss.toLocaleString()}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border border-slate-200 lg:col-span-2">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-slate-900">
                                    <TrendingDown className="w-5 h-5 text-orange-600" />
                                    Sales Performance
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <label className="text-sm font-medium text-slate-600">Days Since Last Sale</label>
                                        <p className="text-2xl font-bold text-slate-900">{item.daysSinceLastSale}</p>
                                        <p className="text-xs text-slate-500">days ago</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <label className="text-sm font-medium text-slate-600">Total Quantity Sold</label>
                                        <p className="text-2xl font-bold text-slate-900">{item.totalQuantitySold}</p>
                                        <p className="text-xs text-slate-500">lifetime sales</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <label className="text-sm font-medium text-slate-600">Months of Stock Remaining</label>
                                        <p className="text-2xl font-bold text-slate-900">
                                            {item.monthsOfStockRemaining < 999 ? item.monthsOfStockRemaining.toFixed(1) : '∞'}
                                        </p>
                                        <p className="text-xs text-slate-500">at current demand</p>
                                    </div>
                                </div>
                                {item.lastSaleDate && (
                                    <div>
                                        <label className="text-sm font-medium text-slate-600">Last Sale Date</label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            <p className="text-slate-900">{new Date(item.lastSaleDate).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border border-slate-200 lg:col-span-2">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-slate-900">
                                    <FileText className="w-5 h-5 text-purple-600" />
                                    Recommended Actions
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className={`p-4 rounded-lg border ${riskConfig.bgClass} ${riskConfig.color.replace('text-', 'border-').replace('bg-', 'border-')}`}>
                                    <p className="font-medium text-sm leading-relaxed">{item.recommendedAction}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="border-t border-slate-200 p-6 bg-slate-50">
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
                        >
                            Print Report
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

function useDeadstockData() {
    const [deadstockData, setDeadstockData] = useState<DeadstockAnalysis | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<boolean>(false);

    const fetchReport = useCallback(async (): Promise<void> => {
        setLoading(true);
        setError(false);
        
        try {
            const response = await fetch(`${API_ENDPOINT}/analytics/deadstocks`, {
                headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
            });

            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

            const data: DeadstockResponse = await response.json();
            setDeadstockData(data.deadstock_analysis);
        } catch (error) {
            console.error("Error fetching deadstock report:", error);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    return { deadstockData, loading, error, fetchReport };
}

export default function DeadstockAnalysis() {
    const router = useRouter();
    const { deadstockData, loading, error, fetchReport } = useDeadstockData();
    const [filterText, setFilterText] = useState('');
    const [riskFilter, setRiskFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [selectedItem, setSelectedItem] = useState<DeadstockItem | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleBackToInventory = useCallback((): void => {
        router.push('/inventory');
    }, [router]);

    const handleShowDetails = useCallback((item: DeadstockItem) => {
        setSelectedItem(item);
        setIsModalOpen(true);
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setSelectedItem(null);
    }, []);

    const allItems = useMemo(() => {
        if (!deadstockData) return [];
        return [
            ...deadstockData.critical_deadstock,
            ...deadstockData.high_risk_items,
            ...deadstockData.medium_risk_items,
            ...deadstockData.low_risk_items
        ];
    }, [deadstockData]);

    const categories = useMemo(() => {
        const uniqueCategories = [...new Set(allItems.map(item => item.category))];
        return uniqueCategories.sort();
    }, [allItems]);

    const filteredItems = useMemo(() => {
        let filtered = allItems;

        if (riskFilter !== 'all') {
            filtered = filtered.filter(item => item.deadstockRisk === riskFilter);
        }

        if (categoryFilter !== 'all') {
            filtered = filtered.filter(item => item.category === categoryFilter);
        }

        if (filterText.trim()) {
            const lowerCaseFilter = filterText.toLowerCase();
            filtered = filtered.filter(item => 
                item.productName.toLowerCase().includes(lowerCaseFilter) ||
                item.category.toLowerCase().includes(lowerCaseFilter) ||
                item.warehouseLocation.toLowerCase().includes(lowerCaseFilter)
            );
        }

        return filtered;
    }, [allItems, filterText, riskFilter, categoryFilter]);

    const stats = useMemo(() => {
        if (!deadstockData) return { total: 0, critical: 0, totalValue: 0, potentialSavings: 0 };
        
        return {
            total: deadstockData.summary.total_items_analyzed,
            critical: deadstockData.summary.critical_items_count,
            totalValue: deadstockData.summary.total_deadstock_value,
            potentialSavings: deadstockData.summary.potential_savings
        };
    }, [deadstockData]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <div className="p-6 space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <ActionButton
                            icon={<ArrowLeft className="w-4 h-4" />}
                            label="Back to Inventory"
                            onClick={handleBackToInventory}
                        />
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900">Deadstock Analysis</h1>
                            <p className="text-slate-600 mt-1">Identify and manage slow-moving inventory</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <ActionButton
                            icon={loading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            label="Refresh Analysis"
                            onClick={fetchReport}
                            variant="primary"
                            disabled={loading}
                        />
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatsCard
                        title="Total Items"
                        value={stats.total}
                        subtitle="Items analyzed"
                        icon={<Package className="w-6 h-6 text-blue-600" />}
                        color="bg-blue-50"
                    />
                    <StatsCard
                        title="Critical Items"
                        value={stats.critical}
                        subtitle="Require immediate action"
                        icon={<AlertTriangle className="w-6 h-6 text-red-600" />}
                        color="bg-red-50"
                    />
                    <StatsCard
                        title="Total Value"
                        value={`₹${stats.totalValue.toLocaleString()}`}
                        subtitle="Deadstock value"
                        icon={<DollarSign className="w-6 h-6 text-green-600" />}
                        color="bg-green-50"
                    />
                    <StatsCard
                        title="Potential Savings"
                        value={`₹${stats.potentialSavings.toLocaleString()}`}
                        subtitle="If actions taken"
                        icon={<TrendingDown className="w-6 h-6 text-purple-600" />}
                        color="bg-purple-50"
                    />
                </div>

                {/* Filters */}
                <Card className="bg-white/80 backdrop-blur-md border border-slate-200">
                    <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search by product name, category, or warehouse..."
                                    value={filterText}
                                    onChange={(e) => setFilterText(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <Filter className="w-4 h-4 text-slate-400" />
                                <select
                                    value={riskFilter}
                                    onChange={(e) => setRiskFilter(e.target.value)}
                                    className="bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                >
                                    <option value="all">All Risk Levels</option>
                                    <option value="critical">Critical</option>
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>
                                
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    className="bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                >
                                    <option value="all">All Categories</option>
                                    {categories.map(category => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Content */}
                <div className="space-y-4">
                    {loading ? (
                        <LoadingState />
                    ) : error ? (
                        <ErrorState onRetry={fetchReport} message="Failed to load deadstock analysis" />
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredItems.length > 0 ? (
                                    filteredItems.map((item) => (
                                        <DeadstockCard
                                            key={item.productId}
                                            item={item}
                                            onShowDetails={handleShowDetails}
                                        />
                                    ))
                                ) : (
                                    <div className="col-span-full">
                                        <Card className="bg-white border border-slate-200">
                                            <CardContent className="p-12">
                                                <div className="flex flex-col items-center justify-center text-center">
                                                    <Package className="w-16 h-16 text-slate-300 mb-4" />
                                                    <p className="text-slate-600 font-medium text-lg">No deadstock items found</p>
                                                    <p className="text-slate-500 mt-1">
                                                        {filterText || riskFilter !== 'all' || categoryFilter !== 'all'
                                                            ? 'Try adjusting your search filters'
                                                            : 'Great! Your inventory is moving well'
                                                        }
                                                    </p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}
                            </div>

                            {/* Recommendations */}
                            {deadstockData?.summary.recommendations && deadstockData.summary.recommendations.length > 0 && (
                                <Card className="bg-white border border-slate-200">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <FileText className="w-5 h-5 text-blue-600" />
                                            Recommendations
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {deadstockData.summary.recommendations.map((recommendation, index) => (
                                                <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                                                    <p className="text-blue-800 text-sm">{recommendation}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            </div>

            <DeadstockDetailsModal
                item={selectedItem}
                isOpen={isModalOpen}
                onClose={handleCloseModal}
            />
        </div>
    );
}