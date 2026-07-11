// A SIMULATED community rating for the demo. It is deterministically derived from
// a resource id (so it's stable and needs no fields on the data model) and must
// ALWAYS be shown with a "simulated / demo" label — it is not real feedback. The
// veteran's own vote is a separate fact and is never blended into this number.

export interface SimulatedRating {
  /** Average stars, 3.8–4.8. */
  average: number;
  /** Number of (pretend) ratings, 50–300. */
  count: number;
}

/** Stable pseudo-random hash of an id. */
function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** A stable, clearly-simulated rating for a resource id. */
export function simulatedRating(resourceId: string): SimulatedRating {
  const hash = hashId(resourceId);
  return {
    average: Math.round((3.8 + (hash % 11) / 10) * 10) / 10,
    count: 50 + (hash % 251),
  };
}
