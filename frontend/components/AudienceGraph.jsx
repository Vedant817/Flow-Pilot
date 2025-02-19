// components/AudienceGraph.tsx
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts'

const data = [
  { date: 'Dec 21', value: 275000 },
  { date: 'Dec 22', value: 280000 },
  { date: 'Dec 23', value: 282000 },
  { date: 'Dec 24', value: 285000 },
  { date: 'Dec 25', value: 290000 },
  { date: 'Dec 26', value: 295000 },
  { date: 'Dec 27', value: 301097 },
]

export default function AudienceGraph() {
  return (
    <div className="bg-gray-800/50 p-6 rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-gray-400">Audience</h3>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">301,097</span>
            <span className="text-emerald-500 text-sm">+58.31% for 7 last days</span>
          </div>
        </div>
      </div>
      
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis 
              dataKey="date" 
              stroke="#4B5563"
              tick={{ fill: '#9CA3AF' }}
            />
            <YAxis 
              stroke="#4B5563"
              tick={{ fill: '#9CA3AF' }}
              tickFormatter={(value) => `${value/1000}k`}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#10B981" 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
