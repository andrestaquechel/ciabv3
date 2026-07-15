/** Living Security Slack IDs — override anytime in Settings → Slack review. */
export const DEFAULT_SLACK_REVIEW = {
  csmUserIds: [
    "U02241C9R3M", // Amber Quinn — Sr Customer Success Manager
    "U027KFM8M17", // Elise Peterson — CSM
    "U02SHM1TPC4", // Nick Marchiselli — Sr. Customer Success Manager
  ],
  morganUserId: "U01TA0XB3U2", // Morgan Obregon
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
