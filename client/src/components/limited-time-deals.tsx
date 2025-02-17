import { useEffect, useState } from "react";

interface Deal {
  name: string;
  original_price: number;
  discounted_price: number;
  discount_percent: number;
  deal_expires: string;
}

export function LimitedTimeDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:5000/limited-time-deals")
      .then((res) => res.json())
      .then((data) => {
        setDeals(data.limited_time_deals);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load deals.");
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
        Limited-Time Deals 🔥
      </h2>

      {loading && <p className="text-center text-gray-600">Loading...</p>}
      {error && <p className="text-center text-red-500">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {deals.map((deal, index) => (
          <div key={index} className="bg-white shadow-lg rounded-xl p-5 border">
            <h3 className="text-lg font-semibold text-gray-900">{deal.name}</h3>
            <p className="text-sm text-gray-500">
              Deal expires: <span className="font-medium">{deal.deal_expires}</span>
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-red-500 font-bold text-lg">
                -{deal.discount_percent}%
              </span>
              <span className="line-through text-gray-500">${deal.original_price}</span>
              <span className="text-green-600 font-semibold text-lg">
                ${deal.discounted_price}
              </span>
            </div>
            {/* <button className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
              Offer Deal
            </button> */}
          </div>
        ))}
      </div>
    </div>
  );
}
