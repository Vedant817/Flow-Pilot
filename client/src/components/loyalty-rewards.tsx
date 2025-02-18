import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Loader2 } from "lucide-react"; // Importing loader icon

export function LoyaltyRewards() {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true); // Added loading state
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("http://127.0.0.1:5000/loyalty-rewards")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch loyalty rewards");
        }
        return response.json();
      })
      .then((data) => setRewards(data.loyalty_rewards))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false)); // Stop loading after fetch
  }, []);

  // Function to determine background color based on loyalty tier
  const getRowStyle = (tier) => {
    switch (tier) {
      case "Gold":
        return "bg-yellow-300"; // Gold
      case "Silver":
        return "bg-gray-300"; // Silver
      default:
        return "bg-blue-200"; // Blue for new customers
    }
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg font-bold">Loyalty Rewards</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          // Show loader while data is being fetched
          <div className="flex justify-center items-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">Loading rewards...</span>
          </div>
        ) : error ? (
          // Show error message if fetch fails
          <div className="text-red-500 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> {error}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Name</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Discount (%)</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rewards.length > 0 ? (
                rewards.map((customer, index) => (
                  <TableRow key={index} className={getRowStyle(customer.loyaltyTier)}>
                    <TableCell>{customer.customerName}</TableCell>
                    <TableCell>{customer.loyaltyTier}</TableCell>
                    <TableCell>{customer.discountPercent}%</TableCell>
                    <TableCell>{customer.reason}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-500">
                    No loyalty rewards found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
