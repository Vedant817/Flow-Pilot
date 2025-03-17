'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface ProductItem {
    name: string;
    quantity: number;
}

interface Order {
    id: string;
    name: string;
    email: string;
    phone: string;
    date: string;
    time: string;
    products: ProductItem[];
    status: string;
    orderLink: string;
}

const StatusBadge = ({ status }: { status: string }) => {
    const statusClass = useMemo(() => {
        if (status === 'completed') return 'bg-green-900 text-green-300 border border-green-700';
        if (status === 'pending fulfillment') return 'bg-yellow-900 text-yellow-300 border border-yellow-700';
        return 'bg-blue-900 text-blue-300 border border-blue-700';
    }, [status]);

    const formattedStatus = useMemo(() => {
        return status.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }, [status]);

    return (
        <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusClass}`}>
            {formattedStatus}
        </span>
    );
};

const OrderItems = ({ products }: { products: ProductItem[] }) => (
    <div className="overflow-x-auto">
        <table className="w-full border-collapse">
            <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#333333]">
                    <th className="text-left p-3 text-[#AAAAAA]">Product</th>
                    <th className="text-left p-3 text-[#AAAAAA]">Quantity</th>
                </tr>
            </thead>
            <tbody>
                {products.map((item, index) => (
                    <tr key={index} className="border-b border-[#333333] hover:bg-[#1A1A1A] transition-colors">
                        <td className="p-3 text-[#E0E0E0]">{item.name}</td>
                        <td className="p-3 text-[#E0E0E0]">{item.quantity}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

export default function OrderTrackingPage() {
    const { orderId } = useParams();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOrderData = useCallback(async () => {
        if (!orderId) return;
        
        try {
            setLoading(true);
            const controller = new AbortController();
            const signal = controller.signal;
            
            const response = await fetch(`http://localhost:5000/orders/${orderId}`, { signal });

            if (!response.ok) {
                throw new Error('Failed to fetch order data');
            }

            const data = await response.json();
            setOrder(data);
            setError(null);
        } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
                setError(err.message || 'An unknown error occurred');
                setOrder(null);
            }
        } finally {
            setLoading(false);
        }
    }, [orderId]);

    useEffect(() => {
        if (orderId) {
            const controller = new AbortController();
            
            fetchOrderData();
            
            return () => {
                controller.abort();
            };
        }
    }, [orderId, fetchOrderData]);

    const loadingView = useMemo(() => (
        <div className="flex justify-center items-center min-h-screen bg-[#0A0A0A] text-white h-screen w-full">
            <p className="text-xl">Loading order information...</p>
        </div>
    ), []);

    const errorView = useMemo(() => error && (
        <div className="flex justify-center items-center min-h-screen bg-[#0A0A0A] text-white">
            <div className="bg-[#1A1A1A] border border-red-700 p-6 rounded-lg">
                <h2 className="text-2xl text-red-500 mb-2">Error</h2>
                <p className="text-red-400">{error}</p>
            </div>
        </div>
    ), [error]);

    const emptyView = useMemo(() => (
        <div className="flex justify-center items-center min-h-screen bg-[#0A0A0A] text-white">
            <p className="text-xl">Order not found</p>
        </div>
    ), []);

    if (loading) return loadingView;
    if (error) return errorView;
    if (!order) return emptyView;

    return (
        <div className="container mx-auto px-4 py-8 bg-[#0A0A0A] text-white min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-[#E0E0E0] border-b border-[#333333] pb-4">Order Tracking</h1>

            <div className="bg-[#121212] text-white shadow-lg rounded-lg p-6 mb-6 border border-[#333333]">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-[#333333] pb-4">
                    <h2 className="text-2xl font-semibold text-[#E0E0E0] mb-2 md:mb-0">Order #{order.id}</h2>
                    <StatusBadge status={order.status} />
                </div>

                <div className="mb-6 border-b border-[#333333] pb-4">
                    <p className="text-[#AAAAAA] mb-2">Order Date: <span className="text-white">{order.date}</span></p>
                    <p className="text-[#AAAAAA]">Order Time: <span className="text-white">{order.time}</span></p>
                </div>

                <div className="mb-6 border-b border-[#333333] pb-4">
                    <h3 className="text-xl font-semibold mb-3 text-[#E0E0E0]">Customer Information</h3>
                    <p className="mb-2"><span className="text-[#AAAAAA] font-medium">Name:</span> <span className="text-white">{order.name}</span></p>
                    <p className="mb-2"><span className="text-[#AAAAAA] font-medium">Email:</span> <span className="text-white">{order.email}</span></p>
                    <p><span className="text-[#AAAAAA] font-medium">Phone:</span> <span className="text-white">{order.phone}</span></p>
                </div>

                <div>
                    <h3 className="text-xl font-semibold mb-4 text-[#E0E0E0]">Order Items</h3>
                    <OrderItems products={order.products} />
                </div>
            </div>
        </div>
    );
}