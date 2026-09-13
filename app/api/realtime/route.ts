import { encodeSseMessage, sseHeaders } from "@/lib/realtime/sse";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          encodeSseMessage({
            type: "connected",
            payload: { channel: "draft-updates" },
            occurredAt: new Date().toISOString(),
          }),
        ),
      );
      controller.close();
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
