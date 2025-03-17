// app/page.js
"use client";
import { useEffect, useState } from 'react';

interface ProductSales {
  bestSelling: { name: string; quantity: number }[];
  worstSelling: { name: string; quantity: number }[];
}
interface RevenuePerDay {
  date: string;
  revenue: number;
}

interface CustomerFeedback {
  name: string;
  feedback: string;
  sentiment: string;
}

import BestWorstProducts from '../../../components/BestWorstProducts';
import RevenuePerDay from '../../../components/RevenuePerDay';
import CustomerFeedback from '../../../components/CustomerFeedback';

export default function ProductDashboard() {
  const [data, setData] = useState<{
    productSales: ProductSales;
    revenuePerDay: RevenuePerDay[];
    customerFeedback: CustomerFeedback[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In a real app, this would be an API call
    const fetchData = async () => {
      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // This would normally be fetched from an API
        const sampleData = {
          productSales: {
            bestSelling: [
              { name: 'Philips Hue Smart Bulb', quantity: 19 },
              { name: 'iPhone 15 Pro', quantity: 15 },
              { name: 'Google Pixel 8 Pro', quantity: 14 },
              { name: 'AirPods Max', quantity: 13 },
              { name: 'Samsung Galaxy S23 Ultra', quantity: 12 }
            ],
            worstSelling: [
              { name: 'TP-Link Archer AX11000', quantity: 1 },
              { name: 'NVIDIA Shield TV Pro', quantity: 2 },
              { name: 'Anker USB-C Cable', quantity: 3 },
              { name: 'Garmin Fenix 7', quantity: 3 },
              { name: 'Belkin USB-C Cable', quantity: 3 }
            ]
          },
          revenuePerDay: [
            { date: '2024-02-01', revenue: 5744 },
            { date: '2024-02-02', revenue: 3125 },
            { date: '2024-02-03', revenue: 1998 },
            { date: '2024-02-04', revenue: 1098 },
            { date: '2024-02-05', revenue: 1594 },
            { date: '2024-02-06', revenue: 3567 },
            { date: '2024-02-07', revenue: 24169 },
            { date: '2024-02-08', revenue: 13859 },
            { date: '2024-02-09', revenue: 10236 },
            { date: '2024-02-10', revenue: 11205 },
            { date: '2024-02-11', revenue: 9722 },
            { date: '2024-02-12', revenue: 18229 }
          ],
          customerFeedback: [
            { name: 'Alice Johnson', feedback: 'Customer support was very helpful.', sentiment: 'positive' },
            { name: 'Charlie Davis', feedback: 'Amazing experience! Will shop again.', sentiment: 'positive' },
            { name: 'Bob Brown', feedback: 'Delivery was delayed, but the product was worth it.', sentiment: 'neutral' },
            { name: 'John Doe', feedback: 'Great service and fast delivery!', sentiment: 'positive' },
            { name: 'Jane Smith', feedback: 'Product quality was excellent.', sentiment: 'positive' }
          ]
        };
        
        setData(sampleData);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
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

  return (
    <div className="container mx-auto p-4 bg-black min-h-screen text-white">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Product Analytics</h1>
      </header>
      
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-950 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Best and Worst Selling Products</h2>
            <BestWorstProducts data={data.productSales} />
          </div>
          
          <div className="bg-gray-950 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Customer Feedback Sentiment</h2>
            <CustomerFeedback data={data.customerFeedback} />
          </div>
          
          <div className="bg-gray-950 p-4 rounded-lg shadow-lg lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Revenue Per Day (February 2024)</h2>
            <RevenuePerDay data={data.revenuePerDay} />
          </div>
        </div>
      )}
    </div>
  );
}
