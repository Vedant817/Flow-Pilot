// components/CustomerFeedback.js
"use client";
import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { Pie } from 'react-chartjs-2';

Chart.register(...registerables);

export default function CustomerFeedback({ data }) {
  // Count sentiment distribution
  const sentimentCounts = data.reduce((acc, item) => {
    acc[item.sentiment] = (acc[item.sentiment] || 0) + 1;
    return acc;
  }, {});
  
  const chartData = {
    labels: Object.keys(sentimentCounts).map(key => 
      key.charAt(0).toUpperCase() + key.slice(1)
    ),
    datasets: [
      {
        data: Object.values(sentimentCounts),
        backgroundColor: [
          'rgba(144, 238, 129, 0.8)',  // positive - green
          'rgba(251, 191, 36, 0.8)',  // neutral - yellow
          'rgba(239, 68, 68, 0.8)'    // negative - red
        ],
        borderColor: [
          'rgba(16, 185, 129, 1)',
          'rgba(251, 191, 36, 1)',
          'rgba(239, 68, 68, 1)'
        ],
        borderWidth: 1,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'right',
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
          label: function(context) {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
            const percentage = Math.round((value / total) * 100);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  };

  return (
    <div className="flex justify-center">
      <div className="w-3/4">
        <Pie data={chartData} options={options} />
      </div>
    </div>
  );
}
