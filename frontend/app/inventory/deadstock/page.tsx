'use client';
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader, RefreshCw, AlertTriangle, Package, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-400 animate-fade-in">
    <Loader className="w-8 h-8 animate-spin mb-4" />
    <p>Generating deadstock analysis...</p>
  </div>
);

const ErrorState = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
    <AlertTriangle className="w-8 h-8 text-amber-500 mb-4" />
    <p className="mb-4">Failed to load deadstock analysis</p>
    <Button onClick={onRetry} variant="outline" className="border-gray-700 hover:bg-gray-800">
      Try Again
    </Button>
  </div>
);

export default function DeadstockAnalysis() {
  const [deadstocks, setDeadstocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const router = useRouter();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const response = await fetch("http://127.0.0.1:5000/deadstocks", {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      const data = await response.json();
      setDeadstocks(data.deadstocks || []);
      sessionStorage.setItem('deadstocks', JSON.stringify(data.deadstocks));
      sessionStorage.setItem('deadstockTimestamp', Date.now().toString());
    } catch (error) {
      console.error("Error fetching deadstock report:", error);
      setError(true);

      const cachedData = sessionStorage.getItem('deadstocks');
      if (cachedData) setDeadstocks(JSON.parse(cachedData));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cachedData = sessionStorage.getItem('deadstocks');
    const timestamp = sessionStorage.getItem('deadstockTimestamp');
    const isRecent = timestamp && (Date.now() - parseInt(timestamp)) < 5 * 60 * 1000;

    if (cachedData && isRecent) {
      setDeadstocks(JSON.parse(cachedData));
      setLoading(false);
    } else {
      fetchReport();
    }
  }, [fetchReport]);

  const handleBackToInventory = useCallback(() => {
    router.push('/inventory');
  }, [router]);

  return (
    <div className="h-screen bg-[#0A0A0A] p-6 w-full flex flex-col">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button onClick={handleBackToInventory} variant="ghost" className="text-gray-400 hover:text-white hover:bg-[#1A1A1A]">
            ← Back to Inventory
          </Button>
          <h1 className="text-2xl font-semibold text-white">📊 Deadstock Analysis</h1>
        </div>
        <Button onClick={fetchReport} disabled={loading} className="bg-[#00E676] text-black hover:bg-[#00ff84] px-4 py-2 rounded-lg flex items-center gap-2 transition-all">
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh Report
        </Button>
      </div>

      {/* Report Card */}
      <Card className="bg-[#1A1A1A] border border-gray-700 rounded-lg flex-1 shadow-md overflow-hidden animate-fade-in">
        <CardContent className="p-6 h-full overflow-auto">
          {loading ? (
            <LoadingState />
          ) : error && deadstocks.length === 0 ? (
            <ErrorState onRetry={fetchReport} />
          ) : deadstocks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-700 text-white">
                <thead className="bg-[#252525] text-white text-lg">
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
                        <span
                          className={`px-3 py-1 rounded-lg text-sm font-medium ${
                            item.inventory > 100
                              ? "bg-red-600 text-white"
                              : item.inventory > 50
                              ? "bg-orange-500 text-white"
                              : "bg-green-600 text-white"
                          }`}
                        >
                          {item.inventory > 100 ? "Excess" : item.inventory > 50 ? "Moderate" : "Low "}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-gray-400 flex flex-col items-center justify-center h-full">
              <p>No deadstock items found</p>
              <Button onClick={fetchReport} className="mt-4 bg-[#252525] hover:bg-[#333]">
                Generate Report
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
