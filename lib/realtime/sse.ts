export type DraftRealtimeEvent = {
  type: string;
  payload: unknown;
  occurredAt: string;
};

export function encodeSseMessage(event: DraftRealtimeEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };
}
