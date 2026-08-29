/**
 * Feed ranking — pure functions (unit-tested in tests/scoring.test.ts).
 *
 * Philosophy: follower count must NOT dominate. Every business gets an
 * initial distribution window; engagement quality decides amplification.
 *
 *   NEW BUSINESS → upload → small test audience → measure engagement
 *   → strong performers get amplified → potential viral reach.
 */

export interface ScoreInput {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  followsGenerated: number;
  productClicks: number;
  contactClicks: number;
  views: number;
  reports: number;
  createdAtMs: number;
  nowMs: number;
  /** true when the owning business is new — grants a discovery boost */
  newBusiness: boolean;
  /** category affinity for the viewer, 0..1 (1 = viewer's top interest) */
  categoryAffinity?: number;
  /** same city as viewer's selected location */
  sameCity?: boolean;
  /**
   * Short-form (reels) mode: re-weights engagement toward viral signals
   * (shares/saves = spread + rewatch) and down-weights business-specific
   * actions. Used when ranking the Reels/short-video feed.
   */
  shortVideo?: boolean;
}

/** Engagement weights — tuned so meaningful actions outweigh cheap ones. */
const W = {
  like: 1,
  comment: 2.5,
  share: 3,
  save: 2.5,
  followGenerated: 5,
  productClick: 3,
  contactClick: 4,
} as const;

const HALF_LIFE_HOURS = 36; // freshness decay

export function computePostScore(input: ScoreInput): number {
  const ageHours = Math.max(0, (input.nowMs - input.createdAtMs) / 3_600_000);

  const shortVideo = Boolean(input.shortVideo);
  // Short-form virality rewards spread + rewatch; down-weights business-only actions.
  const shareW = shortVideo ? W.share * 2 : W.share;
  const saveW = shortVideo ? W.save * 1.5 : W.save;
  const productW = shortVideo ? W.productClick * 0.5 : W.productClick;
  const contactW = shortVideo ? W.contactClick * 0.5 : W.contactClick;

  const engagement =
    input.likes * W.like +
    input.comments * W.comment +
    input.shares * shareW +
    input.saves * saveW +
    input.followsGenerated * W.followGenerated +
    input.productClicks * productW +
    input.contactClicks * contactW;

  // Quality ratio rewards posts that convert views into actions.
  const viewRatio = input.views > 0 ? Math.min(1, engagement / input.views) : 0;
  const quality = 1 + viewRatio * (shortVideo ? 1.3 : 1);

  // Exponential recency decay with half-life.
  const decay = Math.pow(0.5, ageHours / HALF_LIFE_HOURS);

  // New-business discovery boost: strong early, fades over 30 days of posting history.
  const newBoost = input.newBusiness ? 2.25 : 1;

  const affinity = 1 + 0.35 * (input.categoryAffinity ?? 0);
  const local = input.sameCity ? 1.15 : 1;

  // Reports suppress distribution hard.
  const penalty = Math.max(0, 1 - input.reports * 0.25);

  return (engagement + 1) * quality * decay * newBoost * affinity * local * penalty;
}

/**
 * Refreshes denormalized scoreCache for posts. Called by the feed service on
 * reads so no separate scheduler is required at MVP scale.
 */
export function shouldRescore(scoreUpdatedAt: Date | null, nowMs: number): boolean {
  if (!scoreUpdatedAt) return true;
  return nowMs - scoreUpdatedAt.getTime() > 10 * 60 * 1000; // 10 minutes
}

/** Extracts hashtags from a caption. */
export function extractHashtags(caption: string): string[] {
  const tags = caption.match(/#[\p{L}\p{N}_]{1,50}/gu) ?? [];
  return [...new Set(tags.map((t) => t.slice(1).toLowerCase()))].slice(0, 20);
}
