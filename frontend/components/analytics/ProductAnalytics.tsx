"use client";
import { useEffect, useState } from 'react';
import BestWorstProducts from '../BestWorstProducts';
import RevenuePerDay from '../RevenuePerDay';
import CustomerFeedback from '../CustomerFeedback';
import { AnalyticsData } from '@/lib/types/analytics';

export interface CustomerFeedbackItem {
  name: string;
  feedback: string;
  sentiment: string;
  date: string;
}

export default function ProductDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transformedFeedback, setTransformedFeedback] = useState<CustomerFeedbackItem[] | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/product-analytics`);

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const apiData = await response.json() as AnalyticsData;
        setData(apiData);

        if (apiData.customerFeedback) {
          const sampleItem = apiData.customerFeedback[0];
          console.log("Sample feedback item structure:", sampleItem);

          const transformed = apiData.customerFeedback.map(item => ({
            name: 'customer' in item ? item.customer :
              'customerName' in item ? item.customerName :
                'user' in item ? item.user : 'Anonymous',

            feedback: 'comment' in item ? item.comment :
              'feedback' in item ? item.feedback :
                'text' in item ? item.text : '',

            sentiment: String(
              'sentiment' in item ? item.sentiment :
                'sentimentScore' in item ? item.sentimentScore :
                  'rating' in item ? item.rating : 0
            ), // ✅ Convert to string to match expected type

            date: 'date' in item ? item.date :
              'timestamp' in item ? item.timestamp :
                'createdAt' in item ? item.createdAt : new Date().toISOString()
          })) as CustomerFeedbackItem[];
          setTransformedFeedback(transformed);
        }
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching product analytics:", error);
        setError(error instanceof Error ? error.message : 'An error occurred');
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black w-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black w-full text-red-500">
        <div className="bg-gray-950 p-6 rounded-lg">
          <h2 className="text-xl mb-2">Error Loading Data</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="container mx-auto p-4 bg-black min-h-screen text-white">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Product Analytics</h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-950 p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Best and Worst Selling Products</h2>
          {data.productSales && <BestWorstProducts data={data.productSales} />}
        </div>

        <div className="bg-gray-950 p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Customer Feedback Sentiment</h2>
          {transformedFeedback && <CustomerFeedback data={transformedFeedback} />}
        </div>

        <div className="bg-gray-950 p-4 rounded-lg shadow-lg lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">Revenue Per Day (Last 30 Days)</h2>
          {data.revenuePerDay && <RevenuePerDay data={data.revenuePerDay} />}
        </div>
      </div>
    </div>
  );
}