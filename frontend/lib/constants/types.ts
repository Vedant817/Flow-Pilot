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
    orderLink?: string;
    Order_Link?: string;
    name?: string;
    Customer_Name?: string;
    status?: string;
    Status?: string;
    date?: string;
    Date?: string;
    time?: string;
    Time?: string;
    email?: string;
    Email?: string;
    Products?: Product[];
};