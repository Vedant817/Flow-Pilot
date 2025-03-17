"use client";
import { Chart, registerables, ChartData, ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';

Chart.register(...registerables);

interface TopCustomersData {
  names: string[];
  amounts: number[];
}

interface TopCustomersBySpendingProps {
  data: TopCustomersData;
}

export default function TopCustomersBySpending({ data }: TopCustomersBySpendingProps) {
  const allZeros = data.amounts.every(amount => amount === 0);
  
  const displayData: TopCustomersData = allZeros ? {
    names: data.names,
    amounts: data.names.map((_, i) => 25000 - (i * 3000))
  } : data;

  const chartData: ChartData<'bar'> = {
    labels: displayData.names,
    datasets: [
      {
        label: 'Total Spent',
        data: displayData.amounts,
        backgroundColor: 'rgba(37, 99, 235, 1)',
        borderColor: 'rgba(37, 99, 235, 1)',
        borderWidth: 1,
      }
    ]
  };

  const options: ChartOptions<'bar'> = {
    indexAxis: 'x',
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
          callback: function(value) {
            return '$' + value.toLocaleString();
          }
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
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            if (typeof context.raw === 'number') {
              return `Total Spent: $${context.raw.toLocaleString()}`;
            }
            return '';
          }
        }
      }
    }
  };

  return (
    <div>
      <Bar data={chartData} options={options} />
      {allZeros && (
        <div className="text-yellow-500 text-center mt-2 text-sm">
          Note: Sample data shown. No actual spending data available.
        </div>
      )}
    </div>
  );
}