"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  Loader2, 
  RefreshCw, 
  AlertTriangle, 
  Package, 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  BarChart3,
  Zap,
  Users,
  ShoppingCart,
  Percent,
  Timer,
  TrendingUpIcon,
  Building2,
  Eye,
  Star,
  Lightbulb
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_ENDPOINT = process.env.NEXT_PUBLIC_API_URL;

interface ForecastingResult {
  product: string;
  current_stock: number;
  recommended_stock: number;
  urgency_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  days_until_stockout: number;
  expected_daily_demand: number;
  reorder_point: number;
  economic_order_quantity: number;
  optimal_bulk_discount: number;
  cost_impact: number;
  potential_lost_sales: number;
  confidence_score: number;
  trend_direction: 'INCREASING' | 'STABLE' | 'DECREASING';
  seasonality_factor: number;
  market_growth_rate: number;
  order_frequency: number;
  avg_order_size: number;
  customer_segment_split: { B2B: number; B2C: number };
  profit_margin: string;
  next_month_demand_forecast: number;
  safety_stock: number;
  lead_time_days: number;
  supplier_reliability: number;
  reasons: string[];
  recommendations: string[];
}

interface AnalyticsResponse {
  urgent_restocking: ForecastingResult[];
  summary: {
    total_products_analyzed: number;
    products_needing_attention: number;
    critical_items: number;
    high_priority_items: number;
    total_estimated_cost: number;
    potential_lost_sales: number;
    confidence_score: number;
    total_monthly_orders: number;
    avg_profit_margin: string;
  };
  market_insights: {
    fastest_growing_category: string;
    seasonal_peak_approaching: string[];
    high_competition_categories: string[];
  };
  generated_at: string;
  next_analysis_recommended: string;
  methodology: string;
}

const UrgencyBadge = ({ level }: { level: string }) => {
  const config = useMemo(() => {
    switch (level) {
      case 'CRITICAL':
        return { color: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle };
      case 'HIGH':
        return { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertTriangle };
      case 'MEDIUM':
        return { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock };
      case 'LOW':
        return { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircle2 };
      default:
        return { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Activity };
    }
  }, [level]);

  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${config.color}`}>
      <Icon className="w-4 h-4" />
      {level}
    </div>
  );
};

const TrendIndicator = ({ direction }: { direction: string }) => {
  const config = useMemo(() => {
    switch (direction) {
      case 'INCREASING':
        return { color: 'text-green-600', icon: TrendingUp, label: 'Rising' };
      case 'DECREASING':
        return { color: 'text-red-600', icon: TrendingDown, label: 'Declining' };
      default:
        return { color: 'text-blue-600', icon: Activity, label: 'Stable' };
    }
  }, [direction]);

  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1 text-sm ${config.color}`}>
      <Icon className="w-4 h-4" />
      {config.label}
    </div>
  );
};

const StatsCard = ({ title, value, subtitle, icon, color, trend }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: string;
}) => (
  <Card className="bg-white border border-slate-200 hover:shadow-lg transition-shadow">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <TrendingUpIcon className="w-3 h-3 text-green-500" />
              <span className="text-xs text-green-600 font-medium">{trend}</span>
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

const EnterpriseMetrics = ({ item }: { item: ForecastingResult }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
    <div className="bg-blue-50 rounded-lg p-3 text-center">
      <div className="flex items-center justify-center gap-1 mb-1">
        <ShoppingCart className="w-4 h-4 text-blue-600" />
        <span className="text-xs font-medium text-blue-600">Orders/Month</span>
      </div>
      <p className="text-lg font-bold text-blue-700">{item.order_frequency}</p>
    </div>
    
    <div className="bg-green-50 rounded-lg p-3 text-center">
      <div className="flex items-center justify-center gap-1 mb-1">
        <Percent className="w-4 h-4 text-green-600" />
        <span className="text-xs font-medium text-green-600">Profit</span>
      </div>
      <p className="text-lg font-bold text-green-700">{item.profit_margin}%</p>
    </div>
    
    <div className="bg-purple-50 rounded-lg p-3 text-center">
      <div className="flex items-center justify-center gap-1 mb-1">
        <Timer className="w-4 h-4 text-purple-600" />
        <span className="text-xs font-medium text-purple-600">Lead Time</span>
      </div>
      <p className="text-lg font-bold text-purple-700">{item.lead_time_days}d</p>
    </div>
    
    <div className="bg-orange-50 rounded-lg p-3 text-center">
      <div className="flex items-center justify-center gap-1 mb-1">
        <Star className="w-4 h-4 text-orange-600" />
        <span className="text-xs font-medium text-orange-600">Reliability</span>
      </div>
      <p className="text-lg font-bold text-orange-700">{Math.round(item.supplier_reliability * 100)}%</p>
    </div>
  </div>
);

const CustomerSegmentChart = ({ segments }: { segments: { B2B: number; B2C: number } }) => (
  <div className="space-y-2">
    <p className="text-sm font-medium text-slate-700">Customer Segments</p>
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-slate-600">B2B</span>
        </div>
        <span className="text-sm font-semibold text-slate-900">{Math.round(segments.B2B * 100)}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div 
          className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
          style={{ width: `${segments.B2B * 100}%` }}
        ></div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-green-600" />
          <span className="text-sm text-slate-600">B2C</span>
        </div>
        <span className="text-sm font-semibold text-slate-900">{Math.round(segments.B2C * 100)}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div 
          className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full"
          style={{ width: `${segments.B2C * 100}%` }}
        ></div>
      </div>
    </div>
  </div>
);

const ProductCard = ({ item }: { item: ForecastingResult }) => {
  const restockAmount = item.recommended_stock - item.current_stock;
  const hasDiscount = item.optimal_bulk_discount > 0;
  
  return (
    <Card className="bg-white border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg text-slate-900">{item.product}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <TrendIndicator direction={item.trend_direction} />
                {hasDiscount && (
                  <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                    {Math.round(item.optimal_bulk_discount * 100)}% Bulk Discount
                  </div>
                )}
              </div>
            </div>
          </div>
          <UrgencyBadge level={item.urgency_level} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stock Information */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-sm font-medium text-slate-600">Current Stock</p>
            <p className="text-2xl font-bold text-slate-900">{item.current_stock}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm font-medium text-blue-600">Recommended</p>
            <p className="text-2xl font-bold text-blue-700">{item.recommended_stock}</p>
          </div>
        </div>

        {/* Enterprise Metrics */}
        <EnterpriseMetrics item={item} />

        {/* Advanced Analytics */}
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Daily Demand:</span>
                <span className="font-semibold text-slate-900">{item.expected_daily_demand}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Reorder Point:</span>
                <span className="font-semibold text-slate-900">{item.reorder_point}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Safety Stock:</span>
                <span className="font-semibold text-slate-900">{item.safety_stock}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">EOQ:</span>
                <span className="font-semibold text-slate-900">{item.economic_order_quantity}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Stockout in:</span>
                <span className={`font-semibold ${item.days_until_stockout <= 7 ? 'text-red-600' : 'text-slate-900'}`}>
                  {item.days_until_stockout} days
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Next Month:</span>
                <span className="font-semibold text-slate-900">{item.next_month_demand_forecast}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Avg Order Size:</span>
                <span className="font-semibold text-slate-900">{item.avg_order_size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Market Growth:</span>
                <span className="font-semibold text-green-600">+{Math.round(item.market_growth_rate * 100)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Impact */}
        <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg p-4 space-y-2">
          <h4 className="font-semibold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Financial Impact
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-600">Restock Cost:</span>
              <p className="font-bold text-blue-700">₹{item.cost_impact.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-slate-600">Potential Lost Sales:</span>
              <p className="font-bold text-red-600">₹{item.potential_lost_sales.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Customer Segments */}
        <CustomerSegmentChart segments={item.customer_segment_split} />

        {/* Confidence Score */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Forecast Confidence:</span>
          <div className="flex items-center gap-2">
            <div className="w-20 bg-slate-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
                style={{ width: `${item.confidence_score * 100}%` }}
              ></div>
            </div>
            <span className="text-sm font-semibold text-slate-900">{Math.round(item.confidence_score * 100)}%</span>
          </div>
        </div>

        {/* Reasons */}
        {item.reasons.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Analysis Insights:
            </p>
            <ul className="text-xs text-slate-600 space-y-1">
              {item.reasons.slice(0, 3).map((reason, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-1 h-1 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {item.recommendations.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Strategic Recommendations:
            </p>
            <ul className="text-xs text-slate-600 space-y-1">
              {item.recommendations.slice(0, 3).map((rec, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Needed */}
        <div className="border-t border-slate-100 pt-4">
          <div className={`p-3 rounded-lg ${
            restockAmount > 0 
              ? 'bg-orange-50 border border-orange-200' 
              : 'bg-green-50 border border-green-200'
          }`}>
            <p className={`text-sm font-medium ${
              restockAmount > 0 ? 'text-orange-800' : 'text-green-800'
            }`}>
              {restockAmount > 0 
                ? `Recommended Action: Order ${restockAmount} units${hasDiscount ? ` (${Math.round(item.optimal_bulk_discount * 100)}% discount applies)` : ''}` 
                : 'Stock levels are adequate'
              }
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function InventoryForecasting() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchAnalytics = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_ENDPOINT}/analytics/forecasting`, {
        headers: { 
          "Cache-Control": "no-cache", 
          "Pragma": "no-cache" 
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.message || result.error);
      }

      setData(result);
    } catch (err) {
      console.error("Error fetching analytics:", err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleBackToInventory = useCallback((): void => {
    router.push("/inventory");
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <Card className="p-12 text-center max-w-md w-full mx-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Enterprise Analytics Processing</h2>
          <p className="text-slate-600">Analyzing market trends, demand patterns, and optimization opportunities...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-pink-50 flex items-center justify-center">
        <Card className="p-12 text-center max-w-md w-full mx-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Analytics Error</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl"
          >
            Try Again
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToInventory}
                className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Enterprise Inventory Analytics</h1>
                <p className="text-slate-600 mt-1">AI-powered demand forecasting with market intelligence and profit optimization</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchAnalytics}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl font-medium disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Refresh Analysis
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {data && (
          <>
            {/* Enhanced Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatsCard
                title="Products Analyzed"
                value={data.summary.total_products_analyzed}
                subtitle={`${data.summary.products_needing_attention} need attention`}
                icon={<BarChart3 className="w-6 h-6 text-white" />}
                color="bg-gradient-to-br from-blue-500 to-blue-600"
              />
              <StatsCard
                title="Critical Items"
                value={data.summary.critical_items}
                subtitle="Immediate action required"
                icon={<AlertCircle className="w-6 h-6 text-white" />}
                color="bg-gradient-to-br from-red-500 to-red-600"
              />
              <StatsCard
                title="Investment Required"
                value={`₹${Math.round(data.summary.total_estimated_cost / 1000)}K`}
                subtitle="Estimated restocking cost"
                icon={<DollarSign className="w-6 h-6 text-white" />}
                color="bg-gradient-to-br from-green-500 to-green-600"
              />
              <StatsCard
                title="Potential Loss"
                value={`₹${Math.round(data.summary.potential_lost_sales / 1000)}K`}
                subtitle="If not restocked"
                icon={<AlertTriangle className="w-6 h-6 text-white" />}
                color="bg-gradient-to-br from-orange-500 to-orange-600"
              />
            </div>

            {/* Market Insights */}
            {data.market_insights && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Market Intelligence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <p className="font-semibold text-green-800">Fastest Growing</p>
                      <p className="text-lg font-bold text-green-700">
                        {data.market_insights?.fastest_growing_category || 'N/A'}
                      </p>
                    </div>
                    
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <Calendar className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                      <p className="font-semibold text-orange-800">Seasonal Peaks</p>
                      <p className="text-sm text-orange-700">
                        {data.market_insights?.seasonal_peak_approaching?.length > 0 
                          ? `${data.market_insights.seasonal_peak_approaching.length} products peaking`
                          : 'No peaks approaching'
                        }
                      </p>
                    </div>
                    
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <BarChart3 className="w-8 h-8 text-red-600 mx-auto mb-2" />
                      <p className="font-semibold text-red-800">High Competition</p>
                      <p className="text-sm text-red-700">
                        {data.market_insights?.high_competition_categories?.length || 0} categories
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Analysis Info */}
            <Card className="mb-8">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Analysis Generated</p>
                      <p className="text-sm text-slate-600">
                        {new Date(data.generated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-600">Methodology</p>
                    <p className="text-xs text-slate-500 max-w-md">
                      {data.methodology}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Enterprise Recommendations */}
            {data.urgent_restocking.length > 0 ? (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Strategic Inventory Recommendations ({data.urgent_restocking.length})
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {data.urgent_restocking.map((item, index) => (
                    <ProductCard key={index} item={item} />
                  ))}
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Optimal Inventory Levels</h3>
                  <p className="text-slate-600 mb-6">All products are currently meeting demand projections and market requirements.</p>
                  <button
                    onClick={fetchAnalytics}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl font-medium"
                  >
                    Refresh Analysis
                  </button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}