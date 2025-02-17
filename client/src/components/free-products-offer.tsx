import { useEffect, useState } from "react";

interface FreeProduct {
  customerName: string;
  freeProduct: string;
  reason: string;
}

export function FreeProductsOffer() {
  const [products, setProducts] = useState<FreeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:5000/free-product-assignments")
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.free_product_assignments);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load free product offers.");
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
        Free Products Offer 🎁
      </h2>

      {loading && <p className="text-center text-gray-600">Loading...</p>}
      {error && <p className="text-center text-red-500">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((product, index) => (
          <div key={index} className="bg-white shadow-lg rounded-xl p-5 border">
            <h3 className="text-lg font-semibold text-gray-900">
              {product.freeProduct}
            </h3>
            <p className="text-sm text-gray-500">
              Awarded to:{" "}
              <span className="font-medium text-blue-600">
                {product.customerName}
              </span>
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Reason: <span className="font-medium">{product.reason}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
