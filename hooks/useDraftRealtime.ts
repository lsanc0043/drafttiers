export function useDraftRealtime() {
  return {
    connected: false,
    events: [] as Array<{ type: string; payload: unknown }>,
  };
}
