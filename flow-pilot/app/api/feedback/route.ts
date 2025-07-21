import { NextResponse } from "next/server";
import { Feedback } from "@/models/Feedback";

export async function GET() {
    try {
        const feedback = await Feedback.find({});
        return NextResponse.json(feedback);
    } catch (error) {
        console.error("Error fetching feedback:", error);
        return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
    }
}