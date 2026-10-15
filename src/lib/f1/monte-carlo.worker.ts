import {
  runMonteCarlo,
  DriverStandingInput,
  RemainingRaceEvent,
} from "./simulate";

self.onmessage = (
  e: MessageEvent<{
    standings: DriverStandingInput[];
    remainingRaces: RemainingRaceEvent[];
    simulations?: number;
    seed?: number;
  }>
) => {
  const { standings, remainingRaces, simulations = 10000, seed = Date.now() } =
    e.data;

  try {
    const result = runMonteCarlo(standings, remainingRaces, {
      simulations,
      seed,
      onProgress: (progressPct) => {
        self.postMessage({ type: "PROGRESS", progress: progressPct });
      },
    });

    self.postMessage({ type: "DONE", result });
  } catch (err: any) {
    self.postMessage({ type: "ERROR", error: err?.message || String(err) });
  }
};

