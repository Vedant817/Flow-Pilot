// components/BestWorstProducts.js
"use client";
import { Chart, registerables } from 'chart.js';
import { Bar } from 'react-chartjs-2';

Chart.register(...registerables);

interface Product {
  name: string;
  quantity: number;
}

interface BestWorstProductsProps {
  data: {
    bestSelling: Product[];
    worstSelling: Product[];
  };
}

export default function BestWorstProducts({ data }: BestWorstProductsProps) {
  const bestSellingData = {
    labels: data.bestSelling.map(item => item.name),
    datasets: [
      {
        label: 'Units Sold',
        data: data.bestSelling.map(item => item.quantity),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 1,
      }
    ]
  };

  const worstSellingData = {
    labels: data.worstSelling.map(item => item.name),
    datasets: [
      {
        label: 'Units Sold',
        data: data.worstSelling.map(item => item.quantity),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
      }
    ]
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      x: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)'
        }
      },
      y: {
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
        display: false
      },
      title: {
        display: true,
        text: 'Best Selling Products',
        color: 'rgba(255, 255, 255, 0.9)',
        font: {
          size: 14
        },
        padding: {
          bottom: 10
        }
      }
    }
  };

  const worstOptions = {
    ...options,
    plugins: {
      ...options.plugins,
      title: {
        ...options.plugins.title,
        text: 'Worst Selling Products',
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Bar data={bestSellingData} options={options} />
      </div>
      <div>
        <Bar data={worstSellingData} options={worstOptions} />
      </div>
    </div>
  );
}
