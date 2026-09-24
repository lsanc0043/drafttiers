import { NextResponse } from "next/server";
import { addBucket, reorderBuckets } from "@/lib/boards";
import { createBucketSchema, reorderBucketsSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type BucketRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: BucketRouteContext) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = createBucketSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const bucket = await addBucket(id, parsed.data);
  if (!bucket) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  return NextResponse.json({ bucket }, { status: 201 });
}

export async function PATCH(request: Request, { params }: BucketRouteContext) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = reorderBucketsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const result = await reorderBuckets(id, parsed.data);
  if (!result.ok) {
    const status = result.reason === "board" ? 404 : 400;
    return NextResponse.json({ error: "Could not reorder tiers" }, { status });
  }
  return NextResponse.json({ success: true });
}
