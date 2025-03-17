"use client";
import { Chart, registerables } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { FrequentCustomerData } from '@/lib/types/analytics';

Chart.register(...registerables);

interface MostFrequentCustomersProps {
  data: FrequentCustomerData;
}

export default function MostFrequentCustomers({ data }: MostFrequentCustomersProps) {
  const chartData = {
    labels: data.names,
    datasets: [
      {
        label: 'Number of Orders',
        data: data.counts,
        backgroundColor: 'rgba(21, 128, 61, 1)',
        borderColor: 'rgba(21, 128, 61, 1)',
        borderWidth: 1,
      }
    ]
  };

  const options = {
    indexAxis: 'x' as const,
    responsive: true,
    maintainAspectRatio: false,
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
    <div style={{ position: 'relative', height: '300px', width: '100%' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}