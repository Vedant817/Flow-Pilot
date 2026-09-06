import mongoose, { Schema, Document, Model } from 'mongoose';

interface IInventory extends Document {
    name: string;
    nameKey?: string;
    category: string;
    quantity: number;
    price: number;
    stock_alert_level: number;
    warehouse_location: string;
}

const InventorySchema = new Schema<IInventory>({
    name: { type: String, required: true },
    nameKey: { type: String, lowercase: true, trim: true, index: true },
    category: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    stock_alert_level: { type: Number, required: true },
    warehouse_location: { type: String, required: true },
}, {
    collection: 'inventory',
    timestamps: false,
});

(InventorySchema as any).pre('validate', function (this: any, next: any) {
    const doc = this as IInventory;
    if (doc.name && !doc.nameKey) {
        doc.nameKey = doc.name.toLowerCase().trim();
    }
    next();
});

export const Inventory: Model<IInventory> = mongoose.models.Inventory || mongoose.model<IInventory>('Inventory', InventorySchema);