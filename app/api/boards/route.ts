import { NextResponse } from "next/server";
import { createBoardSchema } from "@/lib/validation";

export async function GET() {
  return NextResponse.json({ boards: [] });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createBoardSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json(
    { message: "Board persistence is not implemented yet", input: parsed.data },
    { status: 501 },
  );
}
