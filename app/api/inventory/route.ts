import { NextRequest, NextResponse } from "next/server";
import { Inventory } from "@/models/Inventory";

export async function GET(){
    try {
        const inventory = await Inventory.find({});
        return NextResponse.json(inventory);
    } catch (error) {
        console.log(error);
        return NextResponse.error();
    }
}

export async function POST(request: NextRequest){
    const data = await request.json();
    const required_fields = ['name', 'category', 'price', 'quantity', 'warehouse_location', 'stock_alert_level'];
    for (const field of required_fields) {
        if (!data[field]) {
            return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
        }
    }
    try {
        const result = await Inventory.insertOne(data);
        return NextResponse.json(result);
    } catch (error) {
        console.log(error);
        return NextResponse.error();
    }
}