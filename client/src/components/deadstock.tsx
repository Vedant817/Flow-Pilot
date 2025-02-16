import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle } from "lucide-react";

export function DeadStock() {
  const [deadstocks, setDeadstocks] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("http://127.0.0.1:5000/deadstocks")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch deadstocks");
        }
        return response.json();
      })
      .then((data) => setDeadstocks(data.deadstocks))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg font-bold">Dead Stock Items</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-red-500 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> {error}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Inventory</TableHead>
                <TableHead>Sales</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deadstocks.length > 0 ? (
                deadstocks.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.inventory}</TableCell>
                    <TableCell>{item.sales}</TableCell>
                    <TableCell>{item.status}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-500">
                    No dead stock items found.
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
