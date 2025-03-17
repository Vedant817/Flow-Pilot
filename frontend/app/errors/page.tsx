'use client'
import { useState } from 'react'
import { AlertTriangle, AlertCircle, Filter, Search, ChevronDown, ChevronUp } from 'lucide-react'

// Mock data - replace with your actual data source
const MOCK_ERRORS = [
  { id: 1, message: "Payment processing failed", type: "System", severity: "high", timestamp: "2025-03-17T14:22:31" },
  { id: 2, message: "Invalid shipping address provided", type: "Customer", severity: "medium", timestamp: "2025-03-17T13:45:12" },
  { id: 3, message: "Database connection timeout", type: "System", severity: "critical", timestamp: "2025-03-17T12:30:05" },
  { id: 4, message: "Product out of stock after order placement", type: "System", severity: "medium", timestamp: "2025-03-17T11:15:43" },
  { id: 5, message: "Customer submitted incomplete form data", type: "Customer", severity: "low", timestamp: "2025-03-17T10:05:22" },
  { id: 6, message: "API rate limit exceeded", type: "System", severity: "high", timestamp: "2025-03-16T22:45:10" },
  { id: 7, message: "Duplicate order submission", type: "Customer", severity: "medium", timestamp: "2025-03-16T20:12:33" },
];

export default function ErrorsPage() {
  const [errors, setErrors] = useState(MOCK_ERRORS);
  const [filterType, setFilterType] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter errors
  const filteredErrors = errors.filter(error => {
    // Apply type filter
    if (filterType !== 'All' && error.type !== filterType) return false;
    
    // Apply search filter
    if (searchQuery && !error.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    return true;
  });

  // Count by type
  const systemErrors = filteredErrors.filter(e => e.type === 'System').length;
  const customerErrors = filteredErrors.filter(e => e.type === 'Customer').length;

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'low': return 'bg-blue-900 text-blue-300';
      case 'medium': return 'bg-yellow-900 text-yellow-300';
      case 'high': return 'bg-orange-900 text-orange-300';
      case 'critical': return 'bg-red-900 text-red-300';
      default: return 'bg-gray-800 text-gray-300';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="p-6 bg-black text-white min-h-screen w-full">
      <h1 className="text-3xl font-bold mb-6">System Errors</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl mb-2">Total Errors</h2>
          <div className="flex items-center">
            <AlertTriangle size={24} className="text-[#00E676] mr-2" />
            <span className="text-4xl font-bold">{filteredErrors.length}</span>
          </div>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl mb-2">System Errors</h2>
          <div className="flex items-center">
            <AlertCircle size={24} className="text-purple-500 mr-2" />
            <span className="text-4xl font-bold">{systemErrors}</span>
          </div>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl mb-2">Customer Errors</h2>
          <div className="flex items-center">
            <AlertTriangle size={24} className="text-amber-500 mr-2" />
            <span className="text-4xl font-bold">{customerErrors}</span>
          </div>
        </div>
      </div>
      
      {/* Search bar */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by error message..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 px-4 pl-12 text-white focus:outline-none focus:ring-2 focus:ring-[#00E676]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search size={20} className="absolute left-4 top-3.5 text-gray-400" />
        </div>
      </div>
      
      {/* Filter */}
      <div className="flex mb-6">
        <button 
          className={`px-4 py-2 rounded-lg mr-2 ${filterType === 'All' ? 'bg-[#00E676] text-black' : 'bg-gray-800 text-white'}`}
          onClick={() => setFilterType('All')}
        >
          All
        </button>
        <button 
          className={`px-4 py-2 rounded-lg mr-2 ${filterType === 'System' ? 'bg-[#00E676] text-black' : 'bg-gray-800 text-white'}`}
          onClick={() => setFilterType('System')}
        >
          System
        </button>
        <button 
          className={`px-4 py-2 rounded-lg ${filterType === 'Customer' ? 'bg-[#00E676] text-black' : 'bg-gray-800 text-white'}`}
          onClick={() => setFilterType('Customer')}
        >
          Customer
        </button>
      </div>
      
      {/* Table */}
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-800">
          <thead>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">S.No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Error Message</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Severity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredErrors.length > 0 ? (
              filteredErrors.map((error) => (
                <tr key={error.id} className="hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    {error.id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {error.message}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${error.type === 'System' ? 'bg-purple-900 text-purple-300' : 'bg-amber-900 text-amber-300'}`}>
                      {error.type === 'System' ? (
                        <AlertCircle size={12} className="mr-1" />
                      ) : (
                        <AlertTriangle size={12} className="mr-1" />
                      )}
                      {error.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityClass(error.severity)}`}>
                      {error.severity.charAt(0).toUpperCase() + error.severity.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {formatDate(error.timestamp)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-400">
                  No errors found matching your criteria
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
