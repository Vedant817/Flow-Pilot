import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function InventoryForecasting() {
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
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-center mb-4">
        Inventory Forecasting Report
      </h1>
      <Button onClick={fetchReport} className="mb-4" disabled={loading}>
        {loading ? <Loader className="animate-spin" /> : "Refresh Report"}
      </Button>
      <Card>
        <CardContent className="p-4 whitespace-pre-line overflow-auto bg-gray-100 rounded-lg">
          {loading ? (
            "Loading..."
          ) : report ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
          ) : (
            "No data available"
          )}
        </CardContent>
      </Card>
    </div>
  );
}
