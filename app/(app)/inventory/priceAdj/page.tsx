"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Loader, 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  Clock, 
  CheckCircle2, 
  Package,
  BarChart3,
  Zap,
  AlertCircle,
  ArrowLeft,
  Eye,
  PlusCircle,
  MinusCircle,
  Info
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from 'react-toastify';

const API_ENDPOINT = process.env.NEXT_PUBLIC_API_URL;
const CACHE_KEY = {
  PRICING_DATA: 'pricingData',
  TIMESTAMP: 'pricingTimestamp'
};
const CACHE_EXPIRY_TIME = 5 * 60 * 1000;

interface PricingItem {
  Product: string;
  "Old Price": number;
  "New Price": number;
  Reason: string;
  Confidence: string;
  "Potential Impact": string;
  Urgency: 'high' | 'medium' | 'low';
}

interface PricingResponse {
  "Pricing Suggestions": {
    pricing_recommendations: PricingItem[];
    analysis_date: string;
    total_products_analyzed: number;
    high_priority_adjustments: number;
    summary: string;
  };
}

interface ErrorStateProps {
  onRetry: () => void;
  message?: string;
}

interface PriceAdjustmentBadgeProps {
  oldPrice: number;
  newPrice: number;
}

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: { value: string; positive: boolean };
}

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-lg">
      <Loader className="w-8 h-8 text-white animate-spin" />
    </div>
    <h3 className="text-xl font-semibold text-slate-700 mb-2">Analyzing Pricing Data</h3>
    <p className="text-slate-500">Generating intelligent pricing recommendations...</p>
  </div>
);

const ErrorState = ({ onRetry, message = "Failed to load pricing data" }: ErrorStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
      <AlertTriangle className="w-8 h-8 text-red-500" />
    </div>
    <h3 className="text-xl font-semibold text-slate-700 mb-2">Error Loading Data</h3>
    <p className="text-slate-500 mb-6">{message}</p>
    <Button onClick={onRetry} variant="outline" className="border-slate-300 hover:bg-slate-50">
      <RefreshCw className="w-4 h-4 mr-2" />
      Try Again
    </Button>
  </div>
);

const StatsCard = ({ title, value, subtitle, icon, color, trend }: StatsCardProps) => (
  <Card className="bg-white border border-slate-200 hover:shadow-lg transition-shadow">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs ${
              trend.positive ? 'text-emerald-600' : 'text-red-600'
            }`}>
              <TrendingUp className={`w-3 h-3 ${trend.positive ? '' : 'rotate-180'}`} />
              {trend.value}
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

const UrgencyBadge = ({ urgency }: { urgency: 'high' | 'medium' | 'low' }) => {
  const urgencyConfig = {
    high: { color: 'bg-red-50 text-red-700 border-red-200', icon: <Zap className="w-3 h-3" /> },
    medium: { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock className="w-3 h-3" /> },
    low: { color: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle2 className="w-3 h-3" /> }
  };

  const config = urgencyConfig[urgency];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium ${config.color}`}>
      {config.icon}
      {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
    </span>
  );
};

const PriceAdjustmentBadge = ({ oldPrice, newPrice }: PriceAdjustmentBadgeProps) => {
  const priceDiff = newPrice - oldPrice;
  const isIncrease = priceDiff > 0;
  const percentChange = ((priceDiff / oldPrice) * 100).toFixed(1);
  
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium ${
          isIncrease 
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
            : "bg-red-50 text-red-700 border border-red-200"
        }`}
      >
        {isIncrease ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isIncrease ? `+₹${priceDiff.toFixed(0)}` : `-₹${Math.abs(priceDiff).toFixed(0)}`}
        <span className="text-xs">({isIncrease ? '+' : ''}{percentChange}%)</span>
      </span>
    </div>
  );
};

const PricingRecommendationCard = ({ item, index, onApplyPrice }: { 
  item: PricingItem; 
  index: number; 
  onApplyPrice: (productName: string, newPrice: number) => void;
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [applying, setApplying] = useState(false);
  
  const handleApplyPrice = async () => {
    setApplying(true);
    try {
      await onApplyPrice(item.Product, item["New Price"]);
    } finally {
      setApplying(false);
    }
  };

  const priceDiff = item["New Price"] - item["Old Price"];
  const isIncrease = priceDiff > 0;

  return (
    <Card className="bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{item.Product}</h3>
              <p className="text-sm text-slate-500">Product #{index + 1}</p>
            </div>
          </div>
          <UrgencyBadge urgency={item.Urgency} />
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-600">Current Price</p>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-slate-400" />
              <p className="text-lg font-bold text-slate-900">₹{item["Old Price"].toLocaleString()}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-600">Recommended Price</p>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              <p className={`text-lg font-bold ${isIncrease ? 'text-emerald-600' : 'text-red-600'}`}>
                ₹{item["New Price"].toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <PriceAdjustmentBadge 
          oldPrice={item["Old Price"]} 
          newPrice={item["New Price"]} 
        />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-600" />
            <p className="text-sm font-medium text-slate-600">Confidence: {item.Confidence}</p>
          </div>
          {item["Potential Impact"] && (
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-green-600 mt-0.5" />
              <p className="text-sm text-slate-700">{item["Potential Impact"]}</p>
            </div>
          )}
        </div>

        {showDetails && (
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h4 className="text-sm font-medium text-slate-900 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Recommendation Reason
            </h4>
            <p className="text-sm text-slate-700 leading-relaxed">{item.Reason}</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="text-slate-600 hover:text-slate-900"
          >
            <Eye className="w-4 h-4 mr-2" />
            {showDetails ? 'Hide Details' : 'View Details'}
          </Button>
          
          <Button
            onClick={handleApplyPrice}
            disabled={applying || priceDiff === 0}
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
          >
            {applying ? (
              <Loader className="w-4 h-4 mr-2 animate-spin" />
            ) : isIncrease ? (
              <PlusCircle className="w-4 h-4 mr-2" />
            ) : (
              <MinusCircle className="w-4 h-4 mr-2" />
            )}
            {applying ? 'Applying...' : 'Apply Price'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

function usePricingData() {
  const [pricingData, setPricingData] = useState<PricingItem[]>([]);
  const [analysisInfo, setAnalysisInfo] = useState<{
    analysis_date: string;
    total_products_analyzed: number;
    high_priority_adjustments: number;
    summary: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  const fetchPricingData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(false);

    try {
      const response = await fetch(`${API_ENDPOINT}/analytics/priceAdj`, {
        headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      const data: PricingResponse = await response.json();

      if (!data || !data["Pricing Suggestions"] || !Array.isArray(data["Pricing Suggestions"]["pricing_recommendations"])) {
        console.error("Invalid API response format:", data);
        throw new Error("Invalid API response structure");
      }

      const recommendations = data["Pricing Suggestions"]["pricing_recommendations"];
      const info = {
        analysis_date: data["Pricing Suggestions"]["analysis_date"],
        total_products_analyzed: data["Pricing Suggestions"]["total_products_analyzed"],
        high_priority_adjustments: data["Pricing Suggestions"]["high_priority_adjustments"],
        summary: data["Pricing Suggestions"]["summary"]
      };
      
      setPricingData(recommendations);
      setAnalysisInfo(info);
      cacheData(recommendations);
    } catch (error) {
      console.error("Error fetching pricing data:", error);
      setError(true);

      const cachedData = getCachedData();
      if (cachedData) setPricingData(cachedData);
    } finally {
      setLoading(false);
    }
  }, []);

  const cacheData = (data: PricingItem[]): void => {
    try {
      sessionStorage.setItem(CACHE_KEY.PRICING_DATA, JSON.stringify(data));
      sessionStorage.setItem(CACHE_KEY.TIMESTAMP, Date.now().toString());
    } catch (error) {
      console.warn("Failed to cache pricing data:", error);
    }
  };

  const getCachedData = (): PricingItem[] | null => {
    try {
      const cachedData = sessionStorage.getItem(CACHE_KEY.PRICING_DATA);
      const timestamp = sessionStorage.getItem(CACHE_KEY.TIMESTAMP);
      
      if (!cachedData || !timestamp) return null;
      
      const isRecent = (Date.now() - parseInt(timestamp)) < CACHE_EXPIRY_TIME;
      return isRecent ? JSON.parse(cachedData) : null;
    } catch (error) {
      console.warn("Failed to retrieve cached data:", error);
      return null;
    }
  };

  useEffect(() => {
    const cachedData = getCachedData();
    
    if (cachedData) {
      setPricingData(cachedData);
      setLoading(false);
    } else {
      fetchPricingData();
    }
  }, [fetchPricingData]);

  return { pricingData, analysisInfo, loading, error, fetchPricingData };
}

export default function PricingAdjustment() {
  const router = useRouter();
  const { pricingData, analysisInfo, loading, error, fetchPricingData } = usePricingData();

  const handleBackToDashboard = useCallback((): void => {
    router.push("/inventory");
  }, [router]);

  const handleApplyPrice = useCallback(async (productName: string, newPrice: number) => {
    try {
      const response = await fetch(`${API_ENDPOINT}/inventory`);
      const inventoryData = await response.json();
      const product = inventoryData.find((item: { _id: string; name: string }) => item.name === productName);
      
      if (!product) {
        throw new Error('Product not found in inventory');
      }

      const updateResponse = await fetch(`${API_ENDPOINT}/inventory/update-price`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product._id,
          newPrice: newPrice
        })
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update price');
      }

      const result = await updateResponse.json();
      
      toast.success(`Price updated successfully for ${productName}: ₹${result.product.oldPrice} → ₹${result.product.newPrice} (${result.product.priceChangePercent}%)`);
      
      fetchPricingData();
    } catch (error) {
      console.error("Error applying price:", error);
      toast.error("Failed to update price. Please try again.");
    }
  }, [fetchPricingData]);

  const stats = useMemo(() => {
    if (!pricingData.length || !analysisInfo) return null;

    const priceIncreases = pricingData.filter(item => item["New Price"] > item["Old Price"]).length;
    const priceDecreases = pricingData.filter(item => item["New Price"] < item["Old Price"]).length;
    const highUrgencyItems = pricingData.filter(item => item.Urgency === 'high').length;
    
    const totalPotentialRevenue = pricingData.reduce((sum, item) => {
      const impact = item["Potential Impact"];
      const match = impact.match(/₹([\d,]+)/);
      return sum + (match ? parseInt(match[1].replace(/,/g, '')) : 0);
    }, 0);

    return {
      totalProducts: analysisInfo.total_products_analyzed,
      priceIncreases,
      priceDecreases,
      highUrgencyItems,
      totalPotentialRevenue
    };
  }, [pricingData, analysisInfo]);

  const priorityGroups = useMemo(() => {
    if (!pricingData.length) return { high: [], medium: [], low: [] };
    
    return {
      high: pricingData.filter(item => item.Urgency === 'high'),
      medium: pricingData.filter(item => item.Urgency === 'medium'),
      low: pricingData.filter(item => item.Urgency === 'low')
    };
  }, [pricingData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-50 shadow-sm">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <Button 
                onClick={handleBackToDashboard} 
                variant="ghost" 
                className="text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Inventory
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">💰 AI-Powered Price Optimization</h1>
                <p className="text-slate-600">Intelligent pricing recommendations for maximum profitability</p>
              </div>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-6 py-8">
          <Card className="bg-white shadow-lg">
            <CardContent className="p-12">
              <LoadingState />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button 
                onClick={handleBackToDashboard} 
                variant="ghost" 
                className="text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Inventory
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">💰 AI-Powered Price Optimization</h1>
                <p className="text-slate-600">Intelligent pricing recommendations for maximum profitability</p>
              </div>
            </div>
            <Button
              onClick={fetchPricingData}
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl"
            >
              {loading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh Analysis
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <StatsCard
              title="Products Analyzed"
              value={stats.totalProducts}
              icon={<Package className="w-6 h-6 text-white" />}
              color="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <StatsCard
              title="Price Increases"
              value={stats.priceIncreases}
              subtitle="Recommended"
              icon={<TrendingUp className="w-6 h-6 text-white" />}
              color="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
            <StatsCard
              title="Price Decreases"
              value={stats.priceDecreases}
              subtitle="Recommended"
              icon={<TrendingDown className="w-6 h-6 text-white" />}
              color="bg-gradient-to-br from-red-500 to-red-600"
            />
            <StatsCard
              title="High Priority"
              value={stats.highUrgencyItems}
              subtitle="Urgent adjustments"
              icon={<AlertCircle className="w-6 h-6 text-white" />}
              color="bg-gradient-to-br from-amber-500 to-amber-600"
            />
            <StatsCard
              title="Potential Revenue"
              value={`₹${(stats.totalPotentialRevenue / 1000).toFixed(0)}K`}
              subtitle="Monthly impact"
              icon={<DollarSign className="w-6 h-6 text-white" />}
              color="bg-gradient-to-br from-purple-500 to-purple-600"
            />
          </div>
        )}

        {analysisInfo && (
          <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white mb-8">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-2">Analysis Summary</h3>
              <p className="text-blue-100">{analysisInfo.summary}</p>
            </CardContent>
          </Card>
        )}

        {error && pricingData.length === 0 ? (
          <Card className="bg-white shadow-lg">
            <CardContent className="p-12">
              <ErrorState onRetry={fetchPricingData} />
            </CardContent>
          </Card>
        ) : pricingData.length === 0 ? (
          <Card className="bg-white shadow-lg">
            <CardContent className="p-12">
              <div className="text-center text-slate-500">
                <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-xl font-semibold text-slate-700 mb-2">No Pricing Data Available</h3>
                <p className="mb-6">No products found or pricing analysis not available.</p>
                <Button onClick={fetchPricingData} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  Generate Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {priorityGroups.high.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-red-500" />
                  High Priority Adjustments ({priorityGroups.high.length})
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {priorityGroups.high.map((item, index) => (
                    <PricingRecommendationCard
                      key={`high-${index}`}
                      item={item}
                      index={index}
                      onApplyPrice={handleApplyPrice}
                    />
                  ))}
                </div>
              </div>
            )}

            {priorityGroups.medium.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  Medium Priority Adjustments ({priorityGroups.medium.length})
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {priorityGroups.medium.map((item, index) => (
                    <PricingRecommendationCard
                      key={`medium-${index}`}
                      item={item}
                      index={index + priorityGroups.high.length}
                      onApplyPrice={handleApplyPrice}
                    />
                  ))}
                </div>
              </div>
            )}

            {priorityGroups.low.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Low Priority Adjustments ({priorityGroups.low.length})
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {priorityGroups.low.map((item, index) => (
                    <PricingRecommendationCard
                      key={`low-${index}`}
                      item={item}
                      index={index + priorityGroups.high.length + priorityGroups.medium.length}
                      onApplyPrice={handleApplyPrice}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}