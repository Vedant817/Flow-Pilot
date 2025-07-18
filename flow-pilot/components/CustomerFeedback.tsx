"use client";
import { Chart, registerables, ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { useEffect, useState } from 'react';

Chart.register(...registerables);

interface CustomerFeedbackItem {
  name: string;
  feedback: string;
  sentiment: string;
}

interface CustomerFeedbackProps {
  data?: CustomerFeedbackItem[];
}

export default function CustomerFeedback({ data }: CustomerFeedbackProps) {
  const [chartData, setChartData] = useState<ChartData<'pie'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeedbackData = async () => {
      try {
        setIsLoading(true);
        // If data is provided as props, use it; otherwise fetch from API
        let feedbackData = data;
        
        if (!feedbackData) {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/get-feedback`);
          
          if (!response.ok) {
            throw new Error('Failed to fetch feedback data');
          }
          
          const apiData = await response.json();
          
          // Transform API data to match our component's expected format
          feedbackData = apiData.feedbacks.map((item: { email?: string; review?: string; type: string }) => ({
            name: item.email || 'Anonymous',
            feedback: item.review || '',
            sentiment: item.type === 'good' ? 'positive' : 
                      item.type === 'bad' ? 'negative' : 'neutral'
          }));
        }
        
        // Count sentiments
        const sentimentCounts = (feedbackData ?? []).reduce((acc: Record<string, number>, item) => {
          const sentiment = item.sentiment.toLowerCase();
          acc[sentiment] = (acc[sentiment] || 0) + 1;
          return acc;
        }, {});
        
        // Prepare chart data
        setChartData({
          labels: Object.keys(sentimentCounts).map(key => 
            key.charAt(0).toUpperCase() + key.slice(1)
          ),
          datasets: [
            {
              data: Object.values(sentimentCounts),
              backgroundColor: [
                'rgba(144, 238, 129, 0.8)', // positive
                'rgba(251, 191, 36, 0.8)', // neutral
                'rgba(239, 68, 68, 0.8)'   // negative
              ],
              borderColor: [
                'rgba(16, 185, 129, 1)',
                'rgba(251, 191, 36, 1)',
                'rgba(239, 68, 68, 1)'
              ],
              borderWidth: 1,
            }
          ]
        });
        
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setIsLoading(false);
      }
    };

    fetchFeedbackData();
  }, [data]);

  const options: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.7)',
          padding: 20,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: TooltipItem<'pie'>) {
            const label = context.label || '';
            const value = context.raw as number || 0;
            const total = (context.dataset.data as number[]).reduce((acc: number, val: number) => acc + val, 0);
            const percentage = Math.round((value / total) * 100);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
    </div>;
  }

  if (error) {
    return <div className="text-red-500 text-center p-4">Error: {error}</div>;
  }

  if (!chartData || Object.keys(chartData.labels || {}).length === 0) {
    return <div className="text-gray-400 text-center p-4">No feedback data available</div>;
  }

  return (
    <div className="flex justify-center">
      <div className="w-3/4">
        <Pie data={chartData} options={options} />
      </div>
    </div>
  );
}
