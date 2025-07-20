import mongoose, { Schema, Document, Model } from 'mongoose';

interface Product {
    name: string;
    quantity: number;
}

interface IOrder extends Document {
    name: string;
    phone: string;
    email: string;
    date: string;
    time: string;
    products: Product[];
    status: string;
    orderLink: string;
}

const ProductSchema = new Schema<Product>({
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
}, { _id: false });

const OrderSchema = new Schema<IOrder>({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    products: { type: [ProductSchema], required: true },
    status: { type: String, required: true },
    orderLink: { type: String, required: true },
}, {
    collection: 'orders',
    timestamps: false,
});

export const Order: Model<IOrder> = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);