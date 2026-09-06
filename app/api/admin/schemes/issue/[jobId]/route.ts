import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { SchemeIssueJob } from '@/models/SchemeIssueJob';

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  await dbConnect();
  const job = await SchemeIssueJob.findById(jobId).lean();
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ job: { ...job, _id: String((job as any)._id) } });
}
