// components/DashboardStats.tsx
export default function DashboardStats() {
    const stats = [
      { label: 'New Subscribers', value: '5,097', change: '+33.45%' },
      { label: 'Streams', value: '47,403', change: '-12.45%' },
      { label: 'Engagement Rate', value: '25.81', change: '+62.52%' },
      { label: 'Avg. watch time', value: '45,4 min', change: '+4.46%' }
    ]
  
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-gray-900 p-4 rounded-lg">
            <h3 className="text-gray-400 text-sm">{stat.label}</h3>
            <div className="flex items-center mt-2">
              <span className="text-2xl font-bold">{stat.value}</span>
              <span className={`ml-2 text-sm ${
                stat.change.startsWith('+') ? 'text-emerald-500' : 'text-red-500'
              }`}>
                {stat.change}
              </span>
            </div>
          </div>
        ))}
      </div>
    )
  }
  