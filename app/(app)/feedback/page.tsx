/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useState, useEffect } from 'react'
import { MessageSquare, Search, ThumbsUp, ThumbsDown, Meh, Filter, Star, TrendingUp, Calendar, User, Mail, Clock, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Feedback {
  id: string;
  email: string;
  review: string;
  type: "good" | "bad" | "neutral";
  createdAt: string;
}

export default function FeedbackPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [sentimentFilter, setSentimentFilter] = useState<string>('all')
  const [feedbackData, setFeedbackData] = useState<Feedback[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  
  const fetchFeedback = async (isRefresh = false) => {
    try {
      setIsLoading(!isRefresh)
      setRefreshing(isRefresh)
      setError(null)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/feedback`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch feedback data: ${response.status}`)
      }
      
      const data = await response.json()
      
      let feedbackArray: Feedback[] = []
      
      if (Array.isArray(data)) {
        feedbackArray = data.map((item: any) => ({
          id: item.id || item._id?.toString() || `feedback-${Date.now()}-${Math.random()}`,
          email: item.email || 'Unknown email',
          review: item.review || 'No review provided',
          type: (item.type as "good" | "bad" | "neutral") || 'neutral',
          createdAt: item.createdAt || new Date().toISOString(),
        }))
      } else if (data && Array.isArray(data.feedbacks)) {
        feedbackArray = data.feedbacks.map((item: any) => ({
          id: item.id || item._id?.toString() || `feedback-${Date.now()}-${Math.random()}`,
          email: item.email || 'Unknown email',
          review: item.review || 'No review provided',
          type: (item.type as "good" | "bad" | "neutral") || 'neutral',
          createdAt: item.createdAt || new Date().toISOString(),
        }))
      } else if (data && Array.isArray(data.data)) {
        feedbackArray = data.data.map((item: any) => ({
          id: item.id || item._id?.toString() || `feedback-${Date.now()}-${Math.random()}`,
          email: item.email || 'Unknown email',
          review: item.review || 'No review provided',
          type: (item.type as "good" | "bad" | "neutral") || 'neutral',
          createdAt: item.createdAt || new Date().toISOString(),
        }))
      } else {
        throw new Error('Unexpected data format received from API')
      }
      
      setFeedbackData(feedbackArray)
    } catch (err) {
      console.error('Error fetching feedback:', err)
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }
  
  useEffect(() => {
    fetchFeedback()
  }, [])
  
  const mapSentimentType = (type: string): "positive" | "negative" | "neutral" => {
    if (type === "good") return "positive"
    if (type === "bad") return "negative"
    return "neutral"
  }
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return 'Invalid Date'
    }
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <div className="flex justify-center items-center min-h-[400px]">
          <Card className="p-8 bg-white/80 backdrop-blur-md border border-slate-200/50 shadow-xl">
            <div className="flex items-center gap-4">
              <RefreshCw className="animate-spin h-8 w-8 text-blue-600" />
              <div className="text-slate-900 text-xl font-medium">Loading customer feedback...</div>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Card className="p-8 bg-white/80 backdrop-blur-md border border-red-200 shadow-xl max-w-md w-full">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-red-600 text-xl flex items-center justify-center gap-2">
                <MessageSquare className="w-6 h-6" />
                Unable to Load Feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-slate-600">{error}</p>
              <button 
                onClick={() => fetchFeedback()} 
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            </CardContent>
          </Card>
          
          {/* Debug Information */}
          <Card className="mt-4 p-4 bg-yellow-50 border border-yellow-200 max-w-2xl w-full">
            <CardContent className="p-4">
              <div className="text-sm text-yellow-800">
                <div className="font-semibold mb-2">Debug Information:</div>
                <div className="space-y-1">
                  <div>API URL: {process.env.NEXT_PUBLIC_API_URL}/feedback</div>
                  <div>Error: {error}</div>
                  <div>Check browser console for more details</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-slate-900 text-3xl font-bold">Customer Feedback</h1>
                <p className="text-slate-600 text-lg">Monitor and analyze customer satisfaction</p>
              </div>
            </div>
            <button
              onClick={() => fetchFeedback(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card 
            className={`bg-white/80 backdrop-blur-md border border-slate-200/50 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer group ${sentimentFilter === 'positive' ? 'ring-2 ring-green-500 ring-offset-2' : ''}`}
            onClick={() => handleSentimentFilterChange(sentimentFilter === 'positive' ? 'all' : 'positive')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Positive Reviews</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{positiveFeedback}</p>
                  <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Customer Satisfaction
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <ThumbsUp className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`bg-white/80 backdrop-blur-md border border-slate-200/50 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer group ${sentimentFilter === 'neutral' ? 'ring-2 ring-yellow-500 ring-offset-2' : ''}`}
            onClick={() => handleSentimentFilterChange(sentimentFilter === 'neutral' ? 'all' : 'neutral')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Neutral Reviews</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{neutralFeedback}</p>
                  <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    Moderate Feedback
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <Meh className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`bg-white/80 backdrop-blur-md border border-slate-200/50 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer group ${sentimentFilter === 'negative' ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}
            onClick={() => handleSentimentFilterChange(sentimentFilter === 'negative' ? 'all' : 'negative')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Negative Reviews</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{negativeFeedback}</p>
                  <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    Needs Attention
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <ThumbsDown className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Search and Filter Section */}
        <Card className="bg-white/80 backdrop-blur-md border border-slate-200/50 shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="text-slate-400" size={20} />
                </div>
                <input 
                  type="text" 
                  className="w-full bg-white border border-slate-200 rounded-lg py-3 pl-10 pr-4 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                  placeholder="Search by email, review content, or sentiment..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className="flex items-center">
                <div className="flex items-center bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
                  <Filter className="text-slate-400 mr-2" size={18} />
                  <select 
                    className="bg-transparent text-slate-900 border-none outline-none focus:ring-0 font-medium"
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
          </CardContent>
        </Card>
        
        {/* Feedback Grid */}
        {filteredFeedback.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-md border border-slate-200/50 shadow-lg">
            <CardContent className="text-center py-16">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  {feedbackData.length === 0 ? 'No feedback data found' : 'No reviews found'}
                </h3>
                <p className="text-slate-600 max-w-md">
                  {feedbackData.length === 0 
                    ? 'Check the debug panel above and browser console for more information.' 
                    : 'No reviews match your current search criteria. Try adjusting your filters or search terms.'
                  }
                </p>
                {(searchQuery || sentimentFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setSentimentFilter('all')
                    }}
                    className="mt-4 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredFeedback.map((item, index) => (
              <Card 
                key={item.id || index} 
                className="bg-white/80 backdrop-blur-md border border-slate-200/50 shadow-lg hover:shadow-xl transition-all duration-200 group"
              >
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Customer Info */}
                    <div className="flex items-start gap-3 lg:w-1/4">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-medium text-sm shadow-lg flex-shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <p className="text-sm font-medium text-slate-900 truncate" title={item.email}>
                            {item.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Review Content */}
                    <div className="lg:w-1/2 lg:px-4">
                      <p className="text-slate-700 leading-relaxed" title={item.review}>
                        {item.review.length > 200 ? `${item.review.substring(0, 200)}...` : item.review}
                      </p>
                    </div>

                    {/* Sentiment */}
                    <div className="lg:w-1/4 flex justify-start lg:justify-end">
                      {mapSentimentType(item.type) === "positive" && (
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200 shadow-sm">
                          <ThumbsUp size={16} />
                          Positive
                        </div>
                      )}
                      {mapSentimentType(item.type) === "neutral" && (
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border border-amber-200 shadow-sm">
                          <Meh size={16} />
                          Neutral
                        </div>
                      )}
                      {mapSentimentType(item.type) === "negative" && (
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border border-red-200 shadow-sm">
                          <ThumbsDown size={16} />
                          Negative
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {/* Footer Info */}
        <Card className="bg-white/60 backdrop-blur-md border border-slate-200/50 shadow-sm mt-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Showing {filteredFeedback.length} of {feedbackData.length} reviews</span>
              </div>
              <div className="flex items-center gap-4">
                <span>Last updated: {new Date().toLocaleTimeString()}</span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Live monitoring</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
