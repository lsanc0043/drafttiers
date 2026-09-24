import { NextResponse } from "next/server";
import { createBoardGroup } from "@/lib/boards";
import { createBucketGroupSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type GroupsRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: GroupsRouteContext) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = createBucketGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const result = await createBoardGroup(id, parsed.data);
  if (!result.ok) {
    const status = result.reason === "players" ? 400 : 404;
    return NextResponse.json({ error: "Could not create subcategory" }, { status });
  }
  return NextResponse.json({ group: result.group }, { status: 201 });
}
