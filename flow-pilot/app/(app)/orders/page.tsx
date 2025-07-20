'use client'
import React, { useState, useCallback, useMemo, memo, useEffect } from 'react'
import { Search, Filter, RefreshCw, Package, Calendar, User, Mail, Clock, CheckCircle2, AlertCircle, Truck, Eye, X, Phone, CreditCard } from 'lucide-react'
import axios from 'axios';
import { OrderDetails } from '@/constants/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Product {
    name: string;
    quantity: number;
};

interface OrderRowProps {
    order: OrderDetails;
    index: number;
    onStatusChange: (orderId: string, status: string) => void;
    onShowDetails: (order: OrderDetails) => void;
}

interface ActionButtonProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
}

const OrderCard = memo(({ order, onStatusChange, onShowDetails }: OrderRowProps) => {
    const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value;

        axios.put(`${process.env.NEXT_PUBLIC_API_URL}/orders`, {
            orderId: order._id,
            status: newStatus
        })
            .then(response => {
                console.log(response);
                onStatusChange(order._id, newStatus);
            })
            .catch(error => {
                console.error('Error updating order status:', error);
            })
    }, [order, onStatusChange]);

    const productsDisplay = () => {
        if (!order.products || order.products.length === 0) return 'No products';

        return order.products.slice(0, 2).map((p: Product) => {
            return `${p.name} (${p.quantity})`;
        }).join(', ') + (order.products.length > 2 ? ` +${order.products.length - 2} more` : '');
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'fulfilled':
                return {
                    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    icon: <CheckCircle2 className="w-4 h-4" />,
                    dot: 'bg-emerald-500'
                };
            case 'partially fulfilled':
                return {
                    color: 'bg-amber-50 text-amber-700 border-amber-200',
                    icon: <Truck className="w-4 h-4" />,
                    dot: 'bg-amber-500'
                };
            case 'pending fulfillment':
                return {
                    color: 'bg-blue-50 text-blue-700 border-blue-200',
                    icon: <Clock className="w-4 h-4" />,
                    dot: 'bg-blue-500'
                };
            default:
                return {
                    color: 'bg-slate-50 text-slate-700 border-slate-200',
                    icon: <AlertCircle className="w-4 h-4" />,
                    dot: 'bg-slate-500'
                };
        }
    };

    const statusConfig = getStatusConfig(order.status);

    return (
        <Card className="bg-white border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 group">
            <CardHeader className="pb-3">
                <CardTitle className="flex justify-between items-start">
                    <div className="space-y-1">
                        <span className="text-sm font-medium text-slate-600">Order ID</span>
                        <p className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            #{order._id.slice(-8).toUpperCase()}
                        </p>
                    </div>
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${statusConfig.color}`}>
                        {statusConfig.icon}
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-600">Customer</p>
                            <p className="text-slate-900 font-medium truncate">{order.name}</p>
                            <div className="flex items-center gap-1 mt-1">
                                <Mail className="w-3 h-3 text-slate-400" />
                                <p className="text-xs text-slate-500 truncate">{order.email}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-600">Products</p>
                            <p className="text-slate-900 text-sm leading-relaxed">{productsDisplay()}</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-600">Order Date</p>
                            <p className="text-slate-900 font-medium">{order.date}</p>
                            <p className="text-xs text-slate-500">{order.time}</p>
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between gap-3">
                        <button
                            onClick={() => onShowDetails(order)}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all text-sm font-medium"
                        >
                            <Eye className="w-4 h-4" />
                            Details
                        </button>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-600">Status:</label>
                            <select
                                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                value={order.status}
                                onChange={handleStatusChange}
                            >
                                <option value="pending fulfillment">Pending Fulfillment</option>
                                <option value="partially fulfilled">Partially Fulfilled</option>
                                <option value="fulfilled">Fulfilled</option>
                            </select>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
});
OrderCard.displayName = 'OrderCard';

const ActionButton = memo(({ icon, label, onClick, variant = 'secondary' }: ActionButtonProps) => (
    <button
        onClick={onClick}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${variant === 'primary'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-sm hover:shadow-md'
            }`}
        aria-label={label}
    >
        {icon}
        <span>{label}</span>
    </button>
));
ActionButton.displayName = 'ActionButton';

const StatsCard = memo(({ title, value, subtitle, icon, color }: {
    title: string;
    value: string | number;
    subtitle: string;
    icon: React.ReactNode;
    color: string;
}) => (
    <Card className="bg-white border border-slate-200 hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-600">{title}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
                    <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                    {icon}
                </div>
            </div>
        </CardContent>
    </Card>
));
StatsCard.displayName = 'StatsCard';

const OrderDetailsModal = memo(({ order, isOpen, onClose }: {
    order: OrderDetails | null;
    isOpen: boolean;
    onClose: () => void;
}) => {
    if (!isOpen || !order) return null;

    const productsDisplay = () => {
        if (!order.products || order.products.length === 0) return [];
        return order.products;
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'fulfilled':
                return {
                    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    icon: <CheckCircle2 className="w-5 h-5" />,
                    dot: 'bg-emerald-500'
                };
            case 'partially fulfilled':
                return {
                    color: 'bg-amber-50 text-amber-700 border-amber-200',
                    icon: <Truck className="w-5 h-5" />,
                    dot: 'bg-amber-500'
                };
            case 'pending fulfillment':
                return {
                    color: 'bg-blue-50 text-blue-700 border-blue-200',
                    icon: <Clock className="w-5 h-5" />,
                    dot: 'bg-blue-500'
                };
            default:
                return {
                    color: 'bg-slate-50 text-slate-700 border-slate-200',
                    icon: <AlertCircle className="w-5 h-5" />,
                    dot: 'bg-slate-500'
                };
        }
    };

    const statusConfig = getStatusConfig(order.status);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold">Order Details</h2>
                            <p className="text-blue-100 mt-1">Complete order information</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border border-slate-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-slate-900">
                                    <Package className="w-5 h-5 text-blue-600" />
                                    Order Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-sm font-medium text-slate-600">Order ID</label>
                                        <p className="text-lg font-bold text-slate-900">#{order._id.toUpperCase()}</p>
                                    </div>
                                    <div>
                                        <label className="text-lg font-medium text-slate-600">Status: </label>
                                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium mt-1 ${statusConfig.color} h-8`}>
                                            {statusConfig.icon}
                                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-600">Order Date & Time</label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            <p className="text-slate-900 font-medium">{order.date}</p>
                                            <Clock className="w-4 h-4 text-slate-400 ml-2" />
                                            <p className="text-slate-900">{order.time}</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border border-slate-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-slate-900">
                                    <User className="w-5 h-5 text-green-600" />
                                    Customer Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-sm font-medium text-slate-600">Customer Name</label>
                                        <p className="text-slate-900 font-medium text-lg">{order.name || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-600">Email Address</label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Mail className="w-4 h-4 text-slate-400" />
                                            <p className="text-slate-900">{order.email}</p>
                                        </div>
                                    </div>
                                    {order.phone && (
                                        <div>
                                            <label className="text-sm font-medium text-slate-600">Phone Number</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Phone className="w-4 h-4 text-slate-400" />
                                                <p className="text-slate-900">{order.phone}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border border-slate-200 lg:col-span-2">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-slate-900">
                                    <Package className="w-5 h-5 text-purple-600" />
                                    Products Ordered ({productsDisplay().length} items)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {productsDisplay().length > 0 ? (
                                        productsDisplay().map((product: Product, index: number) => (
                                            <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                                                        <Package className="w-5 h-5 text-slate-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-900">{product.name}</p>
                                                        <p className="text-sm text-slate-500">Product #{index + 1}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-slate-600">Quantity</p>
                                                    <p className="text-lg font-bold text-slate-900">{product.quantity}</p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-slate-500">
                                            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                            <p>No products found for this order</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border border-slate-200 lg:col-span-2">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-slate-900">
                                    <CreditCard className="w-5 h-5 text-indigo-600" />
                                    Order Link
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-600">Order Link</label>
                                    <p className="text-slate-900 mt-1 p-3 bg-slate-50 rounded-lg border border-slate-200 break-all">{order.orderLink}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="border-t border-slate-200 p-6 bg-slate-50">
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
                        >
                            Print Details
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});
OrderDetailsModal.displayName = 'OrderDetailsModal';

export default function OrdersPage() {
    const [filterText, setFilterText] = useState('');
    const [orders, setOrders] = useState<OrderDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedOrder, setSelectedOrder] = useState<OrderDetails | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const ordersPerPage = 9;

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/orders`);
                setOrders(response.data);
                setError('');
            } catch (err) {
                console.error('Error fetching orders:', err);
                setError('Failed to load orders. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, []);

    const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setFilterText(e.target.value);
        setCurrentPage(1);
    }, []);

    const handleStatusFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setStatusFilter(e.target.value);
        setCurrentPage(1);
    }, []);

    const handleStatusChange = useCallback((orderId: string, newStatus: string) => {
        setOrders(prevOrders =>
            prevOrders.map(order =>
                order._id === orderId
                    ? { ...order, status: newStatus }
                    : order
            )
        );
    }, []);

    const handleRefresh = useCallback(() => {
        window.location.reload();
    }, []);

    const handleShowDetails = useCallback((order: OrderDetails) => {
        setSelectedOrder(order);
        setIsModalOpen(true);
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setSelectedOrder(null);
    }, []);

    const filteredOrders = useMemo(() => {
        let filtered = orders;

        if (statusFilter !== 'all') {
            filtered = filtered.filter(order => order.status === statusFilter);
        }

        if (filterText.trim()) {
            const lowerCaseFilter = filterText.toLowerCase();
            filtered = filtered.filter(order => {
                const orderIdMatch = order._id.toLowerCase().includes(lowerCaseFilter);
                const nameMatch = order.name.toLowerCase().includes(lowerCaseFilter);
                const statusMatch = order.status.toLowerCase().includes(lowerCaseFilter);
                const emailMatch = order.email.toLowerCase().includes(lowerCaseFilter);

                return orderIdMatch || nameMatch || statusMatch || emailMatch;
            });
        }

        return filtered;
    }, [orders, filterText, statusFilter]);

    const stats = useMemo(() => {
        const total = orders.length;
        const fulfilled = orders.filter(o => o.status === 'fulfilled').length;
        const pending = orders.filter(o => o.status === 'pending fulfillment').length;
        const partial = orders.filter(o => o.status === 'partially fulfilled').length;

        return { total, fulfilled, pending, partial };
    }, [orders]);

    const indexOfLastOrder = currentPage * ordersPerPage;
    const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
    const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);
    const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);

    const paginate = (pageNumber: number) => {
        if (pageNumber > 0 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <div className="p-6 space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Order Management</h1>
                        <p className="text-slate-600 mt-1">Manage and track all your orders in one place</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <ActionButton
                            icon={<RefreshCw className="w-4 h-4" />}
                            label="Refresh"
                            onClick={handleRefresh}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatsCard
                        title="Total Orders"
                        value={stats.total}
                        subtitle="All time"
                        icon={<Package className="w-6 h-6 text-blue-600" />}
                        color="bg-blue-50"
                    />
                    <StatsCard
                        title="Fulfilled"
                        value={stats.fulfilled}
                        subtitle="Completed orders"
                        icon={<CheckCircle2 className="w-6 h-6 text-emerald-600" />}
                        color="bg-emerald-50"
                    />
                    <StatsCard
                        title="Pending"
                        value={stats.pending}
                        subtitle="Awaiting fulfillment"
                        icon={<Clock className="w-6 h-6 text-amber-600" />}
                        color="bg-amber-50"
                    />
                    <StatsCard
                        title="Partial"
                        value={stats.partial}
                        subtitle="Partially fulfilled"
                        icon={<Truck className="w-6 h-6 text-purple-600" />}
                        color="bg-purple-50"
                    />
                </div>

                <Card className="bg-white/80 backdrop-blur-md border border-slate-200">
                    <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search orders by ID, customer name, email, or status..."
                                    value={filterText}
                                    onChange={handleFilterChange}
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <Filter className="w-4 h-4 text-slate-400" />
                                <select
                                    value={statusFilter}
                                    onChange={handleStatusFilterChange}
                                    className="bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                >
                                    <option value="all">All Status</option>
                                    <option value="pending fulfillment">Pending Fulfillment</option>
                                    <option value="partially fulfilled">Partially Fulfilled</option>
                                    <option value="fulfilled">Fulfilled</option>
                                </select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    {loading ? (
                        <Card className="bg-white border border-slate-200">
                            <CardContent className="p-12">
                                <div className="flex flex-col items-center justify-center text-center">
                                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                                    <p className="text-slate-600 font-medium">Loading orders...</p>
                                    <p className="text-sm text-slate-500 mt-1">Please wait while we fetch your data</p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : error ? (
                        <Card className="bg-white border border-red-200">
                            <CardContent className="p-12">
                                <div className="flex flex-col items-center justify-center text-center">
                                    <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                                    <p className="text-red-600 font-medium text-lg">{error}</p>
                                    <button
                                        onClick={handleRefresh}
                                        className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {currentOrders.length > 0 ? (
                                    currentOrders.map((order, index) => (
                                        <OrderCard
                                            key={order._id}
                                            order={order}
                                            index={indexOfFirstOrder + index}
                                            onStatusChange={handleStatusChange}
                                            onShowDetails={handleShowDetails}
                                        />
                                    ))
                                ) : (
                                    <div className="col-span-full">
                                        <Card className="bg-white border border-slate-200">
                                            <CardContent className="p-12">
                                                <div className="flex flex-col items-center justify-center text-center">
                                                    <Package className="w-16 h-16 text-slate-300 mb-4" />
                                                    <p className="text-slate-600 font-medium text-lg">No orders found</p>
                                                    <p className="text-slate-500 mt-1">
                                                        {filterText || statusFilter !== 'all'
                                                            ? 'Try adjusting your search filters'
                                                            : 'Orders will appear here once they are created'
                                                        }
                                                    </p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}
                            </div>

                            {totalPages > 1 && (
                                <Card className="bg-white/80 backdrop-blur-md border border-slate-200">
                                    <CardContent className="p-6">
                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                            <div className="text-slate-600">
                                                Showing <span className="font-medium text-slate-900">{indexOfFirstOrder + 1}</span> to{' '}
                                                <span className="font-medium text-slate-900">
                                                    {Math.min(indexOfLastOrder, filteredOrders.length)}
                                                </span>{' '}
                                                of <span className="font-medium text-slate-900">{filteredOrders.length}</span> orders
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                    onClick={() => paginate(currentPage - 1)}
                                                    disabled={currentPage === 1}
                                                >
                                                    Previous
                                                </button>

                                                <div className="flex gap-1">
                                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                        let pageNum;
                                                        if (totalPages <= 5) {
                                                            pageNum = i + 1;
                                                        } else if (currentPage <= 3) {
                                                            pageNum = i + 1;
                                                        } else if (currentPage >= totalPages - 2) {
                                                            pageNum = totalPages - 4 + i;
                                                        } else {
                                                            pageNum = currentPage - 2 + i;
                                                        }

                                                        return (
                                                            <button
                                                                key={pageNum}
                                                                className={`w-10 h-10 rounded-lg font-medium transition-all ${currentPage === pageNum
                                                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                                                                        : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                                                    }`}
                                                                onClick={() => paginate(pageNum)}
                                                            >
                                                                {pageNum}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                <button
                                                    className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                    onClick={() => paginate(currentPage + 1)}
                                                    disabled={currentPage === totalPages}
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            </div>

            <OrderDetailsModal
                order={selectedOrder}
                isOpen={isModalOpen}
                onClose={handleCloseModal}
            />
        </div>
    )
}