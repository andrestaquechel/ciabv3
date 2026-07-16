import type { TopicCandidate } from "@/lib/mini-box-topic-prompts";

export type UrlCheckResult = {
  url: string;
  ok: boolean;
  status?: number;
};

const CHECK_TIMEOUT_MS = 4500;

export async function checkSourceUrl(url: string): Promise<UrlCheckResult> {
  const trimmed = url?.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
    return { url: trimmed || "", ok: false };
  }

  try {
    const res = await fetch(trimmed, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CIAB-BoxStudio/1.0; +https://ciabv2-gilt.vercel.app)",
        Accept: "text/html,application/pdf,*/*",
      },
    });
    // 401/403 often means page exists but blocks bots — treat as ok
    const ok = res.ok || res.status === 401 || res.status === 403;
    return { url: trimmed, ok, status: res.status };
  } catch {
    return { url: trimmed, ok: false };
  }
}

export async function validateTopicCandidateUrls(
  candidate: TopicCandidate,
): Promise<{ candidate: TopicCandidate; broken: string[] }> {
  const broken: string[] = [];
  const primary = await checkSourceUrl(candidate.sourceLink);
  if (!primary.ok) broken.push(primary.url);

  if (candidate.secondarySourceLink) {
    const secondary = await checkSourceUrl(candidate.secondarySourceLink);
    if (!secondary.ok) broken.push(secondary.url);
  }

  return { candidate, broken };
}

export async function validateAllTopicCandidates(candidates: TopicCandidate[]) {
  const results = await Promise.all(candidates.map(validateTopicCandidateUrls));
  const brokenById = new Map<string, string[]>();
  for (const { candidate, broken } of results) {
    if (broken.length) brokenById.set(candidate.id, broken);
  }
  return brokenById;
}
