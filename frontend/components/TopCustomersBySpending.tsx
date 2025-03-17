// components/TopCustomersBySpending.js
"use client";
import { Chart, registerables } from 'chart.js';
import { Bar } from 'react-chartjs-2';

Chart.register(...registerables);

interface TopCustomersBySpendingProps {
  data: {
    names: string[];
    amounts: number[];
  };
}

export default function TopCustomersBySpending({ data }: TopCustomersBySpendingProps) {
  const chartData = {
    labels: data.names,
    datasets: [
      {
        label: 'Total Spent',
        data: data.amounts,
        backgroundColor: 'rgba(37, 99, 235, 1)',
        borderColor: 'rgba(37, 99, 235, 1)',
        borderWidth: 1,
      }
    ]
  };

  interface ChartOptions {
    indexAxis: 'x' | 'y' | undefined;
    responsive: boolean;
    maintainAspectRatio: boolean;
    scales: {
      y: {
        beginAtZero: boolean;
        grid: {
          color: string;
        };
        ticks: {
          color: string;
          callback: (value: number) => string;
        };
      };
      x: {
        grid: {
          color: string;
        };
        ticks: {
          color: string;
        };
      };
    };
    plugins: {
      legend: {
        labels: {
          color: string;
        };
      };
      tooltip: {
        callbacks: {
          label: (context: { raw: number }) => string;
        };
      };
    };
  }

  const options: ChartOptions = {
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
          label: function(tooltipItem) {
            return `Total Spent: $${(tooltipItem.raw as number).toLocaleString()}`;
          }
        }
      }
    }
  };

  return (
    <div>
      <Bar data={chartData} options={options} />
    </div>
  );
}
