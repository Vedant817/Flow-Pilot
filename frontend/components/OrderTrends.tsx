// components/OrderTrends.js
"use client";
import { Chart, registerables } from 'chart.js';
import { Line } from 'react-chartjs-2';

Chart.register(...registerables);

interface OrderTrendsProps {
  data: {
    dates: string[];
    counts: number[];
  };
}

export default function OrderTrends({ data }: OrderTrendsProps) {
  
  interface FormatDate {
    (dateString: string): string;
  }

  const formatDate: FormatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const chartData = {
    labels: data.dates.map(date => formatDate(date)),
    datasets: [
      {
        label: 'Orders',
        data: data.counts,
        fill: false,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        pointRadius: 4,
        pointBackgroundColor: 'rgb(75, 192, 192)',
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)'
        }
      },
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)'
        }
      }
    },
    plugins: {
      legend: {
        labels: {
          color: 'rgba(255, 255, 255, 0.7)'
        }
      }
    }
  };

  return (
    <div>
      <Line data={chartData} options={options} />
    </div>
  );
}
