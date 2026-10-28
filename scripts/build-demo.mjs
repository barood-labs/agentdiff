#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSession } from "../src/load.mjs";
import { compareSessions } from "../src/align.mjs";
import { renderReport } from "../src/report.mjs";
import { explainDiff } from "../src/explain.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pairs = [
  {
    name: "login-bug",
    blurb: "Same prompt — one agent patches the redirect, the other deletes the failing test.",
  },
  {
    name: "flaky-test",
    blurb: "Both chase a flake; only one actually waits for the race to settle.",
  },
  {
    name: "wrong-file",
    blurb: "B edits the wrong module while A finds the real call site.",
  },
];
mkdirSync(join(ROOT, "docs"), { recursive: true });

const cards = [];
for (const { name, blurb } of pairs) {
  const a = loadSession(join(ROOT, "examples", name, "a.jsonl"));
  const b = loadSession(join(ROOT, "examples", name, "b.jsonl"));
  const diff = compareSessions(a.session, b.session, { labelA: `${name}/a`, labelB: `${name}/b` });
  const html = renderReport(diff, { sourceA: a.path, sourceB: b.path });
  const out = join(ROOT, "docs", `${name}.html`);
  writeFileSync(out, html);
  const story = explainDiff(diff);
  cards.push({
    name,
    blurb,
    drift: diff.drift,
    diverge: diff.stats.diverge,
    first: diff.firstDivergence,
    headline: story.headline,
  });
  console.log("wrote", out, `drift=${diff.drift}`);
}

const cardHtml = cards
  .map(
    (c) => `<a class="card" href="./${c.name}.html">
  <div class="card-top"><b>${c.name}</b><span class="drift">drift ${c.drift}/100</span></div>
  <p>${c.blurb}</p>
  <div class="meta">${c.diverge} divergences · first ≠ #${c.first >= 0 ? c.first + 1 : "—"}</div>
  <div class="hook">${escapeHtml(c.headline)}</div>
</a>`,
  )
  .join("\n");

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const index = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>AgentDiff — two agent sessions, one failure diff</title>
<meta name="description" content="Side-by-side AI coding-agent session diff. Offline HTML report. Claude Code + Codex."/>
<meta property="og:title" content="AgentDiff gallery"/>
<meta property="og:description" content="Where did the bad agent go off the rails?"/>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='%230d1117'/><text x='50%25' y='54%25' text-anchor='middle' font-size='36' fill='%23a371f7'>≠</text></svg>"/>
<style>
:root{--bg:#0d1117;--panel:#161b22;--border:#30363d;--text:#e6edf3;--muted:#8b949e;--a:#58a6ff;--accent:#a371f7;--drift:#ffa657}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.hero{padding:48px 20px 28px;border-bottom:1px solid var(--border);background:radial-gradient(ellipse at top,rgba(163,113,247,.18),transparent 55%)}
.hero-inner{max-width:880px;margin:0 auto}
h1{margin:0 0 8px;font-size:clamp(28px,4vw,40px);letter-spacing:-.02em}
h1 span{color:var(--accent)}
.tagline{color:var(--muted);font-size:17px;max-width:40rem;margin:0 0 18px}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
.badge{display:inline-block;padding:4px 10px;border-radius:999px;border:1px solid var(--border);background:var(--panel);font-size:12px;color:var(--muted)}
.badge a{color:var(--a);text-decoration:none}
.cta{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.cta code{background:#21262d;border:1px solid var(--border);border-radius:8px;padding:8px 12px;font:13px/1.3 ui-monospace,Menlo,Consolas,monospace}
.cta a.btn{background:#238636;border:1px solid #2ea043;color:#fff;text-decoration:none;border-radius:8px;padding:8px 14px;font-size:14px;font-weight:600}
main{max-width:880px;margin:0 auto;padding:28px 20px 56px}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:0 0 12px}
.card{display:block;border:1px solid var(--border);border-radius:14px;padding:16px 18px;margin:0 0 12px;background:var(--panel);text-decoration:none;color:inherit;transition:border-color .15s,transform .15s}
.card:hover{border-color:var(--a);transform:translateY(-1px)}
.card-top{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.card b{font-size:16px}
.drift{color:var(--drift);font:12px/1 ui-monospace,Menlo,Consolas,monospace}
.card p{margin:8px 0;color:var(--muted);font-size:14px}
.meta{color:var(--muted);font-size:12px}
.hook{margin-top:8px;font:12.5px/1.4 ui-monospace,Menlo,Consolas,monospace;color:#ffa657}
.family{margin-top:28px;padding-top:20px;border-top:1px solid var(--border);color:var(--muted);font-size:13px}
.family a{color:var(--a);text-decoration:none}
footer{margin-top:32px;color:var(--muted);font-size:12px}
</style>
</head>
<body>
<header class="hero"><div class="hero-inner">
  <h1><span>AgentDiff</span></h1>
  <p class="tagline">Two AI coding-agent sessions. One side-by-side failure diff. Jump to the first place they diverge — offline, no upload.</p>
  <div class="badges">
    <span class="badge"><a href="https://www.npmjs.com/package/@barood-labs/agentdiff">npm @barood-labs/agentdiff</a></span>
    <span class="badge">Claude Code + Codex</span>
    <span class="badge">zero cloud deps</span>
    <span class="badge"><a href="https://github.com/barood-labs/agentdiff">GitHub</a></span>
  </div>
  <div class="cta">
    <code>npx @barood-labs/agentdiff demo --open</code>
    <a class="btn" href="./login-bug.html">Open a sample report →</a>
  </div>
</div></header>
<main>
  <h2>Fixture gallery</h2>
  ${cardHtml}
  <div class="family">
    Same family:
    <a href="https://github.com/barood-labs/agenttown">AgentTown</a> (replay one session as a city) ·
    <a href="https://github.com/barood-labs/whydiff">WhyDiff</a> (risk-score one AI-written diff) ·
    <a href="https://github.com/barood-labs/agentfuse">AgentFuse</a> (hard spend cap for agents)
  </div>
  <footer>MIT © barood-labs · reports are generated offline by <code>npm run build</code></footer>
</main>
</body>
</html>`;

writeFileSync(join(ROOT, "docs", "index.html"), index);
writeFileSync(join(ROOT, "docs", ".nojekyll"), "");
console.log("gallery ready");
