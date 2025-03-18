'use client';
import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader, RefreshCw, AlertTriangle, Package, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";

const API_ENDPOINT = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const CACHE_EXPIRY_TIME = 5 * 60 * 1000;
const CACHE_KEY = {
  DEADSTOCKS: 'deadstocks',
  TIMESTAMP: 'deadstockTimestamp'
};

enum InventoryStatus {
  LOW = "Low",
  MODERATE = "Moderate",
  EXCESS = "Excess"
}

const INVENTORY_THRESHOLDS = {
  LOW: 50,
  MODERATE: 100
};
interface DeadstockItem {
  name: string;
  inventory: number;
  sales: number;
}

interface ErrorStateProps {
  onRetry: () => void;
  message?: string;
}

interface StatusBadgeProps {
  inventory: number;
}

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-400 animate-fade-in">
    <Loader className="w-8 h-8 animate-spin mb-4" />
    <p>Generating deadstock analysis...</p>
  </div>
);

const ErrorState = ({ onRetry, message = "Failed to load deadstock analysis" }: ErrorStateProps) => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
    <AlertTriangle className="w-8 h-8 text-amber-500 mb-4" />
    <p className="mb-4">{message}</p>
    <Button onClick={onRetry} variant="outline" className="border-gray-700 hover:bg-gray-800">
      Try Again
    </Button>
  </div>
);

const StatusBadge = ({ inventory }: StatusBadgeProps) => {
  const status = useMemo(() => {
    if (inventory > INVENTORY_THRESHOLDS.MODERATE) return InventoryStatus.EXCESS;
    if (inventory > INVENTORY_THRESHOLDS.LOW) return InventoryStatus.MODERATE;
    return InventoryStatus.LOW;
  }, [inventory]);

  const badgeClass = useMemo(() => {
    switch (status) {
      case InventoryStatus.EXCESS:
        return "bg-red-600 text-white";
      case InventoryStatus.MODERATE:
        return "bg-orange-500 text-white";
      case InventoryStatus.LOW:
        return "bg-green-600 text-white";
      default:
        return "bg-gray-600 text-white";
    }
  }, [status]);

  return (
    <span className={`px-3 py-1 rounded-lg text-sm font-medium ${badgeClass}`}>
      {status}
    </span>
  );
};

function useDeadstockData() {
  const [deadstocks, setDeadstocks] = useState<DeadstockItem[]>([]);
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
  
      const data = await response.json();
  
      if (data.error && data.response_text) {
        try {
          const jsonMatch = data.response_text.match(/```json\s*([\s\S]*?)\s*```/);
  
          if (jsonMatch && jsonMatch[1]) {
            const extractedData = JSON.parse(jsonMatch[1].trim());
            setDeadstocks(extractedData.deadstocks || []);
            cacheData(extractedData.deadstocks || []);
          } else {
            const extractedData = JSON.parse(data.response_text.trim());
            setDeadstocks(extractedData.deadstocks || []);
            cacheData(extractedData.deadstocks || []);
          }
        } catch (jsonError) {
          console.error("Failed to parse JSON:", jsonError);
          setError(true);
        }
      } else {
        const deadstocksData = data.deadstocks || [];
        setDeadstocks(deadstocksData);
        cacheData(deadstocksData);
      }
    } catch (error) {
      console.error("Error fetching deadstock report:", error);
      setError(true);
  
      const cachedData = getCachedData();
      if (cachedData) setDeadstocks(cachedData);
    } finally {
      setLoading(false);
    }
  }, []);

  const cacheData = (data: DeadstockItem[]): void => {
    try {
      sessionStorage.setItem(CACHE_KEY.DEADSTOCKS, JSON.stringify(data));
      sessionStorage.setItem(CACHE_KEY.TIMESTAMP, Date.now().toString());
    } catch (error) {
      console.warn("Failed to cache deadstock data:", error);
    }
  };

  const getCachedData = (): DeadstockItem[] | null => {
    try {
      const cachedData = sessionStorage.getItem(CACHE_KEY.DEADSTOCKS);
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
      setDeadstocks(cachedData);
      setLoading(false);
    } else {
      fetchReport();
    }
  }, [fetchReport]);

  return { deadstocks, loading, error, fetchReport };
}

export default function DeadstockAnalysis() {
  const router = useRouter();
  const { deadstocks, loading, error, fetchReport } = useDeadstockData();

  const handleBackToInventory = useCallback((): void => {
    router.push('/inventory');
  }, [router]);

  const tableContent = useMemo(() => {
    if (loading) return <LoadingState />;
    
    if (error && deadstocks.length === 0) {
      return <ErrorState onRetry={fetchReport} />;
    }
    
    if (deadstocks.length === 0) {
      return (
        <div className="text-gray-400 flex flex-col items-center justify-center h-full">
          <p>No deadstock items found</p>
          <Button onClick={fetchReport} className="mt-4 bg-[#252525] hover:bg-[#333]">
            Generate Report
          </Button>
        </div>
      );
    }
    
    return (
      <div className="overflow-x-auto rounded-lg">
        <table className="w-full text-left border-collapse border border-gray-700 text-white">
          <thead className="bg-[#252525] text-white text-lg sticky top-0">
            <tr>
              <th className="p-4 border border-gray-700">Product</th>
              <th className="p-4 border border-gray-700">Inventory</th>
              <th className="p-4 border border-gray-700">Sales</th>
              <th className="p-4 border border-gray-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {deadstocks.map((item, index) => (
              <tr key={index} className="hover:bg-[#333] transition">
                <td className="p-4 border border-gray-700 flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#00E676]" /> {item.name}
                </td>
                <td className="p-4 border border-gray-700">{item.inventory}</td>
                <td className="p-4 border border-gray-700 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-[#00BFFF]" /> {item.sales}
                </td>
                <td className="p-4 border border-gray-700">
                  <StatusBadge inventory={item.inventory} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [deadstocks, loading, error, fetchReport]);

  return (
    <div className="h-screen bg-[#0A0A0A] p-6 w-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button onClick={handleBackToInventory} variant="ghost" className="text-gray-400 hover:text-white hover:bg-[#1A1A1A]">
            ← Back to Inventory
          </Button>
          <h1 className="text-2xl font-semibold text-white">📊 Deadstock Analysis</h1>
        </div>
        <Button 
          onClick={fetchReport} 
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