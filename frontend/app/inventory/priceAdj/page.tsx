"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader, RefreshCw, AlertTriangle, Tag } from "lucide-react";
import { useRouter } from "next/navigation";

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-400 animate-fade-in">
    <Loader className="w-8 h-8 animate-spin mb-4" />
    <p>Fetching latest pricing recommendations...</p>
  </div>
);

const ErrorState = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
    <AlertTriangle className="w-8 h-8 text-amber-500 mb-4" />
    <p className="mb-4">Failed to load pricing data</p>
    <Button onClick={onRetry} variant="outline" className="border-gray-700 hover:bg-gray-800">
      Try Again
    </Button>
  </div>
);

export default function PricingAdjustment() {
  const [pricingData, setPricingData] = useState<{ Product: string; "Old Price": number; "New Price": number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const router = useRouter();

  const fetchPricingData = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      // Clear previous data
      sessionStorage.removeItem("pricingData");
      sessionStorage.removeItem("pricingTimestamp");

      const response = await fetch("http://localhost:5000/dynamic_pricing", {
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      const data = await response.json();

      // Debugging Logs
      console.log("🔹 API Response:", data);

      // Extract Correct Data
      if (!data || !data["Pricing Suggestions"] || !Array.isArray(data["Pricing Suggestions"]["pricing_recommendations"])) {
        console.error("❌ Invalid API response format:", data);
        throw new Error("Invalid API response structure");
      }

      const recommendations = data["Pricing Suggestions"]["pricing_recommendations"];
      console.log("🔹 Extracted Recommendations:", recommendations);

      if (recommendations.length === 0) {
        console.warn("⚠️ No pricing adjustments found in API response.");
      }

      setPricingData(recommendations);
      sessionStorage.setItem("pricingData", JSON.stringify(recommendations));
      sessionStorage.setItem("pricingTimestamp", Date.now().toString());
    } catch (error) {
      console.error("❌ Error fetching pricing data:", error);
      setError(true);

      const cachedData = sessionStorage.getItem("pricingData");
      if (cachedData && cachedData !== "undefined") {
        try {
          setPricingData(JSON.parse(cachedData));
        } catch (parseError) {
          console.error("❌ Error parsing cached pricing data:", parseError);
          sessionStorage.removeItem("pricingData");
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPricingData();
  }, [fetchPricingData]);

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

      {/* Report Card */}
      <Card className="bg-[#1A1A1A] border border-gray-700 rounded-lg flex-1 shadow-md overflow-hidden animate-fade-in">
        <CardContent className="p-6 h-full overflow-auto">
          {loading ? (
            <LoadingState />
          ) : error && pricingData.length === 0 ? (
            <ErrorState onRetry={fetchPricingData} />
          ) : pricingData.length > 0 ? (
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
                        <td className="p-4 border border-gray-700 text-gray-400">${Number(item["Old Price"]).toFixed(2)}</td>
                        <td
                          className={`p-4 border border-gray-700 font-semibold ${
                            priceDiff > 0 ? "text-red-500" : "text-green-500"
                          }`}
                        >
                          ${Number(item["New Price"]).toFixed(2)}
                        </td>
                        <td className="p-4 border border-gray-700">
                          <span
                            className={`px-3 py-1 rounded-lg text-sm font-medium ${
                              priceDiff > 0 ? "bg-red-600 text-white" : "bg-green-600 text-white"
                            }`}
                          >
                            {priceDiff > 0 ? `+${priceDiff.toFixed(2)}` : `${priceDiff.toFixed(2)}`}
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
              <p>No pricing adjustments found</p>
              <Button onClick={fetchPricingData} className="mt-4 bg-[#252525] hover:bg-[#333]">
                Generate Report
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
