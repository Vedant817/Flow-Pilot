// components/MostFrequentCustomers.js
"use client";
import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { Bar } from 'react-chartjs-2';

Chart.register(...registerables);

export default function MostFrequentCustomers({ data }) {
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
      <Bar data={chartData} options={options} />
    </div>
  );
}
