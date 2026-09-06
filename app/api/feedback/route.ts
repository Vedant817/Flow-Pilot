import { NextRequest, NextResponse } from "next/server";
import { Feedback } from "@/models/Feedback";
import dbConnect from "@/lib/mongodb";

export async function GET() {
    try {
        await dbConnect();
        const feedback = await Feedback.find({}).sort({ createdAt: -1 });
        return NextResponse.json({
            success: true,
            data: feedback,
            count: feedback.length
        });
    } catch (error) {
        console.error("Error fetching feedback:", error);
        return NextResponse.json(
            { 
                success: false, 
                error: "Failed to fetch feedback",
                message: error instanceof Error ? error.message : "Unknown error"
            }, 
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        await dbConnect();
        
        const body = await request.json();
        const { email, review, type } = body;

        if (!email || !review || !type) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required fields",
                    message: "Email, review, and type are required"
                },
                { status: 400 }
            );
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid email format",
                    message: "Please provide a valid email address"
                },
                { status: 400 }
            );
        }

        const validTypes = ['good', 'bad', 'neutral'];
        if (!validTypes.includes(type.toLowerCase())) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid feedback type",
                    message: "Type must be one of: good, bad, neutral"
                },
                { status: 400 }
            );
        }

        if (review.trim().length < 5) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Review too short",
                    message: "Review must be at least 5 characters long"
                },
                { status: 400 }
            );
        }

        if (review.trim().length > 1000) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Review too long",
                    message: "Review must be less than 1000 characters"
                },
                { status: 400 }
            );
        }

        const newFeedback = new Feedback({
            email: email.trim().toLowerCase(),
            review: review.trim(),
            type: type.toLowerCase(),
            createdAt: new Date()
        });

        const savedFeedback = await newFeedback.save();

        return NextResponse.json(
            {
                success: true,
                message: "Feedback added successfully",
                data: savedFeedback
            },
            { status: 201 }
        );

    } catch (error) {
        console.error("Error adding feedback:", error);
        
        if (error instanceof Error && error.name === 'ValidationError') {
            return NextResponse.json(
                {
                    success: false,
                    error: "Validation error",
                    message: error.message
                },
                { status: 400 }
            );
        }

        if (error instanceof Error && 'code' in error && error.code === 11000) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Duplicate entry",
                    message: "This feedback entry already exists"
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                error: "Failed to add feedback",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}