'use client'
import { useState, useEffect } from 'react'
import { MessageSquare, Search, ThumbsUp, ThumbsDown, Meh, Filter } from "lucide-react"

interface Feedback {
  id: string;
  email: string;
  review: string;
  type: "good" | "bad" | "neutral";
  createdAt: string;
}

interface ApiResponse {
  feedbacks: Feedback[];
}

export default function FeedbackPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [sentimentFilter, setSentimentFilter] = useState<string>('all')
  const [feedbackData, setFeedbackData] = useState<Feedback[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/get-feedback`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch feedback data')
        }
        
        const data: ApiResponse = await response.json()
        setFeedbackData(data.feedbacks)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchFeedback()
  }, [])
  
  const mapSentimentType = (type: string): "positive" | "negative" | "neutral" => {
    if (type === "good") return "positive"
    if (type === "bad") return "negative"
    return "neutral"
  }
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }
  
  const filteredFeedback = feedbackData.filter(item => {
    const textMatch = 
      item.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (item.review && item.review.toLowerCase().includes(searchQuery.toLowerCase())) ||
      mapSentimentType(item.type).toLowerCase().includes(searchQuery.toLowerCase());
    
    const sentimentMatch = 
      sentimentFilter === 'all' || 
      (sentimentFilter === 'positive' && item.type === 'good') ||
      (sentimentFilter === 'neutral' && item.type === 'neutral') ||
      (sentimentFilter === 'negative' && item.type === 'bad');
    
    return textMatch && sentimentMatch;
  });
  
  const positiveFeedback = feedbackData.filter(item => item.type === "good").length
  const neutralFeedback = feedbackData.filter(item => item.type === "neutral").length
  const negativeFeedback = feedbackData.filter(item => item.type === "bad").length

  const handleSentimentFilterChange = (value: string) => {
    setSentimentFilter(value);
  };

  if (isLoading) {
    return (
      <div className="p-8 w-full flex justify-center items-center min-h-[400px]">
        <div className="text-white">Loading feedback data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 w-full flex justify-center items-center min-h-[400px]">
        <div className="text-red-500">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="p-8 w-full">
      <h1 className="text-white text-3xl font-bold mb-6">Customer Feedback</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div 
          className={`bg-gray-900 p-6 rounded-lg cursor-pointer ${sentimentFilter === 'positive' ? 'ring-2 ring-[#00E676]' : ''}`}
          onClick={() => handleSentimentFilterChange(sentimentFilter === 'positive' ? 'all' : 'positive')}
        >
          <h2 className="text-white text-xl mb-2">Positive Reviews</h2>
          <div className="flex items-center">
            <ThumbsUp className="text-[#00E676] mr-3" size={24} />
            <p className="text-[#00E676] text-4xl font-bold">{positiveFeedback}</p>
          </div>
        </div>
        <div 
          className={`bg-gray-900 p-6 rounded-lg cursor-pointer ${sentimentFilter === 'neutral' ? 'ring-2 ring-yellow-500' : ''}`}
          onClick={() => handleSentimentFilterChange(sentimentFilter === 'neutral' ? 'all' : 'neutral')}
        >
          <h2 className="text-white text-xl mb-2">Neutral Reviews</h2>
          <div className="flex items-center">
            <Meh className="text-yellow-500 mr-3" size={24} />
            <p className="text-yellow-500 text-4xl font-bold">{neutralFeedback}</p>
          </div>
        </div>
        <div 
          className={`bg-gray-900 p-6 rounded-lg cursor-pointer ${sentimentFilter === 'negative' ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => handleSentimentFilterChange(sentimentFilter === 'negative' ? 'all' : 'negative')}
        >
          <h2 className="text-white text-xl mb-2">Negative Reviews</h2>
          <div className="flex items-center">
            <ThumbsDown className="text-red-500 mr-3" size={24} />
            <p className="text-red-500 text-4xl font-bold">{negativeFeedback}</p>
          </div>
        </div>
      </div>
      
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="text-gray-400" size={20} />
          </div>
          <input 
            type="text" 
            className="w-full bg-black border border-gray-800 rounded-md py-3 pl-10 pr-4 text-white"
            placeholder="Search by email, review content, or sentiment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center">
          <div className="flex items-center bg-black border border-gray-800 rounded-md px-4 py-2">
            <Filter className="text-gray-400 mr-2" size={18} />
            <select 
              className="bg-black text-white border-none outline-none"
              value={sentimentFilter}
              onChange={(e) => setSentimentFilter(e.target.value)}
            >
              <option value="all">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-800">
            <thead className="bg-black">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-sm font-medium text-gray-400">Email</th>
                <th scope="col" className="px-6 py-4 text-left text-sm font-medium text-gray-400">Review</th>
                <th scope="col" className="px-6 py-4 text-left text-sm font-medium text-gray-400">Date</th>
                <th scope="col" className="px-6 py-4 text-left text-sm font-medium text-gray-400">Sentiment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredFeedback.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{item.email}</td>
                  <td className="px-6 py-4 text-sm text-white">{item.review}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{formatDate(item.createdAt)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {mapSentimentType(item.type) === "positive" && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900 text-green-300">
                        <ThumbsUp size={16} className="mr-1" /> Positive
                      </span>
                    )}
                    {mapSentimentType(item.type) === "neutral" && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-900 text-yellow-300">
                        <Meh size={16} className="mr-1" /> Neutral
                      </span>
                    )}
                    {mapSentimentType(item.type) === "negative" && (
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
