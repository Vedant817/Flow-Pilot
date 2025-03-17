// components/TopCustomersBySpending.js
"use client";
import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { Bar } from 'react-chartjs-2';

Chart.register(...registerables);

export default function TopCustomersBySpending({ data }) {
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

  const options = {
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
            return `Total Spent: $${context.raw.toLocaleString()}`;
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
