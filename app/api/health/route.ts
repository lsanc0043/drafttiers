export async function GET() {
  return Response.json({
    ok: true,
    service: "drafttier",
    timestamp: new Date().toISOString(),
  });
}
