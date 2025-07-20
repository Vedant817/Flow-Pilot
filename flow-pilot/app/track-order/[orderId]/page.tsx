'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Package,
    Calendar,
    Clock,
    User,
    Mail,
    Phone,
    CheckCircle2,
    Truck,
    AlertCircle,
    MapPin,
    ShoppingBag,
    Download,
    Loader2
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

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
    const statusConfig = useMemo(() => {
        switch (status.toLowerCase()) {
            case 'fulfilled':
            case 'completed':
            case 'delivered':
                return {
                    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    icon: <CheckCircle2 className="w-5 h-5" />,
                    dotColor: 'bg-emerald-500'
                };
            case 'partially fulfilled':
            case 'in transit':
            case 'shipped':
                return {
                    color: 'bg-amber-50 text-amber-700 border-amber-200',
                    icon: <Truck className="w-5 h-5" />,
                    dotColor: 'bg-amber-500'
                };
            case 'pending fulfillment':
            case 'pending':
            case 'processing':
                return {
                    color: 'bg-blue-50 text-blue-700 border-blue-200',
                    icon: <Clock className="w-5 h-5" />,
                    dotColor: 'bg-blue-500'
                };
            default:
                return {
                    color: 'bg-slate-50 text-slate-700 border-slate-200',
                    icon: <AlertCircle className="w-5 h-5" />,
                    dotColor: 'bg-slate-500'
                };
        }
    }, [status]);

    const formattedStatus = useMemo(() => {
        return status.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }, [status]);

    return (
        <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full border text-lg font-semibold ${statusConfig.color}`}>
            <div className={`w-3 h-3 rounded-full ${statusConfig.dotColor} animate-pulse`}></div>
            {statusConfig.icon}
            {formattedStatus}
        </div>
    );
};

const StatusTimeline = ({ status }: { status: string }) => {
    const steps = [
        { key: 'pending', label: 'Order Placed', icon: <ShoppingBag className="w-5 h-5" /> },
        { key: 'processing', label: 'Processing', icon: <Package className="w-5 h-5" /> },
        { key: 'shipped', label: 'Shipped', icon: <Truck className="w-5 h-5" /> },
        { key: 'delivered', label: 'Delivered', icon: <CheckCircle2 className="w-5 h-5" /> }
    ];

    const getCurrentStep = () => {
        switch (status.toLowerCase()) {
            case 'pending fulfillment':
            case 'pending':
                return 0;
            case 'partially fulfilled':
            case 'processing':
                return 1;
            case 'in transit':
            case 'shipped':
                return 2;
            case 'fulfilled':
            case 'completed':
            case 'delivered':
                return 3;
            default:
                return 0;
        }
    };

    const currentStep = getCurrentStep();

    return (
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200 w-screen">
            <h3 className="text-2xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                <MapPin className="w-6 h-6 text-blue-600" />
                Order Progress
            </h3>
            <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200"></div>
                <div
                    className="absolute left-6 top-0 w-0.5 bg-gradient-to-b from-blue-600 to-indigo-600 transition-all duration-1000 ease-out"
                    style={{ height: `${(currentStep / (steps.length - 1)) * 100}%` }}
                ></div>

                <div className="space-y-8">
                    {steps.map((step, index) => {
                        const isCompleted = index <= currentStep;
                        const isCurrent = index === currentStep;

                        return (
                            <div key={step.key} className="relative flex items-center gap-4">
                                <div className={`relative z-10 w-12 h-12 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${isCompleted
                                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 border-blue-600 text-white shadow-lg'
                                    : 'bg-white border-slate-200 text-slate-400'
                                    } ${isCurrent ? 'animate-pulse shadow-xl' : ''}`}>
                                    {step.icon}
                                </div>
                                <div className="flex-1">
                                    <h4 className={`font-semibold text-lg ${isCompleted ? 'text-slate-900' : 'text-slate-500'}`}>
                                        {step.label}
                                    </h4>
                                    <p className={`text-sm ${isCompleted ? 'text-slate-600' : 'text-slate-400'}`}>
                                        {isCurrent ? 'In Progress' : isCompleted ? 'Completed' : 'Pending'}
                                    </p>
                                </div>
                                {isCompleted && (
                                    <div className="text-emerald-600">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const OrderItems = ({ products }: { products: ProductItem[] }) => (
    <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200">
        <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
            <Package className="w-6 h-6 text-purple-600" />
            Order Items ({products.length} {products.length === 1 ? 'item' : 'items'})
        </h3>
        <div className="space-y-4">
            {products.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-6 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Package className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-900 text-lg">{item.name}</h4>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-medium text-slate-600">Quantity</p>
                        <p className="text-2xl font-bold text-slate-900">{item.quantity}</p>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export default function OrderTrackingPage() {
    const { orderId } = useParams();
    const router = useRouter();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOrderData = useCallback(async () => {
        if (!orderId) return;

        try {
            setLoading(true);
            const controller = new AbortController();
            const signal = controller.signal;

            const response = await fetch(`http://localhost:3000/orders/track/${orderId}`, { signal });

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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center w-screen">
            <div className="bg-white rounded-2xl p-12 shadow-2xl border border-slate-200 text-center max-w-md w-full mx-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Loading Order</h2>
                <p className="text-slate-600">Fetching your order information...</p>
            </div>
        </div>
    ), []);

    const errorView = useMemo(() => error && (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-pink-50 flex items-center justify-center w-screen">
            <div className="bg-white rounded-2xl p-12 shadow-2xl border border-red-200 text-center max-w-md w-full mx-4">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <AlertCircle className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Error Loading Order</h2>
                <p className="text-slate-600 mb-6">{error}</p>
                <button
                    onClick={() => router.back()}
                    className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl"
                >
                    Go Back
                </button>
            </div>
        </div>
    ), [error, router]);

    const emptyView = useMemo(() => (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center w-screen">
            <div className="bg-white rounded-2xl p-12 shadow-2xl border border-slate-200 text-center max-w-md w-full mx-4">
                <div className="w-16 h-16 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Package className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Order Not Found</h2>
                <p className="text-slate-600 mb-6">The order you&apos;re looking for doesn&apos;t exist or may have been removed.</p>
                <button
                    onClick={() => router.back()}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
                >
                    Go Back
                </button>
            </div>
        </div>
    ), [router]);

    if (loading) return loadingView;
    if (error) return errorView;
    if (!order) return emptyView;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <ScrollArea className="h-full w-full">
                <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-50 shadow-sm">
                    <div className="container mx-auto px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-900">Order Tracking</h1>
                                    <p className="text-slate-600">Track your order status in real-time</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => window.print()}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm hover:shadow-md"
                                >
                                    <Download className="w-4 h-4" />
                                    Print
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="container mx-auto px-6 py-4">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 mb-8 text-white shadow-2xl">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Order Id: {order.id.toUpperCase()}</h2>
                                <div className="flex flex-wrap items-center gap-4 text-blue-100">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-5 h-5" />
                                        <span>{order.date}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-5 h-5" />
                                        <span>{order.time}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                                <StatusBadge status={order.status} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200">
                            <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                                <User className="w-6 h-6 text-green-600" />
                                Customer Information
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                                        <User className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-600">Customer Name</p>
                                        <p className="text-lg font-bold text-slate-900">{order.name}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                                        <Mail className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-slate-600">Email Address</p>
                                        <p className="text-lg font-bold text-slate-900 truncate">{order.email}</p>
                                    </div>
                                </div>

                                {order.phone && (
                                    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                                            <Phone className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-600">Phone Number</p>
                                            <p className="text-lg font-bold text-slate-900">{order.phone}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <StatusTimeline status={order.status} />
                    </div>

                    <div className="mb-8">
                        <OrderItems products={order.products} />
                    </div>

                    <div className="flex justify-center pt-8">
                        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                            <button
                                onClick={() => fetchOrderData()}
                                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
                            >
                                Refresh Status
                            </button>
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}