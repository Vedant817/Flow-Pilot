import { NextResponse } from "next/server";
import { Inventory } from "@/models/Inventory";

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const id = await params.id;
        const inventory = await Inventory.findById(id);
        return NextResponse.json(inventory);
    } catch (error) {
        console.error(error);
        return NextResponse.error();
    }
}