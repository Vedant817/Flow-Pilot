/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { Error as ErrorModel } from "@/models/Error";
import dbConnect from "@/lib/mongodb";
import { getAuthContext } from "@/lib/auth";

// GET - Fetch all errors
export async function GET(request: NextRequest) {
    const ctx = await getAuthContext();
    if (!ctx.userId) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const orgId = ctx.orgId ?? 'default';
    try {
        await dbConnect();

        // Get query parameters for filtering and pagination
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const severity = searchParams.get('severity');
        const limit = parseInt(searchParams.get('limit') || '50');
        const page = parseInt(searchParams.get('page') || '1');
        const skip = (page - 1) * limit;

        // Build filter object
        const filter: any = { orgId };
        if (type && ['System', 'Customer'].includes(type)) {
            filter.type = type;
        }
        if (severity && ['low', 'medium', 'high', 'critical'].includes(severity.toLowerCase())) {
            filter.severity = severity.toLowerCase();
        }

        // Fetch errors with filtering and pagination
        const errors = await ErrorModel.find(filter)
            .sort({ timestamp: -1 })
            .limit(limit)
            .skip(skip);

        // Get total count for pagination
        const totalCount = await ErrorModel.countDocuments(filter);

        return NextResponse.json({
            success: true,
            data: errors,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalCount,
                hasNextPage: page < Math.ceil(totalCount / limit),
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        console.error("Error fetching errors:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch errors",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

// POST - Add new error
export async function POST(request: NextRequest) {
    const ctx = await getAuthContext();
    if (!ctx.userId) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const orgId = ctx.orgId ?? 'default';
    try {
        await dbConnect();

        const body = await request.json();
        const { errorMessage, type, severity } = body;

        // Validation
        if (!errorMessage || !type || !severity) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required fields",
                    message: "errorMessage, type, and severity are required"
                },
                { status: 400 }
            );
        }

        // Validate type
        const validTypes = ['System', 'Customer'];
        if (!validTypes.includes(type)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid error type",
                    message: "Type must be one of: System, Customer"
                },
                { status: 400 }
            );
        }

        // Validate severity
        const validSeverities = ['low', 'medium', 'high', 'critical'];
        if (!validSeverities.includes(severity.toLowerCase())) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid severity level",
                    message: "Severity must be one of: low, medium, high, critical"
                },
                { status: 400 }
            );
        }

        // Validate error message length
        if (errorMessage.trim().length < 5) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Error message too short",
                    message: "Error message must be at least 5 characters long"
                },
                { status: 400 }
            );
        }

        if (errorMessage.trim().length > 2000) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Error message too long",
                    message: "Error message must be less than 2000 characters"
                },
                { status: 400 }
            );
        }

        // Create new error
        const newError = new ErrorModel({
            errorMessage: errorMessage.trim(),
            type: type,
            severity: severity.toLowerCase(),
            timestamp: new Date(),
            orgId,
        } as any);

        const savedError = await newError.save();

        return NextResponse.json(
            {
                success: true,
                message: "Error logged successfully",
                data: savedError
            },
            { status: 201 }
        );

    } catch (error) {
        console.error("Error adding error log:", error);

        // Handle mongoose validation errors
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

        // Handle duplicate key errors
        if (error instanceof Error && 'code' in (error as unknown as Record<string, unknown>) && (error as unknown as { code: number }).code === 11000) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Duplicate entry",
                    message: "This error entry already exists"
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                error: "Failed to log error",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

// DELETE - Clear errors (optional utility endpoint)
export async function DELETE(request: NextRequest) {
    const ctx = await getAuthContext();
    if (!ctx.userId) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const orgId = ctx.orgId ?? 'default';
    try {
        await dbConnect();

        const { searchParams } = new URL(request.url);
        const confirmDelete = searchParams.get('confirm');
        const type = searchParams.get('type');
        const severity = searchParams.get('severity');
        const olderThan = searchParams.get('olderThan'); // days

        if (confirmDelete !== 'true') {
            return NextResponse.json(
                {
                    success: false,
                    error: "Confirmation required",
                    message: "Add ?confirm=true to confirm deletion"
                },
                { status: 400 }
            );
        }

        // Build filter for deletion
        const filter: any = { orgId };
        if (type && ['System', 'Customer'].includes(type)) {
            filter.type = type;
        }
        if (severity && ['low', 'medium', 'high', 'critical'].includes(severity.toLowerCase())) {
            filter.severity = severity.toLowerCase();
        }
        if (olderThan) {
            const days = parseInt(olderThan);
            if (!isNaN(days) && days > 0) {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - days);
                filter.timestamp = { $lt: cutoffDate };
            }
        }

        const result = await ErrorModel.deleteMany(filter);

        return NextResponse.json(
            {
                success: true,
                message: `Successfully deleted ${result.deletedCount} error(s)`,
                deletedCount: result.deletedCount
            }
        );

    } catch (error: unknown) {
        console.error("Error deleting errors:", error);

        const errorMessage = error instanceof Error
            ? error.message
            : typeof error === "string"
                ? error
                : "Unknown error";

        return NextResponse.json(
            {
                success: false,
                error: "Failed to delete errors",
                message: errorMessage
            },
            { status: 500 }
        );
    }
}