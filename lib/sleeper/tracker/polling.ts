export type DraftPoller = {
  start: () => void;
  stop: () => void;
};

export function createDraftPoller(options: {
  fetchSnapshot: () => Promise<void>;
  intervalMs: () => number;
  isStopped: () => boolean;
}): DraftPoller {
  let generation = 0;

  async function loop(currentGeneration: number) {
    while (currentGeneration === generation && !options.isStopped()) {
      try {
        await options.fetchSnapshot();
      } catch {
        // Callers handle display of fetch errors; keep polling.
      }
      if (currentGeneration !== generation || options.isStopped()) {
        break;
      }
      const wait = Math.max(250, options.intervalMs());
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  return {
    start() {
      generation += 1;
      void loop(generation);
    },
    stop() {
      generation += 1;
    },
  };
}
