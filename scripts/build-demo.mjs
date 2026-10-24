#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSession } from "../src/load.mjs";
import { compareSessions } from "../src/align.mjs";
import { renderReport } from "../src/report.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pairs = ["login-bug", "flaky-test", "wrong-file"];
mkdirSync(join(ROOT, "docs"), { recursive: true });

const cards = [];
for (const name of pairs) {
  const a = loadSession(join(ROOT, "examples", name, "a.jsonl"));
  const b = loadSession(join(ROOT, "examples", name, "b.jsonl"));
  const diff = compareSessions(a.session, b.session, { labelA: `${name}/a`, labelB: `${name}/b` });
  const html = renderReport(diff, { sourceA: a.path, sourceB: b.path });
  const out = join(ROOT, "docs", `${name}.html`);
  writeFileSync(out, html);
  cards.push({ name, drift: diff.drift, diverge: diff.stats.diverge, first: diff.firstDivergence });
  console.log("wrote", out, `drift=${diff.drift}`);
}

const index = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>AgentDiff gallery</title>
<style>
body{margin:0;background:#0d1117;color:#e6edf3;font:16px/1.5 system-ui,sans-serif}
main{max-width:800px;margin:40px auto;padding:0 20px}
a{color:#58a6ff;text-decoration:none}
.card{display:block;border:1px solid #30363d;border-radius:12px;padding:16px 18px;margin:12px 0;background:#161b22}
.card:hover{border-color:#58a6ff}
.meta{color:#8b949e;font-size:13px}
h1 span{color:#a371f7}
</style></head><body><main>
<h1><span>AgentDiff</span> gallery</h1>
<p class="meta">Offline fixture pairs. Open any report — no network required.</p>
${cards
  .map(
    (c) =>
      `<a class="card" href="./${c.name}.html"><b>${c.name}</b><div class="meta">drift ${c.drift}/100 · ${c.diverge} divergences · first ≠ #${c.first >= 0 ? c.first + 1 : "—"}</div></a>`,
  )
  .join("\n")}
<p class="meta">npx @barood-labs/agentdiff compare a.jsonl b.jsonl</p>
</main></body></html>`;
writeFileSync(join(ROOT, "docs", "index.html"), index);
writeFileSync(join(ROOT, "docs", ".nojekyll"), "");
console.log("gallery ready");
