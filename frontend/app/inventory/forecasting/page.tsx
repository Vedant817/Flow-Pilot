'use client'
import { useEffect, useState, useCallback, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader, RefreshCw, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "next/navigation";

const ReportContent = memo(({ content }: { content: string }) => (
  <ReactMarkdown 
    remarkPlugins={[remarkGfm]}
    className="prose prose-invert max-w-none"
  >
    {content}
  </ReactMarkdown>
));
ReportContent.displayName = 'ReportContent';

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
    <Loader className="w-8 h-8 animate-spin mb-4" />
    <p>Generating inventory forecast...</p>
  </div>
);

const ErrorState = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
    <AlertTriangle className="w-8 h-8 text-amber-500 mb-4" />
    <p className="mb-4">Failed to load inventory forecast</p>
    <Button 
      onClick={onRetry}
      variant="outline" 
      className="border-gray-700 hover:bg-gray-800"
    >
      Try Again
    </Button>
  </div>
);

export default function InventoryForecasting() {
  const [report, setReport] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const router = useRouter();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(false);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch("http://127.0.0.1:5000/inventory-report", {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      setReport(data.inventory_report);
      setError(false);
      
      sessionStorage.setItem('inventoryReport', data.inventory_report);
      sessionStorage.setItem('reportTimestamp', Date.now().toString());
      
    } catch (error) {
      console.error("Error fetching report:", error);
      setError(true);
      
      const cachedReport = sessionStorage.getItem('inventoryReport');
      if (cachedReport) {
        setReport(cachedReport);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cachedReport = sessionStorage.getItem('inventoryReport');
    const timestamp = sessionStorage.getItem('reportTimestamp');
    const isRecent = timestamp && (Date.now() - parseInt(timestamp)) < 5 * 60 * 1000;
    
    if (cachedReport && isRecent) {
      setReport(cachedReport);
      setLoading(false);
    } else {
      fetchReport();
    }
    
    return () => {};
  }, [fetchReport]);

  const handleBackToInventory = useCallback(() => {
    router.push('/inventory');
  }, [router]);

  return (
    <div className="h-screen bg-[#0A0A0A] p-6 w-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button 
            onClick={handleBackToInventory}
            variant="ghost" 
            className="text-gray-400 hover:text-white hover:bg-[#1A1A1A]"
          >
            ← Back to Inventory
          </Button>
          <h1 className="text-2xl font-semibold text-white">
            Inventory Forecasting Report
          </h1>
        </div>
        <div className="flex gap-4">
          <Button 
            onClick={fetchReport} 
            disabled={loading}
            className="bg-[#00E676] text-black hover:bg-[#00ff84] px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            {loading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh Report
          </Button>
        </div>
      </div>

      <Card className="bg-[#1A1A1A] border-0 rounded-lg flex-1 overflow-hidden">
        <CardContent className="p-6 h-full overflow-auto">
          {loading ? (
            <LoadingState />
          ) : error && !report ? (
            <ErrorState onRetry={fetchReport} />
          ) : report ? (
            <div className="text-white">
              <ReportContent content={report} />
            </div>
          ) : (
            <div className="text-gray-400 flex flex-col items-center justify-center h-full">
              <p>No forecast data available</p>
              <Button 
                onClick={fetchReport}
                className="mt-4 bg-[#252525] hover:bg-[#333]"
              >
                Generate Report
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
