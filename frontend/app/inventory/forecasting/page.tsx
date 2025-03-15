"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader, RefreshCw, AlertTriangle, Box } from "lucide-react";
import { useRouter } from "next/navigation";

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-400 animate-fade-in">
    <Loader className="w-8 h-8 animate-spin mb-4" />
    <p>Fetching latest inventory forecasts...</p>
  </div>
);

const ErrorState = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
    <AlertTriangle className="w-8 h-8 text-amber-500 mb-4" />
    <p className="mb-4">Failed to load inventory data</p>
    <Button onClick={onRetry} variant="outline" className="border-gray-700 hover:bg-gray-800">
      Try Again
    </Button>
  </div>
);

export default function InventoryForecasting() {
  const [inventoryData, setInventoryData] = useState<{ product: string; current_stock: number; recommended_stock: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const router = useRouter();

  const fetchInventoryData = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      // Clear previous data
      sessionStorage.removeItem("inventoryData");
      sessionStorage.removeItem("inventoryTimestamp");

      const response = await fetch("http://localhost:5000/urgent-restocking", {
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      const data = await response.json();

      // Debugging Logs
      console.log("🔹 API Response:", data);

      // Extract Correct Data
      if (!data || !Array.isArray(data["urgent_restocking"])) {
        console.error("❌ Invalid API response format:", data);
        throw new Error("Invalid API response structure");
      }

      const recommendations = data["urgent_restocking"];
      console.log("🔹 Extracted Restocking Recommendations:", recommendations);

      if (recommendations.length === 0) {
        console.warn("⚠️ No urgent restocking required.");
      }

      setInventoryData(recommendations);
      sessionStorage.setItem("inventoryData", JSON.stringify(recommendations));
      sessionStorage.setItem("inventoryTimestamp", Date.now().toString());
    } catch (error) {
      console.error("❌ Error fetching inventory data:", error);
      setError(true);

      const cachedData = sessionStorage.getItem("inventoryData");
      if (cachedData && cachedData !== "undefined") {
        try {
          setInventoryData(JSON.parse(cachedData));
        } catch (parseError) {
          console.error("❌ Error parsing cached inventory data:", parseError);
          sessionStorage.removeItem("inventoryData");
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventoryData();
  }, [fetchInventoryData]);

  const handleBackToDashboard = useCallback(() => {
    router.push("/");
  }, [router]);

  return (
    <div className="h-screen bg-[#0A0A0A] p-6 w-full flex flex-col">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
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

      {/* Report Card */}
      <Card className="bg-[#1A1A1A] border border-gray-700 rounded-lg flex-1 shadow-md overflow-hidden animate-fade-in">
        <CardContent className="p-6 h-full overflow-auto">
          {loading ? (
            <LoadingState />
          ) : error && inventoryData.length === 0 ? (
            <ErrorState onRetry={fetchInventoryData} />
          ) : inventoryData.length > 0 ? (
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
                  {inventoryData.map((item, index) => {
                    const restockAmount = item.recommended_stock - item.current_stock;
                    return (
                      <tr key={index} className="hover:bg-[#333] transition">
                        <td className="p-4 border border-gray-700 flex items-center gap-2">
                          <Box className="w-5 h-5 text-[#00E676]" /> {item.product}
                        </td>
                        <td className="p-4 border border-gray-700 text-gray-400">{item.current_stock}</td>
                        <td className="p-4 border border-gray-700 font-semibold">{item.recommended_stock}</td>
                        <td className="p-4 border border-gray-700">
                          <span
                            className={`px-3 py-1 rounded-lg text-sm font-medium ${
                              restockAmount > 0 ? "bg-yellow-600 text-white" : "bg-gray-600 text-white"
                            }`}
                          >
                            {restockAmount > 0 ? `+${restockAmount}` : "No Restocking Needed"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-gray-400 flex flex-col items-center justify-center h-full">
              <p>No urgent restocking required</p>
              <Button onClick={fetchInventoryData} className="mt-4 bg-[#252525] hover:bg-[#333]">
                Generate Report
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
