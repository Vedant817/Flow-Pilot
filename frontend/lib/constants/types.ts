export type OrderStatus = 'Processing' | 'Pending' | 'Completed';

export type Order = {
    id: string;
    customerName: string;
    status: OrderStatus;
    orderDate: string;
    deadlineDate: string;
};