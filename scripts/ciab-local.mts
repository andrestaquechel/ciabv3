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
 *   npx tsx scripts/ciab-local.mts deck     "<topic>" ["<monthLabel>"] [conceptIndex]
 *
 * "deck" runs the ENTIRE pipeline the Slack /newbox ciab flow drives (concept ->
 * select -> sources -> outline -> approve -> full content -> GIFs -> deck build)
 * as direct function calls — no Slack UI, no button clicks. It auto-picks the
 * "recommended" concept when conceptIndex is omitted, and writes the built
 * .pptx to ./tmp/ciab-decks/ for local inspection (e.g. render + review).
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
// Explicit numeric arg picks a concept by 1-based index; omitted = auto-pick
// the model's "recommended" concept (falls back to the first one).
const explicitConceptIndex = args.find((a, i) => i > 1 && /^\d+$/.test(a));

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

/* ---- rebuild: re-run only the deck build from cached content (no API) --- */
if (command === "rebuild") {
  const jsonPath = args[1];
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    console.error("usage: rebuild <path-to-cached-content.json>");
    process.exit(1);
  }
  const saved = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const { buildCiabDeckFromTemplate } = await import("../src/lib/pptx/ciab-template-export.ts");
  const { verifyCiabDeck, formatVerifyReport } = await import("../src/lib/pptx/ciab-verify.ts");
  const pptxBuffer = await timed("rebuild .pptx from cached content", () =>
    buildCiabDeckFromTemplate(saved.content, saved.gifs, saved.sources),
  );
  const outDir = "tmp/ciab-decks";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = `${outDir}/rebuild-${Date.now()}.pptx`;
  fs.writeFileSync(outPath, pptxBuffer);
  console.log(`${stamp()} wrote deck: ${outPath} (${(pptxBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
  const report = await verifyCiabDeck(Buffer.from(pptxBuffer));
  console.log(`\n${formatVerifyReport(report)}`);
  process.exit(0);
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

const concept = explicitConceptIndex
  ? conceptRes.concepts[Math.min(Number(explicitConceptIndex), conceptRes.concepts.length) - 1]
  : conceptRes.concepts.find((c) => c.recommended) || conceptRes.concepts[0];
console.log(
  `\n${stamp()} selected concept: ${concept.title}` +
    (explicitConceptIndex ? ` (explicit #${explicitConceptIndex})` : " (auto: recommended)"),
);

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

if (command === "full") {
  console.log(`\n${stamp()} DONE (stopped before deck build — use "deck" to build the .pptx).`);
  process.exit(0);
}

/* ---- deck: GIFs + build, mirroring handleCiabOutlineApproval ------------- */
const { pickCiabGifs } = await import("../src/lib/giphy-search.ts");
const { buildCiabDeckFromTemplate } = await import("../src/lib/pptx/ciab-template-export.ts");

const content = fullRes.content;
const gifs = await timed("5/6 pick GIFs (unique across all 14 slots)", () =>
  pickCiabGifs(content.topic, {
    welcome: content.welcome.body,
    blog: [
      ...content.blog.sections.map((s) => `${s.heading} ${s.body}`),
      `${content.blog.conclusion.heading} ${content.blog.conclusion.body}`,
    ],
    emails: content.emails.map((e) => `${e.subject} ${e.body}`),
    chats: content.chats.map((c) => c.message),
  }),
);
const gifIds = [
  gifs.welcome?.id,
  ...gifs.blog.map((g) => g.id),
  ...gifs.emails.map((g) => g.id),
  ...gifs.chats.map((g) => g.id),
].filter(Boolean);
console.log(`      gif slots filled: ${gifIds.length} · unique: ${new Set(gifIds).size}`);

const pptxBuffer = await timed("6/6 build .pptx from template", () =>
  buildCiabDeckFromTemplate(content, gifs, sourcesRes.sources),
);

const outDir = "tmp/ciab-decks";
fs.mkdirSync(outDir, { recursive: true });
const slug = content.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const outPath = `${outDir}/${slug}-${Date.now()}.pptx`;
fs.writeFileSync(outPath, pptxBuffer);
// Cache the generated content so the deck can be rebuilt from the SAME content
// (no API cost) while iterating on layout — `rebuild <this.json>`.
const jsonPath = outPath.replace(/\.pptx$/, ".json");
fs.writeFileSync(
  jsonPath,
  JSON.stringify({ outline: outlineRes.outline, sources: sourcesRes.sources, content, gifs }, null, 2),
);
console.log(`\n${stamp()} wrote deck: ${outPath} (${(pptxBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
console.log(`${stamp()} cached content: ${jsonPath}`);

/* ---- numeric verify (fast geometry gate; render is ground truth) -------- */
const { verifyCiabDeck, formatVerifyReport } = await import("../src/lib/pptx/ciab-verify.ts");
const report = await verifyCiabDeck(Buffer.from(pptxBuffer));
console.log(`\n${formatVerifyReport(report)}`);

console.log(`\n${stamp()} DONE — full CIAB pipeline succeeded end-to-end, deck built locally.`);
process.exit(0);
