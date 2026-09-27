import type { InngestFunction } from "inngest";

/**
 * Every engine function, served from /api/inngest. The pipeline's functions
 * (source sync, post process, place refresh, backfill) join in Phase 2.
 */
export const functions: InngestFunction.Like[] = [];
