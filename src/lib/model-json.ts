/**
 * Pure helpers for turning model text into JSON. Kept dependency-free (no Next,
 * no Drive, no network) so they can be unit-tested in isolation and reused
 * anywhere a model returns JSON that may be fenced, prose-wrapped, or truncated.
 */

/** Best-effort repair of JSON a model left truncated (hit max_tokens) or lightly
 *  malformed: close an unterminated string, drop a trailing comma or an
 *  incomplete `"key":` with no value, and balance any still-open braces and
 *  brackets. Returns already-valid input effectively unchanged. */
export function repairJsonText(input: string): string {
  let s = input;
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") stack.pop();
  }
  // Close a value string that truncation cut off mid-token.
  if (inString) s += '"';
  // Trim trailing junk left by truncation: a dangling comma, or a `"key":` whose
  // value never arrived. Repeat until stable so `..."x", "key":` fully unwinds.
  let prev: string;
  do {
    prev = s;
    s = s.replace(/[\s,]+$/, "");
    s = s.replace(/"(?:[^"\\]|\\.)*"\s*:\s*$/, "");
  } while (s !== prev);
  // Trailing commas before a close are invalid JSON — drop them.
  s = s.replace(/,(\s*[}\]])/g, "$1");
  // Balance whatever is still open, innermost first.
  while (stack.length) s += stack.pop();
  return s;
}

export function parseJsonFromModelText<T>(text: string): T {
  const trimmed = text.trim();
  const fenced =
    trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? trimmed;

  // Try, in order: the fenced/whole text, the outermost balanced region, and
  // the region from the first bracket to the end (for truncated responses).
  // Each candidate is attempted as-is and then with a repair pass.
  const candidates = [fenced];
  const start = fenced.search(/[[{]/);
  const end = Math.max(fenced.lastIndexOf("}"), fenced.lastIndexOf("]"));
  if (start >= 0 && end > start) candidates.push(fenced.slice(start, end + 1));
  if (start >= 0) candidates.push(fenced.slice(start));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      try {
        return JSON.parse(repairJsonText(candidate)) as T;
      } catch {
        // try the next candidate
      }
    }
  }
  throw new Error("Model response was not valid JSON.");
}
