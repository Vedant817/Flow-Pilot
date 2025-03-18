"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader, RefreshCw, AlertTriangle, Box } from "lucide-react";
import { useRouter } from "next/navigation";

const API_ENDPOINT = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const CACHE_KEY = {
  INVENTORY_DATA: 'inventoryData',
  TIMESTAMP: 'inventoryTimestamp'
};
const CACHE_EXPIRY_TIME = 5 * 60 * 1000;

interface InventoryItem {
  product: string;
  current_stock: number;
  recommended_stock: number;
}

interface ErrorStateProps {
  onRetry: () => void;
  message?: string;
}

interface RestockBadgeProps {
  current: number;
  recommended: number;
}

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-400 animate-fade-in">
    <Loader className="w-8 h-8 animate-spin mb-4" />
    <p>Fetching latest inventory forecasts...</p>
  </div>
);

const ErrorState = ({ onRetry, message = "Failed to load inventory data" }: ErrorStateProps) => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
    <AlertTriangle className="w-8 h-8 text-amber-500 mb-4" />
    <p className="mb-4">{message}</p>
    <Button onClick={onRetry} variant="outline" className="border-gray-700 hover:bg-gray-800">
      Try Again
    </Button>
  </div>
);

const RestockBadge = ({ current, recommended }: RestockBadgeProps) => {
  const restockAmount = recommended - current;
  const needsRestock = restockAmount > 0;
  
  return (
    <span
      className={`px-3 py-1 rounded-lg text-sm font-medium ${
        needsRestock ? "bg-yellow-600 text-white" : "bg-gray-600 text-white"
      }`}
    >
      {needsRestock ? `+${restockAmount}` : "No Restocking Needed"}
    </span>
  );
};

function useInventoryData() {
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  const fetchInventoryData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(false);

    try {
      const response = await fetch(`${API_ENDPOINT}/analytics/urgent-restocking`, {
        headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      const data = await response.json();

      if (!data || !Array.isArray(data.urgent_restocking)) {
        console.error("Invalid API response format:", data);
        throw new Error("Invalid API response structure");
      }

      const recommendations = data.urgent_restocking;
      
      setInventoryData(recommendations);
      cacheData(recommendations);
    } catch (error) {
      console.error("Error fetching inventory data:", error);
      setError(true);

      const cachedData = getCachedData();
      if (cachedData) setInventoryData(cachedData);
    } finally {
      setLoading(false);
    }
  }, []);

  const cacheData = (data: InventoryItem[]): void => {
    try {
      sessionStorage.setItem(CACHE_KEY.INVENTORY_DATA, JSON.stringify(data));
      sessionStorage.setItem(CACHE_KEY.TIMESTAMP, Date.now().toString());
    } catch (error) {
      console.warn("Failed to cache inventory data:", error);
    }
  };

  const getCachedData = (): InventoryItem[] | null => {
    try {
      const cachedData = sessionStorage.getItem(CACHE_KEY.INVENTORY_DATA);
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
      setInventoryData(cachedData);
      setLoading(false);
    } else {
      fetchInventoryData();
    }
  }, [fetchInventoryData]);

  return { inventoryData, loading, error, fetchInventoryData };
}

export default function InventoryForecasting() {
  const router = useRouter();
  const { inventoryData, loading, error, fetchInventoryData } = useInventoryData();

  const handleBackToDashboard = useCallback((): void => {
    router.push("/inventory");
  }, [router]);

  const tableContent = useMemo(() => {
    if (loading) return <LoadingState />;
    
    if (error && inventoryData.length === 0) {
      return <ErrorState onRetry={fetchInventoryData} />;
    }
    
    if (inventoryData.length === 0) {
      return (
        <div className="text-gray-400 flex flex-col items-center justify-center h-full">
          <p>No urgent restocking required</p>
          <Button onClick={fetchInventoryData} className="mt-4 bg-[#252525] hover:bg-[#333]">
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
              <th className="p-4 border border-gray-700">Current Stock</th>
              <th className="p-4 border border-gray-700">Recommended Stock</th>
              <th className="p-4 border border-gray-700">Restocking Needed</th>
            </tr>
          </thead>
          <tbody>
            {inventoryData.map((item, index) => (
              <tr key={index} className="hover:bg-[#333] transition">
                <td className="p-4 border border-gray-700 flex items-center gap-2">
                  <Box className="w-5 h-5 text-[#00E676]" /> {item.product}
                </td>
                <td className="p-4 border border-gray-700 text-gray-400">{item.current_stock}</td>
                <td className="p-4 border border-gray-700 font-semibold">{item.recommended_stock}</td>
                <td className="p-4 border border-gray-700">
                  <RestockBadge current={item.current_stock} recommended={item.recommended_stock} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [inventoryData, loading, error, fetchInventoryData]);

  return (
    <div className="h-screen bg-[#0A0A0A] p-6 w-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button onClick={handleBackToDashboard} variant="ghost" className="text-gray-400 hover:text-white hover:bg-[#1A1A1A]">
            ← Back to Dashboard
          </Button>
          <h1 className="text-2xl font-semibold text-white">📦 Inventory Forecasting</h1>
        </div>
        <Button
          onClick={fetchInventoryData}
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
