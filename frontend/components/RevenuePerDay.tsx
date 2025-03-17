"use client";
import { Chart, registerables, ChartData, ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';

Chart.register(...registerables);

interface RevenueItem {
  date: string;
  revenue: number;
}

interface RevenuePerDayProps {
  data: RevenueItem[];
}

export default function RevenuePerDay({ data }: RevenuePerDayProps) {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const allZeros = data.every(item => item.revenue === 0);
  
  const displayData: RevenueItem[] = allZeros ? 
    data.map((item, index) => ({
      date: item.date,
      revenue: 5000 + Math.sin(index) * 3000 + (index * 1000)
    })) : data;

  const chartData: ChartData<'line'> = {
    labels: displayData.map(item => formatDate(item.date)),
    datasets: [
      {
        label: 'Revenue ($)',
        data: displayData.map(item => item.revenue),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        tension: 0.1,
        pointRadius: 4,
        pointBackgroundColor: "#10b981",
        fill: true,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false, // Set false for better height control
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "rgba(255, 255, 255, 0.1)" },
        ticks: {
          color: "rgba(255, 255, 255, 0.7)",
          callback: function (value) {
            return `$${value?.toLocaleString()}`;
          },
        },
      },
      x: {
        grid: { color: "rgba(255, 255, 255, 0.1)" },
        ticks: { color: "rgba(255, 255, 255, 0.7)" },
      },
    },
    plugins: {
      legend: {
        labels: { color: "rgba(255, 255, 255, 0.7)" },
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            if (typeof context.raw === 'number') {
              return `Revenue: $${context.raw.toLocaleString()}`;
            }
            return '';
          }
        }
      }
    }
  };

  return (
    <div className="w-full h-64">
      <Line data={chartData} options={options} />
      {allZeros && (
        <div className="text-yellow-500 text-center mt-2 text-sm">
          Note: Sample data shown. No actual revenue data available.
        </div>
      )}
    </div>
  );
}