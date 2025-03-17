"use client";
import { useEffect, useState } from 'react';
import OrderTrends from '../OrderTrends';
import MostFrequentCustomers from '../MostFrequentCustomers';
import TopCustomersBySpending from '../TopCustomersBySpending';

interface OrderTrendsData {
  dates: string[];
  counts: number[];
}

interface FrequentCustomersData {
  names: string[];
  counts: number[];
}

interface TopSpendersData {
  names: string[];
  amounts: number[];
}

interface CustomerAnalyticsData {
  orderTrends: OrderTrendsData;
  frequentCustomers: FrequentCustomersData;
  topSpenders: TopSpendersData;
}

export default function CustomerDashboard() {
  const [orderData, setOrderData] = useState<CustomerAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customer-analytics`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        setOrderData(data);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching customer analytics:", error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full">
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
        <h1 className="text-2xl font-bold">Customer Analytics</h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-950 p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Order Trend (Last 30 Days)</h2>
          <OrderTrends data={orderData!.orderTrends} />
        </div>
    
        <div className="bg-gray-950 p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Top 10 Customers by Spending</h2>
          <TopCustomersBySpending data={orderData!.topSpenders} />
        </div>
    
        <div className="bg-gray-950 p-4 rounded-lg shadow-lg col-span-2">
          <h2 className="text-lg font-semibold mb-4">Most Frequent Customers</h2>
          <MostFrequentCustomers data={orderData!.frequentCustomers} />
        </div>
      </div>
    </div>
  );
}