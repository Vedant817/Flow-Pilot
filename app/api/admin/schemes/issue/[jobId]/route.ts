import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { SchemeIssueJob } from '@/models/SchemeIssueJob';
import { AuthorizationError, requirePermission } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const authCtx = await requirePermission('admin:operate');
    const { jobId } = await params;
    await dbConnect();
    const job = await SchemeIssueJob.findOne({ _id: jobId, orgId: authCtx.orgId }).lean();
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ job: { ...job, _id: String((job as any)._id) } });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('GET issue job failed', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
