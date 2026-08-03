import type { EstimatedWait, QueueEntry } from "../types";

/**
 * Simple estimated wait: avgServiceMinutes × parties ahead.
 * Only counts parties still waiting (not called).
 */
export function estimateWait(
  entry: Pick<QueueEntry, "position" | "status">,
  avgServiceMinutes: number,
  waitingAhead: number,
): EstimatedWait | null {
  if (entry.status !== "waiting" && entry.status !== "called") {
    return null;
  }
  if (entry.status === "called") {
    return { minutes: 0, partiesAhead: 0, peopleAhead: 0 };
  }
  const partiesAhead = Math.max(0, waitingAhead);
  return {
    minutes: partiesAhead * avgServiceMinutes,
    partiesAhead,
    peopleAhead: partiesAhead, // refined by caller with party sizes if needed
  };
}

/**
 * Build wait estimates for an ordered list of waiting entries.
 * `peopleAhead` uses cumulative party sizes of those ahead.
 */
export function attachWaitEstimates<
  T extends Pick<QueueEntry, "id" | "status" | "partySize" | "position">,
>(
  entries: T[],
  avgServiceMinutes: number,
): Array<T & { estimatedWait: EstimatedWait | null }> {
  let partiesAhead = 0;
  let peopleAhead = 0;

  return entries.map((entry) => {
    if (entry.status === "called") {
      return {
        ...entry,
        estimatedWait: { minutes: 0, partiesAhead: 0, peopleAhead: 0 },
      };
    }
    if (entry.status !== "waiting") {
      return { ...entry, estimatedWait: null };
    }
    const estimatedWait: EstimatedWait = {
      minutes: partiesAhead * avgServiceMinutes,
      partiesAhead,
      peopleAhead,
    };
    partiesAhead += 1;
    peopleAhead += entry.partySize;
    return { ...entry, estimatedWait };
  });
}
