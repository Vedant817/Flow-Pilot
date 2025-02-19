'use client'
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function InventoryForecasting() {
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:5000/inventory-report");
      const data = await response.json();
      setReport(data.inventory_report);
    } catch (error) {
      console.error("Error fetching report:", error);
    }
    setLoading(false);
  };

  return (
    <div className="h-screen bg-[#0A0A0A] p-6 w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-white">
          Inventory Forecasting Report
        </h1>
        <div className="flex gap-4">
          <Button 
            onClick={fetchReport} 
            disabled={loading}
            className="bg-[#00E676] text-black hover:bg-[#00ff84] px-4 py-2 rounded-lg flex items-center gap-2"
          >
            {loading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              "Refresh Report"
            )}
          </Button>
        </div>
      </div>

      <Card className="bg-[#1A1A1A] border-0 rounded-lg">
        <CardContent className="p-6">
          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : report ? (
            <div className="text-white">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                className="prose prose-invert max-w-none"
              >
                {report}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-gray-400">No data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
