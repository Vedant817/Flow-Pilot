"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader, RefreshCw, AlertTriangle, Tag } from "lucide-react";
import { useRouter } from "next/navigation";

const API_ENDPOINT = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const CACHE_KEY = {
  PRICING_DATA: 'pricingData',
  TIMESTAMP: 'pricingTimestamp'
};
const CACHE_EXPIRY_TIME = 5 * 60 * 1000;

interface PricingItem {
  Product: string;
  "Old Price": number;
  "New Price": number;
}

interface PricingResponse {
  "Pricing Suggestions": {
    pricing_recommendations: PricingItem[];
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

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-400 animate-fade-in">
    <Loader className="w-8 h-8 animate-spin mb-4" />
    <p>Fetching latest pricing recommendations...</p>
  </div>
);

const ErrorState = ({ onRetry, message = "Failed to load pricing data" }: ErrorStateProps) => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
    <AlertTriangle className="w-8 h-8 text-amber-500 mb-4" />
    <p className="mb-4">{message}</p>
    <Button onClick={onRetry} variant="outline" className="border-gray-700 hover:bg-gray-800">
      Try Again
    </Button>
  </div>
);

const PriceAdjustmentBadge = ({ oldPrice, newPrice }: PriceAdjustmentBadgeProps) => {
  const priceDiff = newPrice - oldPrice;
  const isIncrease = priceDiff > 0;
  
  return (
    <span
      className={`px-3 py-1 rounded-lg text-sm font-medium ${
        isIncrease ? "bg-red-600 text-white" : "bg-green-600 text-white"
      }`}
    >
      {isIncrease ? `+${priceDiff.toFixed(2)}` : `${priceDiff.toFixed(2)}`}
    </span>
  );
};

function usePricingData() {
  const [pricingData, setPricingData] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  const fetchPricingData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(false);

    try {
      const response = await fetch(`${API_ENDPOINT}/analytics/dynamic_pricing`, {
        headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      const data: PricingResponse = await response.json();

      if (!data || !data["Pricing Suggestions"] || !Array.isArray(data["Pricing Suggestions"]["pricing_recommendations"])) {
        console.error("Invalid API response format:", data);
        throw new Error("Invalid API response structure");
      }

      const recommendations = data["Pricing Suggestions"]["pricing_recommendations"];
      
      setPricingData(recommendations);
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

  return { pricingData, loading, error, fetchPricingData };
}

export default function PricingAdjustment() {
  const router = useRouter();
  const { pricingData, loading, error, fetchPricingData } = usePricingData();

  const handleBackToDashboard = useCallback((): void => {
    router.push("/inventory");
  }, [router]);

  const tableContent = useMemo(() => {
    if (loading) return <LoadingState />;
    
    if (error && pricingData.length === 0) {
      return <ErrorState onRetry={fetchPricingData} />;
    }
    
    if (pricingData.length === 0) {
      return (
        <div className="text-gray-400 flex flex-col items-center justify-center h-full">
          <p>No pricing adjustments found</p>
          <Button onClick={fetchPricingData} className="mt-4 bg-[#252525] hover:bg-[#333]">
            Generate Report
          </Button>
        </div>
      );
    }
    
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse border border-gray-700 text-white">
          <thead className="bg-[#252525] text-white text-lg">
            <tr>
              <th className="p-4 border border-gray-700">Product</th>
              <th className="p-4 border border-gray-700">Old Price</th>
              <th className="p-4 border border-gray-700">New Price</th>
              <th className="p-4 border border-gray-700">Adjustment</th>
            </tr>
          </thead>
          <tbody>
            {pricingData.map((item, index) => {
              const priceDiff = item["New Price"] - item["Old Price"];
              return (
                <tr key={index} className="hover:bg-[#333] transition">
                  <td className="p-4 border border-gray-700 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-[#00E676]" /> {item.Product}
                  </td>
                  <td className="p-4 border border-gray-700 text-gray-400">
                    Rs.{Number(item["Old Price"]).toFixed(2)}
                  </td>
                  <td
                    className={`p-4 border border-gray-700 font-semibold ${
                      priceDiff > 0 ? "text-red-500" : "text-green-500"
                    }`}
                  >
                    Rs.{Number(item["New Price"]).toFixed(2)}
                  </td>
                  <td className="p-4 border border-gray-700">
                    <PriceAdjustmentBadge oldPrice={item["Old Price"]} newPrice={item["New Price"]} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }, [pricingData, loading, error, fetchPricingData]);

  return (
    <div className="h-screen bg-[#0A0A0A] p-6 w-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button onClick={handleBackToDashboard} variant="ghost" className="text-gray-400 hover:text-white hover:bg-[#1A1A1A]">
            ← Back to Dashboard
          </Button>
          <h1 className="text-2xl font-semibold text-white">💰 Pricing Adjustment</h1>
        </div>
        <Button
          onClick={fetchPricingData}
          disabled={loading}
          className="bg-[#00E676] text-black hover:bg-[#00ff84] px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
        >
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh Report
        </Button>
      </div>

      <Card className="bg-[#1A1A1A] border border-gray-700 rounded-lg flex-1 shadow-md overflow-hidden animate-fade-in">
        <CardContent className="p-6 h-full overflow-auto">
          {tableContent}
        </CardContent>
      </Card>
    </div>
  );
}