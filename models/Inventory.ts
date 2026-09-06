import mongoose, { Schema, Document, Model } from 'mongoose';

interface IInventory extends Document {
    name: string;
    category: string;
    quantity: number;
    price: number;
    stock_alert_level: number;
    warehouse_location: string;
}

const InventorySchema = new Schema<IInventory>({
    name: { type: String, required: true },
    category: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    stock_alert_level: { type: Number, required: true },
    warehouse_location: { type: String, required: true },
}, {
    collection: 'inventory',
    timestamps: false,
});

export const Inventory: Model<IInventory> = mongoose.models.Inventory || mongoose.model<IInventory>('Inventory', InventorySchema);