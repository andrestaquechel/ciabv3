/** Living Security Slack IDs — override anytime in Settings → Slack review. */

/**
 * Production reviewer IDs. Preserved here so a testing override can be reverted
 * in one step — set DEFAULT_SLACK_REVIEW = PRODUCTION_SLACK_REVIEW to restore.
 */
export const PRODUCTION_SLACK_REVIEW = {
  csmUserIds: [
    "U02241C9R3M", // Amber Quinn — Sr Customer Success Manager
    "U027KFM8M17", // Elise Peterson — CSM
    "U02SHM1TPC4", // Nick Marchiselli — Sr. Customer Success Manager
  ],
  morganUserId: "U01TA0XB3U2", // Morgan Obregon
} as const;

/**
 * TEMPORARY testing override — routes every review ping to Andres so the real
 * CSMs and Morgan are not spammed during testing. To return to production,
 * replace the value below with PRODUCTION_SLACK_REVIEW (or its literal values).
 */
export const DEFAULT_SLACK_REVIEW = {
  csmUserIds: ["U0B5J2YCRBP"], // Andres Taquechel (testing)
  morganUserId: "U0B5J2YCRBP", // Andres Taquechel (testing)
} as const;

export type SlackReviewSettings = {
  csmUserIds: string[];
  morganUserId: string;
};

/** Drive overrides win when set; otherwise built-in defaults apply. */
export function resolveSlackReview(
  overrides?: Partial<SlackReviewSettings>,
): SlackReviewSettings {
  const csmOverride = overrides?.csmUserIds?.map((id) => id.trim()).filter(Boolean);
  const morganOverride = overrides?.morganUserId?.trim();

  return {
    csmUserIds:
      csmOverride && csmOverride.length > 0
        ? csmOverride
        : [...DEFAULT_SLACK_REVIEW.csmUserIds],
    morganUserId: morganOverride || DEFAULT_SLACK_REVIEW.morganUserId,
  };
}
