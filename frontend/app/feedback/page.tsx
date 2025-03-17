'use client'
import { useState } from 'react'
import { MessageSquare, Search, ThumbsUp, ThumbsDown, Meh } from "lucide-react"

export default function FeedbackPage() {
  const [searchQuery, setSearchQuery] = useState('')
  
  // Sample feedback data
  const feedbackData = [
    { id: 1, customer: "Alex Johnson", review: "The Premium Laptop exceeded my expectations. Fast shipping and excellent build quality.", sentiment: "positive" },
    { id: 2, customer: "Sarah Williams", review: "Wireless Earbuds have connectivity issues. Battery life is not as advertised.", sentiment: "negative" },
    { id: 3, customer: "Michael Chen", review: "Smart Watch is okay, but the app is a bit clunky. Does the job though.", sentiment: "neutral" },
    { id: 4, customer: "Priya Sharma", review: "Bluetooth Speaker has amazing sound quality for its size. Very impressed!", sentiment: "positive" },
    { id: 5, customer: "David Rodriguez", review: "Gaming Mouse is responsive and comfortable. Perfect for long gaming sessions.", sentiment: "positive" },
    { id: 6, customer: "Emma Taylor", review: "The laptop arrived with a scratch on the screen. Customer service was slow to respond.", sentiment: "negative" },
    { id: 7, customer: "James Wilson", review: "Decent product for the price point. Nothing special but works as expected.", sentiment: "neutral" },
  ]
  
  // Filter feedback based on search query
  const filteredFeedback = feedbackData.filter(item => 
    item.customer.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.review.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  // Count sentiments
  const positiveFeedback = feedbackData.filter(item => item.sentiment === "positive").length
  const neutralFeedback = feedbackData.filter(item => item.sentiment === "neutral").length
  const negativeFeedback = feedbackData.filter(item => item.sentiment === "negative").length

  return (
    <div className="p-8 w-full">
      <h1 className="text-white text-3xl font-bold mb-6">Customer Feedback</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-lg">
          <h2 className="text-white text-xl mb-2">Positive Reviews</h2>
          <div className="flex items-center">
            <ThumbsUp className="text-[#00E676] mr-3" size={24} />
            <p className="text-[#00E676] text-4xl font-bold">{positiveFeedback}</p>
          </div>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg">
          <h2 className="text-white text-xl mb-2">Neutral Reviews</h2>
          <div className="flex items-center">
            <Meh className="text-yellow-500 mr-3" size={24} />
            <p className="text-yellow-500 text-4xl font-bold">{neutralFeedback}</p>
          </div>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg">
          <h2 className="text-white text-xl mb-2">Negative Reviews</h2>
          <div className="flex items-center">
            <ThumbsDown className="text-red-500 mr-3" size={24} />
            <p className="text-red-500 text-4xl font-bold">{negativeFeedback}</p>
          </div>
        </div>
      </div>
      
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="text-gray-400" size={20} />
        </div>
        <input 
          type="text" 
          className="w-full bg-black border border-gray-800 rounded-md py-3 pl-10 pr-4 text-white"
          placeholder="Search by customer name or review content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-800">
            <thead className="bg-black">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-sm font-medium text-gray-400">Customer Name</th>
                <th scope="col" className="px-6 py-4 text-left text-sm font-medium text-gray-400">Review</th>
                <th scope="col" className="px-6 py-4 text-left text-sm font-medium text-gray-400">Sentiment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredFeedback.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{item.customer}</td>
                  <td className="px-6 py-4 text-sm text-white">{item.review}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.sentiment === "positive" && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900 text-green-300">
                        <ThumbsUp size={16} className="mr-1" /> Positive
                      </span>
                    )}
                    {item.sentiment === "neutral" && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-900 text-yellow-300">
                        <Meh size={16} className="mr-1" /> Neutral
                      </span>
                    )}
                    {item.sentiment === "negative" && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-900 text-red-300">
                        <ThumbsDown size={16} className="mr-1" /> Negative
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredFeedback.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-500" />
            <h3 className="mt-2 text-sm font-semibold text-white">No reviews found</h3>
            <p className="mt-1 text-sm text-gray-500">No reviews match your search criteria.</p>
          </div>
        )}
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        Showing {filteredFeedback.length} of {feedbackData.length} reviews
      </div>
    </div>
  )
}
