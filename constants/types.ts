export type OrderStatus = 'Processing' | 'Pending' | 'Completed';

export type Order = {
    id: string;
    customerName: string;
    status: OrderStatus;
    orderDate: string;
    deadlineDate: string;
};

export interface Product {
    name: string;
    quantity: number;
}

export interface OrderDetails {
    _id: string;
    name: string;
    phone: string;
    email: string;
    date: string;
    time: string;
    products: Product[];
    status: string;
    orderLink: string;
}

export interface ProductSalesData {
    bestSelling: Array<{
        name: string;
        quantity: number;
    }>;
    worstSelling: Array<{
        name: string;
        quantity: number;
    }>;
}

export interface CustomerFeedbackData {
    customer?: string;
    customerName?: string;
    user?: string;
    comment?: string;
    feedback?: string;
    text?: string;
    sentiment?: number;
    sentimentScore?: number;
    rating?: number;
    date?: string;
    timestamp?: string;
    createdAt?: string;
}

export interface RevenueData {
    date: string;
    revenue: number;
}

export interface CustomerSpendingData {
    names: string[];
    amounts: number[];
}

export interface OrderTrendData {
    dates: string[];
    counts: number[];
}

export interface FrequentCustomerData {
    names: string[];
    counts: number[];
}

export interface AnalyticsData {
    productSales: ProductSalesData;
    customerFeedback: CustomerFeedbackData[];
    revenuePerDay: RevenueData[];
    orderTrends: OrderTrendData;
    topSpenders: CustomerSpendingData;
    frequentCustomers: FrequentCustomerData;
}