import { NextResponse } from "next/server";
import { patchBoardGroup, removeBoardGroup } from "@/lib/boards";
import { updateBucketGroupSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type GroupRouteContext = {
  params: Promise<{ id: string; groupId: string }>;
};

export async function PATCH(request: Request, { params }: GroupRouteContext) {
  const { id, groupId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateBucketGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const result = await patchBoardGroup(id, groupId, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: "Subcategory not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: GroupRouteContext) {
  const { id, groupId } = await params;
  const result = await removeBoardGroup(id, groupId);
  if (!result.ok) {
    return NextResponse.json({ error: "Subcategory not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
