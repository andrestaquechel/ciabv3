/**
 * Local CIAB test harness — drive the real research pipeline from the terminal,
 * no Slack clicking required.
 *
 * Loads .env.local, then runs the same generate functions the Slack bot calls,
 * printing each stage with timing. Optionally posts the real Slack blocks to a
 * channel so you can preview actual rendering.
 *
 * Usage:
 *   npx tsx scripts/ciab-local.mts concepts "<topic>" ["<monthLabel>"]
 *   npx tsx scripts/ciab-local.mts flow     "<topic>" ["<monthLabel>"] [conceptIndex]
 *   npx tsx scripts/ciab-local.mts full     "<topic>" ["<monthLabel>"] [conceptIndex]
 *
 * Add --post=<SLACK_CHANNEL_ID> to any command to also post to Slack, e.g.
 *   npx tsx scripts/ciab-local.mts concepts "Phishing" --post=C0BB317M74L
 */
import fs from "node:fs";

/* ---- load .env.local into process.env ---------------------------------- */
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) {
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (v && v !== "[SENSITIVE]") process.env[m[1]] = v;
  }
}

/* ---- args -------------------------------------------------------------- */
const rawArgs = process.argv.slice(2);
const postFlag = rawArgs.find((a) => a.startsWith("--post="));
const postChannel = postFlag ? postFlag.split("=")[1] : "";
const args = rawArgs.filter((a) => !a.startsWith("--"));
const command = args[0] || "concepts";
const topic = args[1] || "Data Privacy & Access Control";
const monthLabel = args[2] && !/^\d+$/.test(args[2]) ? args[2] : topic;
const conceptIndex = Number(args.find((a, i) => i > 1 && /^\d+$/.test(a)) || "1");

/* ---- helpers ----------------------------------------------------------- */
const t0 = Date.now();
function stamp() {
  return `[+${((Date.now() - t0) / 1000).toFixed(1)}s]`;
}
async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  process.stdout.write(`${stamp()} ${label}… `);
  const out = await fn();
  console.log(`done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  return out;
}

const {
  generateCiabConceptOptions,
  generateCiabSources,
  generateCiabOutline,
  generateFullCiab,
} = await import("../src/lib/ciab-generate.ts");

async function maybePost(text: string, blocks?: unknown[]) {
  if (!postChannel) return;
  const { slackPostMessage } = await import("../src/lib/slack/api.ts");
  await slackPostMessage({ channel: postChannel, text, blocks: blocks as never });
  console.log(`${stamp()} posted to Slack channel ${postChannel}`);
}

/* ---- run --------------------------------------------------------------- */
console.log(`\nCIAB local harness — command="${command}" topic="${topic}" month="${monthLabel}"`);
if (postChannel) console.log(`Will also post to Slack channel ${postChannel}\n`);
else console.log("(print only — add --post=<channelId> to also post to Slack)\n");

const conceptRes = await timed("1/4 concept options (Opus + web search)", () =>
  generateCiabConceptOptions({ topic, monthLabel }),
);
console.log(`      source=${conceptRes.source} model=${conceptRes.model} concepts=${conceptRes.concepts.length}`);
conceptRes.concepts.forEach((c, i) =>
  console.log(`        [${i + 1}] ${c.title} — ${c.subtitle}`),
);
if (conceptRes.note) console.log(`      note: ${conceptRes.note}`);
await maybePost(`CIAB concepts for ${topic} ready (${conceptRes.concepts.length}).`);

if (command === "concepts") {
  console.log(`\n${stamp()} DONE.`);
  process.exit(0);
}

const concept = conceptRes.concepts[Math.min(conceptIndex, conceptRes.concepts.length) - 1];
console.log(`\n${stamp()} selected concept #${conceptIndex}: ${concept.title}`);

const sourcesRes = await timed("2/4 source research (web search)", () =>
  generateCiabSources({ concept }),
);
console.log(`      source=${sourcesRes.source} sources=${sourcesRes.sources.length}`);
sourcesRes.sources.forEach((s) => console.log(`        - ${s.name} (${s.publisher}, ${s.date})`));

const outlineRes = await timed("3/4 outline", () =>
  generateCiabOutline({ concept, sources: sourcesRes.sources }),
);
console.log(`      source=${outlineRes.source} title="${outlineRes.outline.title}"`);
console.log(`      tagline: ${outlineRes.outline.tagline}`);
console.log(`      sections: ${outlineRes.outline.sections.map((s) => s.title).join(" | ")}`);
await maybePost(`CIAB outline for ${outlineRes.outline.title} ready.`);

if (command === "flow") {
  console.log(`\n${stamp()} DONE (stopped before full box — use "full" to generate content).`);
  process.exit(0);
}

const fullRes = await timed("4/4 full box content", () =>
  generateFullCiab({ outline: outlineRes.outline, sources: sourcesRes.sources }),
);
console.log(`      source=${fullRes.source}`);
console.log(`      welcome: ${fullRes.content.welcome.body.slice(0, 120).replace(/\n/g, " ")}…`);
console.log(`      weeks/chats generated: emails=${fullRes.content.emails?.length ?? "?"} chats=${fullRes.content.chats?.length ?? "?"}`);

console.log(`\n${stamp()} DONE — full CIAB pipeline succeeded end-to-end.`);
process.exit(0);
