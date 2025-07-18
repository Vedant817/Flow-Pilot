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

interface Feedback {
  id: string;
  email: string;
  review: string;
  type: "good" | "bad" | "neutral";
  createdAt: string;
}

export default function ProductDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [feedbackData, setFeedbackData] = useState<CustomerFeedbackItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch product analytics data
        const analyticsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/product-analytics`);
        if (!analyticsResponse.ok) {
          throw new Error(`HTTP error! Status: ${analyticsResponse.status}`);
        }
        const analyticsData = await analyticsResponse.json() as AnalyticsData;
        setData(analyticsData);
        
        // Fetch feedback data
        const feedbackResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/get-feedback`);
        if (!feedbackResponse.ok) {
          throw new Error(`HTTP error! Status: ${feedbackResponse.status}`);
        }
        const feedbackResult = await feedbackResponse.json();
        
        // Transform feedback data to match our component's expected format
        const transformedFeedback = feedbackResult.feedbacks.map((item: Feedback) => ({
          name: item.email || 'Anonymous',
          feedback: item.review || '',
          sentiment: item.type === 'good' ? 'positive' : 
                    item.type === 'bad' ? 'negative' : 'neutral',
          date: item.createdAt
        }));
        
        setFeedbackData(transformedFeedback);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError(error instanceof Error ? error.message : 'An error occurred');
        setIsLoading(false);
      }
    };
    
    fetchAllData();
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

  return (
    <div className="container mx-auto p-4 bg-black min-h-screen text-white">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Product Analytics</h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-950 p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Best and Worst Selling Products</h2>
          {data?.productSales && <BestWorstProducts data={data.productSales} />}
        </div>

        <div className="bg-gray-950 p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Customer Feedback Sentiment</h2>
          <CustomerFeedback data={feedbackData || []} />
        </div>

        <div className="bg-gray-950 p-4 rounded-lg shadow-lg lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">Revenue Per Day (Last 30 Days)</h2>
          {data?.revenuePerDay && <RevenuePerDay data={data.revenuePerDay} />}
        </div>
      </div>
    </div>
  );
}
