import { useEffect, useState } from "react";

export function PersonalizedOffers () {
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    fetch("http://127.0.0.1:5000/personalized-offers")
      .then((response) => response.json())
      .then((data) => {
        if (data.personalized_offers && data.personalized_offers.offers) {
          setOffers(data.personalized_offers.offers);
        }
      })
      .catch((error) => console.error("Error fetching offers:", error));
  }, []);

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h2 className="text-2xl font-semibold text-center mb-6">🎁 Personalized Offers</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {offers.length > 0 ? (
          offers.map((offer, index) => (
            <div key={index} className="bg-white shadow-lg p-4 rounded-lg border-l-4 border-blue-500">
              <h3 className="text-lg font-semibold text-gray-700">{offer.customer_email}</h3>
              <p className="text-gray-600">{offer.offer_message}</p>
              <div className="mt-3">
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-md font-medium text-sm">
                  Code: {offer.discount_code}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center col-span-3 text-gray-500">Loading offers...</p>
        )}
      </div>
    </div>
  );
};

