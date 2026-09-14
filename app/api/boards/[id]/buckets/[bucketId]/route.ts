import { NextResponse } from "next/server";
import { deleteBucket, updateBucket } from "@/lib/boards";
import { updateBucketSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type BucketItemRouteContext = {
  params: Promise<{ id: string; bucketId: string }>;
};

export async function PATCH(request: Request, { params }: BucketItemRouteContext) {
  const { id, bucketId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateBucketSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const bucket = await updateBucket(id, bucketId, parsed.data);
  if (!bucket) {
    return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
  }

  return NextResponse.json({ bucket });
}

export async function DELETE(_request: Request, { params }: BucketItemRouteContext) {
  const { id, bucketId } = await params;
  const deleted = await deleteBucket(id, bucketId);
  if (!deleted) {
    return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
