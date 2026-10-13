import mongoose, { Schema, Document, Model } from 'mongoose';

interface Product {
    name: string;
    quantity: number;
    unitPrice?: number;
    lineValueMinor?: number;
    nameKey?: string;
}

interface IOrder extends Document {
    name: string;
    phone: string;
    email: string;
    emailNormalized?: string;
    orgId: string;
    date: string;
    time: string;
    orderedAt?: Date;
    products: Product[];
    status: string;
    orderLink: string;
    pricing?: {
        originalMinor: number;
        discountMinor: number;
        finalMinor: number;
        setupFeeMinor?: number;
        currency: string;
        priceSource: 'snapshot' | 'inventory' | 'estimated';
    };
    appliedCoupon?: {
        code: string;
        schemeId: mongoose.Types.ObjectId;
        benefitType: string;
        discountMinor: number;
    };
    idempotencyKey?: string;
    trackingTokenHash?: string;
}

const ProductSchema = new Schema<Product>({
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, min: 0 },
    lineValueMinor: { type: Number, min: 0 },
    nameKey: { type: String },
}, { _id: false });

const OrderSchema = new Schema<IOrder>({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true, trim: true },
    emailNormalized: { type: String, trim: true, lowercase: true, index: true },
    orgId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    orderedAt: { type: Date, sparse: true } as any,
    products: { type: [ProductSchema], required: true },
    status: { type: String, required: true },
    orderLink: { type: String, required: true },
    pricing: {
        originalMinor: { type: Number, min: 0 },
        discountMinor: { type: Number, min: 0 },
        finalMinor: { type: Number, min: 0 },
        setupFeeMinor: { type: Number, min: 0 },
        currency: { type: String },
        priceSource: { type: String, enum: ['snapshot', 'inventory', 'estimated'] },
    },
    appliedCoupon: {
        code: { type: String },
        schemeId: { type: Schema.Types.ObjectId, ref: 'PromotionScheme' },
        benefitType: { type: String },
        discountMinor: { type: Number, min: 0 },
    },
    idempotencyKey: { type: String, sparse: true } as any,
    trackingTokenHash: { type: String, sparse: true, select: false } as any,
}, {
    collection: 'orders',
    timestamps: false,
});

(OrderSchema as any).pre('validate', function (this: any, next: any) {
    const doc = this as IOrder;
    if (doc.email && !doc.emailNormalized) {
        doc.emailNormalized = doc.email.toLowerCase().trim();
    }
    next();
});

export const Order: Model<IOrder> = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);