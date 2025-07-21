import { NextResponse } from "next/server";
import { Error } from "@/models/Error";

export async function GET(){
    try {
        const errors = await Error.find({});
        return NextResponse.json(errors);
    } catch (error) {
        console.log(error);
        return NextResponse.error();
    }
}