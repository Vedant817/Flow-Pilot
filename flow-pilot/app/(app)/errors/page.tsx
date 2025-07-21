/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { AlertTriangle, Search, Server, User, Clock, TrendingDown, AlertCircle, CheckCircle2, XCircle, RefreshCw, Filter, Download, ChevronRight, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorItem {
  id: number;
  message: string;
  type: string;
  severity: string;
  timestamp: string;
}

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
  };
}

const StatsCard = ({ title, value, subtitle, icon, color, trend }: StatsCardProps) => (
  <Card className="bg-white border border-slate-200 hover:shadow-lg transition-all duration-200">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mb-2">{value}</p>
          <p className="text-sm text-slate-500">{subtitle}</p>
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${
              trend.direction === 'down' ? 'text-green-600' : trend.direction === 'up' ? 'text-red-600' : 'text-slate-600'
            }`}>
              <TrendingDown className={`w-3 h-3 ${trend.direction === 'down' ? 'rotate-0' : 'rotate-180'}`} />
              {trend.value} vs last week
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

const ErrorCard = ({ error }: { error: ErrorItem }) => {
  const getSeverityConfig = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return {
          color: 'bg-red-50 text-red-700 border-red-200',
          icon: <XCircle className="w-4 h-4" />,
          dot: 'bg-red-500'
        };
      case 'high':
        return {
          color: 'bg-orange-50 text-orange-700 border-orange-200',
          icon: <AlertCircle className="w-4 h-4" />,
          dot: 'bg-orange-500'
        };
      case 'medium':
        return {
          color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
          icon: <AlertTriangle className="w-4 h-4" />,
          dot: 'bg-yellow-500'
        };
      case 'low':
        return {
          color: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: <CheckCircle2 className="w-4 h-4" />,
          dot: 'bg-blue-500'
        };
      default:
        return {
          color: 'bg-slate-50 text-slate-700 border-slate-200',
          icon: <AlertCircle className="w-4 h-4" />,
          dot: 'bg-slate-500'
        };
    }
  };

  const getTypeIcon = (type: string) => {
    return type === "System" ? 
      <Server className="w-4 h-4 text-purple-600" /> : 
      <User className="w-4 h-4 text-blue-600" />;
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return {
        date: date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        }),
        time: date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      };
    } catch {
      return { date: 'Invalid Date', time: '' };
    }
  };

  const severityConfig = getSeverityConfig(error.severity);
  const timeInfo = formatTimestamp(error.timestamp);

  return (
    <Card className="bg-white border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 group">
      <CardHeader className="pb-3">
        <CardTitle className="flex justify-between items-start gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 transition-colors">
              {getTypeIcon(error.type)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-slate-600">Error #{error.id}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  error.type === 'System' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  {getTypeIcon(error.type)}
                  {error.type}
                </span>
              </div>
              <p className="text-slate-900 font-medium leading-relaxed group-hover:text-blue-600 transition-colors">
                {error.message}
              </p>
            </div>
          </div>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium flex-shrink-0 ${severityConfig.color}`}>
            {severityConfig.icon}
            {error.severity.charAt(0).toUpperCase() + error.severity.slice(1)}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{timeInfo.date}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{timeInfo.time}</span>
            </div>
          </div>
          <button className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 hover:border-slate-300 transition-all text-sm font-medium">
            View Details
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function ErrorsPage() {
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [filterType, setFilterType] = useState("All");
  const [filterSeverity, setFilterSeverity] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchErrors = useCallback(async (isRefresh = false) => {
    try {
      setLoading(!isRefresh);
      setRefreshing(isRefresh);
      setApiError(null);
      
      console.log('API URL:', `${process.env.NEXT_PUBLIC_API_URL}/errors`);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/errors`);
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Full API Response:', data);
      console.log('Type of response:', typeof data);
      console.log('Is array:', Array.isArray(data));
      
      // Handle multiple possible response formats
      let errorsArray = [];
      
      if (Array.isArray(data)) {
        // Direct array response
        errorsArray = data;
        console.log('Using direct array format');
      } else if (data && Array.isArray(data.errors)) {
        // Wrapped in errors property
        errorsArray = data.errors;
        console.log('Using wrapped errors format');
      } else if (data && Array.isArray(data.data)) {
        // Wrapped in data property
        errorsArray = data.data;
        console.log('Using wrapped data format');
      } else {
        console.error('Unexpected data format:', data);
        throw new Error('Unexpected data format received from API');
      }
      
      console.log('Errors array length:', errorsArray.length);
      console.log('First error:', errorsArray[0]);
      
      if (Array.isArray(errorsArray) && errorsArray.length > 0) {
        const mappedErrors = errorsArray.map((error: any, index: number) => {
          console.log(`Processing error ${index}:`, error);
          return {
            id: index + 1,
            message: error.errorMessage || error.message || 'Unknown error',
            type: error.type || 'Unknown',
            severity: (error.severity || 'low').toLowerCase(),
            timestamp: error.timestamp || new Date().toISOString(),
          };
        });
        
        console.log('Mapped errors:', mappedErrors);
        setErrors(mappedErrors);
      } else {
        console.log('No errors in response');
        setErrors([]);
      }
    } catch (error: any) {
      console.error("Error fetching errors:", error);
      setApiError(error.message);
      setErrors([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  const filteredErrors = useMemo(() => {
    return errors.filter((error) => {
      if (filterType !== "All" && error.type !== filterType) return false;
      if (filterSeverity !== "All" && error.severity !== filterSeverity.toLowerCase()) return false;
      if (searchQuery && !error.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [errors, filterType, filterSeverity, searchQuery]);

  const errorStats = useMemo(() => {
    const total = filteredErrors.length;
    const systemErrors = filteredErrors.filter((e) => e.type === "System").length;
    const customerErrors = filteredErrors.filter((e) => e.type === "Customer").length;
    const criticalErrors = filteredErrors.filter((e) => e.severity === "critical").length;
    
    return { total, systemErrors, customerErrors, criticalErrors };
  }, [filteredErrors]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <div className="container mx-auto max-w-7xl">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
              <span className="text-xl text-slate-700 font-medium">Loading error logs...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="container mx-auto max-w-7xl">
        {/* Debug Information - Remove this after fixing */}
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm">
            <div className="font-semibold text-yellow-800 mb-2">Debug Information:</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-yellow-700">
              <div>API URL: {process.env.NEXT_PUBLIC_API_URL}/errors</div>
              <div>Total Errors Loaded: {errors.length}</div>
              <div>Filtered Errors: {filteredErrors.length}</div>
              <div>API Error: {apiError || 'None'}</div>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">Error Management</h1>
              <p className="text-lg text-slate-600">Monitor and analyze system errors across your operations</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchErrors(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-all font-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all font-medium shadow-lg hover:shadow-xl">
                <Download className="w-4 h-4" />
                Export Report
              </button>
            </div>
          </div>
        </div>

        {/* Show API Error if exists */}
        {apiError && (
          <Card className="bg-red-50 border border-red-200 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-700">
                <XCircle className="w-5 h-5" />
                <span className="font-medium">API Error: {apiError}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Errors"
            value={errorStats.total}
            subtitle="All error types"
            icon={<AlertTriangle className="w-6 h-6 text-white" />}
            color="bg-gradient-to-br from-slate-500 to-slate-600"
            trend={{ value: "12%", direction: "down" }}
          />
          <StatsCard
            title="Critical Errors"
            value={errorStats.criticalErrors}
            subtitle="Immediate attention required"
            icon={<XCircle className="w-6 h-6 text-white" />}
            color="bg-gradient-to-br from-red-500 to-red-600"
            trend={{ value: "8%", direction: "down" }}
          />
          <StatsCard
            title="System Errors"
            value={errorStats.systemErrors}
            subtitle="Infrastructure related"
            icon={<Server className="w-6 h-6 text-white" />}
            color="bg-gradient-to-br from-purple-500 to-purple-600"
            trend={{ value: "15%", direction: "down" }}
          />
          <StatsCard
            title="Customer Errors"
            value={errorStats.customerErrors}
            subtitle="User interaction issues"
            icon={<User className="w-6 h-6 text-white" />}
            color="bg-gradient-to-br from-blue-500 to-blue-600"
            trend={{ value: "5%", direction: "up" }}
          />
        </div>

        {/* Filters and Search */}
        <Card className="bg-white border border-slate-200 shadow-sm mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search error messages..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-slate-900 placeholder-slate-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <select
                    className="bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <option value="All">All Types</option>
                    <option value="System">System</option>
                    <option value="Customer">Customer</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value)}
                  >
                    <option value="All">All Severities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error List */}
        <div className="space-y-4">
          {filteredErrors.length > 0 ? (
            filteredErrors.map((error) => (
              <ErrorCard key={error.id} error={error} />
            ))
          ) : (
            <Card className="bg-white border border-slate-200">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  {errors.length === 0 ? "No Errors Found" : "No Errors Match Your Criteria"}
                </h3>
                <p className="text-slate-500">
                  {errors.length === 0 
                    ? "Check the debug information above and browser console for more details." 
                    : "Try adjusting your search terms or filters to find what you're looking for."
                  }
                </p>
                {searchQuery || filterType !== "All" || filterSeverity !== "All" ? (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setFilterType("All");
                      setFilterSeverity("All");
                    }}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all font-medium"
                  >
                    Clear Filters
                  </button>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Results Summary */}
        {filteredErrors.length > 0 && (
          <div className="mt-6">
            <Card className="bg-slate-50 border border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    Showing {filteredErrors.length} of {errors.length} errors
                  </span>
                  <div className="flex items-center gap-4 text-slate-500">
                    <span>Last updated: {new Date().toLocaleTimeString()}</span>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span>Live monitoring</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
