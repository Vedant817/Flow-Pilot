"use client";
import { Chart, registerables } from "chart.js";
import { Line } from "react-chartjs-2";

Chart.register(...registerables);

interface RevenueData {
  date: string;
  revenue: number;
}

export default function RevenuePerDay({ data = [] }: { data: RevenueData[] }) {


  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Ensure data is available
  if (!Array.isArray(data) || data.length === 0) {
    return <p className="text-gray-400">No revenue data available.</p>;
  }

  const chartData = {
    labels: data.map((item) => formatDate(item.date)),
    datasets: [
      {
        label: "Revenue ($)",
        data: data.map((item) => item.revenue),
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.5)",
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "#10b981",
        fill: true,
      },
    ],
  };

  interface ChartOptions {
    responsive: boolean;
    maintainAspectRatio: boolean;
    scales: {
      y: {
        beginAtZero: boolean;
        grid: { color: string };
        ticks: {
          color: string;
          callback: (value: number) => string;
        };
      };
      x: {
        grid: { color: string };
        ticks: { color: string };
      };
    };
    plugins: {
      legend: {
        labels: { color: string };
      };
      tooltip: {
        callbacks: {
          label: (tooltipItem: { raw: unknown }) => string;
        };
      };
    };
  }

  const options: ChartOptions = {
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
          label: function (tooltipItem: { raw: unknown }) {
            return `Revenue: $${(tooltipItem.raw as number)?.toLocaleString()}`;
          },
        },
      },
    },
  };

  return (
    <div className="w-full h-64">
      <Line data={chartData} options={options} />
    </div>
  );
}
