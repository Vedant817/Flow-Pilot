"use client";
import { useState, useEffect } from "react";
import { AlertTriangle, AlertCircle, Search } from "lucide-react";

interface ErrorItem {
  id: number;
  message: string;
  type: string;
  severity: string;
  timestamp: string;
}

export default function ErrorsPage() {
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [filterType, setFilterType] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const API_ENDPOINT = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    async function fetchErrors() {
      try {
        const response = await fetch(`${API_ENDPOINT}/errors`); 
        const data = await response.json();
        if (data.errors) {
          setErrors(
            data.errors.map((error: { errorMessage: string; type: string; severity: string; timestamp: string }, index: number) => ({
              id: index + 1,
              message: error.errorMessage,
              type: error.type,
              severity: error.severity.toLowerCase(),
              timestamp: error.timestamp,
            }))
          );
        }
      } catch (error) {
        console.error("Error fetching errors:", error);
      }
    }

    fetchErrors();
  }, []);

  const filteredErrors = errors.filter((error) => {
    if (filterType !== "All" && error.type !== filterType) return false;
    if (searchQuery && !error.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const systemErrors = filteredErrors.filter((e) => e.type === "System").length;
  const customerErrors = filteredErrors.filter((e) => e.type === "Customer").length;

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case "low":
        return "bg-blue-900 text-blue-300";
      case "medium":
        return "bg-yellow-900 text-yellow-300";
      case "high":
        return "bg-orange-900 text-orange-300";
      case "critical":
        return "bg-red-900 text-red-300";
      default:
        return "bg-gray-800 text-gray-300";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="p-6 bg-black text-white min-h-screen w-full">
      <h1 className="text-3xl font-bold mb-6">Error Logs</h1>

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

      <div className="flex mb-6">
        {["All", "System", "Customer"].map((type) => (
          <button
            key={type}
            className={`px-4 py-2 rounded-lg mr-2 ${
              filterType === type ? "bg-[#00E676] text-black" : "bg-gray-800 text-white"
            }`}
            onClick={() => setFilterType(type)}
          >
            {type}
          </button>
        ))}
      </div>

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
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{error.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">{error.message}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        error.type === "System" ? "bg-purple-900 text-purple-300" : "bg-amber-900 text-amber-300"
                      }`}
                    >
                      {error.type === "System" ? <AlertCircle size={12} className="mr-1" /> : <AlertTriangle size={12} className="mr-1" />}
                      {error.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityClass(error.severity)}`}>
                      {error.severity.charAt(0).toUpperCase() + error.severity.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{formatDate(error.timestamp)}</td>
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