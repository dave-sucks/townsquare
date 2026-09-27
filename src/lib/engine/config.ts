/**
 * Every threshold and limit the engine uses. Starting values from the spec,
 * to be tuned with evals.
 */

export const ENGINE = {
  sync: {
    /** Posts per incremental sync. */
    resultsLimit: 50,
    /** Posts on a source's first sync. */
    firstSyncLimit: 100,
    /** Incremental syncs re-read this far before the newest stored post. */
    overlapDays: 2,
    pollEverySeconds: 20,
    maxPollMinutes: 20,
    /** 06:00 New York time, every day. */
    dailyCron: "TZ=America/New_York 0 6 * * *",
  },
  read: {
    /** Other people's comments given to Read, besides the creator's own replies. */
    topComments: 5,
    examples: 3,
  },
  resolve: {
    candidates: 5,
    /** A location tag is the venue itself when its name is this similar. */
    locationTagMatch: 0.8,
    weights: { name: 0.6, foodType: 0.15, distance: 0.15, businessStatus: 0.1 },
    /** Distance score: 1.0 within nearKm, 0 at farKm, linear between. */
    nearKm: 2,
    farKm: 25,
    autoAccept: { minScore: 0.82, minLead: 0.1, minNameSimilarity: 0.75 },
    /** Search radius around the bias point. */
    biasRadiusMeters: 30_000,
    /** Leave the home city out of the query when the area hint is farther than this. */
    homeCityMaxKm: 50,
    /** Reuse a Google search this long (re-runs and shared areas cost nothing). */
    searchCacheDays: 7,
  },
  tag: {
    keep: ["high", "medium"] as const,
    examples: 3,
  },
  aggregate: {
    confidence: { high: 0.9, medium: 0.6, low: 0.3 },
    recencyHalfLifeDays: 365,
    /**
     * Show a tag at this confidence, or when this many mentions support it.
     * (The spec starts at 0.7, but with the 365-day decay one high-confidence
     * mention from 7 months ago scores 0.59, and most places have a single
     * mention, so 0.7 left most places with no tags.)
     */
    showAt: 0.3,
    showWithMentions: 2,
    knownFor: 3,
    searchExcerpts: 20,
  },
  summarize: {
    mentions: 12,
    knownFor: 3,
  },
  runtime: {
    /** Posts processed at once, across the whole app. */
    postConcurrency: 4,
    /** Aggregate + Summarize wait this long after a place's last change. */
    placeDebounce: process.env.NODE_ENV === "development" ? "20s" : "2m",
    retries: 3,
  },
} as const;

/** Model confidence buckets as numbers (models never report numbers). */
export const CONFIDENCE_VALUE = ENGINE.aggregate.confidence;
export type ConfidenceBucket = keyof typeof CONFIDENCE_VALUE;
