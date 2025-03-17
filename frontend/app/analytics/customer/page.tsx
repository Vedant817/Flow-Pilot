// app/page.js
"use client";
import { useEffect, useState } from 'react';
import OrderTrends from '../../../components/OrderTrends';
import MostFrequentCustomers from '../../../components/MostFrequentCustomers';
import TopCustomersBySpending from '../../../components/TopCustomersBySpending';

export default function CustomerDashboard() {
  interface OrderData {
    orderTrends: {
      dates: string[];
      counts: number[];
    };
    frequentCustomers: {
      names: string[];
      counts: number[];
    };
    topSpenders: {
      names: string[];
      amounts: number[];
    };
  }

  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In a real app, this would be an API call
    // For demo purposes, we're simulating data loading
    const fetchData = async () => {
      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // This would normally be fetched from an API
        const data = {
          // Sample data structure based on the JSON
          orderTrends: {
            dates: ['2024-02-01', '2024-02-02', '2024-02-03', '2024-02-04', '2024-02-05', 
                    '2024-02-06', '2024-02-07', '2024-02-08', '2024-02-09', '2024-02-10', 
                    '2024-02-11', '2024-02-12', '2024-02-13', '2024-02-15'],
            counts: [7, 5, 4, 4, 7, 3, 14, 13, 10, 9, 12, 7, 1, 1]
          },
          frequentCustomers: {
            names: ['Sofia Patel', 'Sarah Johnson', 'Alex Turner', 'Emma Davis', 'Lucas Singh', 
                   'Sophia Chen', 'Elena Rodriguez', 'Benjamin Foster', 'Oliver Wright', 'Maria Sanchez'],
            counts: [6, 5, 5, 5, 5, 5, 5, 5, 5, 4]
          },
          topSpenders: {
            names: ['Elena Rodriguez', 'Sofia Patel', 'Lucas Singh', 'Sophia Chen', 'Emma Davis', 
                   'Sarah Johnson', 'Benjamin Foster', 'Oliver Wright', 'Rachel Green', 'Maria Sanchez'],
            amounts: [32000, 24000, 23000, 22000, 21000, 20000, 19000, 16000, 16000, 14000]
          }
        };
        
        setOrderData(data);
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
      <div className="flex items-center justify-center min-h-screen w-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 bg-black min-h-screen text-white">
    <header className="mb-8">
      <h1 className="text-2xl font-bold">Customer Analytics</h1>
    </header>
  
    {orderData && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* First two divs take half the width each */}
        <div className="bg-gray-950 p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Order Trend (Last 30 Days)</h2>
          <OrderTrends data={orderData.orderTrends} />
        </div>
    
        <div className="bg-gray-950 p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Top 10 Customers by Spending</h2>
          <TopCustomersBySpending data={orderData.topSpenders} />
        </div>
    
        {/* Last div takes full width */}
        <div className="bg-gray-950 p-4 rounded-lg shadow-lg col-span-2">
          <h2 className="text-lg font-semibold mb-4">Most Frequent Customers</h2>
          <MostFrequentCustomers data={orderData.frequentCustomers} />
        </div>
      </div>
    )}
  </div>
  
  );
}
