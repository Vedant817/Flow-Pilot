export type OrderStatus = 'Processing' | 'Pending' | 'Completed';

export type Order = {
    id: string;
    customerName: string;
    status: OrderStatus;
    orderDate: string;
    deadlineDate: string;
};

interface Product {
    name: string;
    product?: string;
    quantity: number;
};

export type OrderDetails = {
    _id: string;
    name: string;
    phone: string;
    email: string;
    date: string;
    time: string;
    products: Product[];
    status: string;
    orderLink: string;
};