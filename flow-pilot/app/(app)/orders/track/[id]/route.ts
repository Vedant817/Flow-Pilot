import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { Order } from "@/models/Order";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        if (!isValidObjectId(id)) {
            return NextResponse.json({ error: "Invalid Order ID" })
        }

        const order = await Order.findById(id);
        if (!order) {
            return NextResponse.json({ error: "Order Not Found for the given ID" })
        }

        const order_info = {
            id: order._id,
            name: order.name,
            phone: order.phone,
            email: order.email,
            date: order.date,
            time: order.time,
            products: order.products,
            status: order.status,
            orderLink: order.orderLink
        }

        return NextResponse.json(order_info)

    } catch (error) {
        console.log(error)
        return NextResponse.error()
    }
}