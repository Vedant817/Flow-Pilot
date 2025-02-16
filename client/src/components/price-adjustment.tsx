import { useEffect, useState } from "react";

interface PricingRecommendation {
  Product: string;
  "Old Price": number;
  "New Price": number;
}

export function PriceAdjustments() {
  const [prices, setPrices] = useState<PricingRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:5000/dynamic_pricing")
      .then((res) => res.json())
      .then((data) => {
        try {
          // Extract JSON content from the embedded string
          const jsonString = data["Pricing Suggestions"]
            .replace("```json", "")
            .replace("```", "")
            .trim();
          const parsedData = JSON.parse(jsonString);
          setPrices(parsedData.pricing_recommendations);
        } catch {
          setError("Failed to parse pricing recommendations.");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load pricing data.");
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
        Price Adjustments 📉📈
      </h2>

      {loading && <p className="text-center text-gray-600">Loading...</p>}
      {error && <p className="text-center text-red-500">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {prices.map((item, index) => (
          <div
            key={index}
            className="bg-white shadow-lg rounded-xl p-5 border text-center"
          >
            <h3 className="text-lg font-semibold text-gray-900">{item.Product}</h3>
            <p className="text-gray-500 mt-2">
              Old Price:{" "}
              <span className="line-through text-red-500">${item["Old Price"].toFixed(2)}</span>
            </p>
            <p className="mt-1 text-gray-900 font-bold">
              New Price: <span className="text-green-600">${item["New Price"].toFixed(2)}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
