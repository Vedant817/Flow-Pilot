import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Inventory } from "@/models/Inventory";

export async function PUT(request: NextRequest) {
    try {
        const { productId, newPrice } = await request.json();
        
        if (!productId || !newPrice) {
            return NextResponse.json({ 
                error: "Missing required fields: productId and newPrice" 
            }, { status: 400 });
        }

        await dbConnect();

        const product = await Inventory.findById(productId);
        if (!product) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        const oldPrice = product.price;
        product.price = newPrice;
        await product.save();

        return NextResponse.json({
            message: "Price updated successfully",
            product: {
                id: product._id,
                name: product.name,
                oldPrice: oldPrice,
                newPrice: newPrice,
                priceChange: newPrice - oldPrice,
                priceChangePercent: ((newPrice - oldPrice) / oldPrice * 100).toFixed(2)
            }
        });

    } catch (error) {
        console.error("Error updating price:", error);
        return NextResponse.json({ 
            error: "Failed to update price",
            details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}