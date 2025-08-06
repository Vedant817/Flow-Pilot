/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Order } from "@/models/Order";

export async function GET(request: NextRequest) {
    try {
        await dbConnect();

        const orders = await Order.find({})
            .sort({ date: -1, time: -1 })
            .lean();

        const formattedOrders = orders.map(order => ({
            ...order,
            _id: order._id.toString(),
        }));

        return NextResponse.json(formattedOrders, { status: 200 });
    } catch (error) {
        console.error("Error retrieving orders:", error);
        return NextResponse.json({ error: "Failed to retrieve orders" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const { orderId, status } = await req.json();
        if (!orderId || !status) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        await dbConnect();

        const updatedOrder = await Order.findByIdAndUpdate(orderId, { status }, { new: true });

        if (!updatedOrder) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        return NextResponse.json({
            message: "Order status updated successfully",
            order: {
                ...updatedOrder.toObject(),
                _id: updatedOrder._id!.toString()
            }
        }, { status: 200 });
    } catch (error) {
        console.error("Error updating order status:", error);
        return NextResponse.json({ error: "Failed to update order status" }, { status: 500 });
    }
}