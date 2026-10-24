/** Escape text for HTML text nodes / attributes. */
export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const KIND_COLOR = {
  read: "#6cb6ff",
  search: "#9cdcfe",
  edit: "#f0c674",
  write: "#c3e88d",
  bash: "#c792ea",
  test_pass: "#7fd962",
  test_fail: "#ff5370",
  agent: "#82aaff",
  web: "#89ddff",
  todo: "#ffcb6b",
  mcp: "#f78c6c",
  prompt: "#abb2bf",
  think: "#5c6370",
  compact: "#5c6370",
  done: "#7fd962",
};

function chip(kind, failed) {
  const c = KIND_COLOR[kind] || "#abb2bf";
  const fail = failed ? " fail" : "";
  return `<span class="chip${fail}" style="--c:${c}">${esc(kind)}</span>`;
}

function stepCell(side) {
  if (!side) return `<div class="step empty"><span class="ghost">—</span></div>`;
  const fail = side.failed || side.kind === "test_fail" ? " failed" : "";
  return `<div class="step${fail}">
    ${chip(side.kind, side.failed || side.kind === "test_fail")}
    <div class="lab">${esc(side.label)}</div>
    ${side.file ? `<div class="file">${esc(side.file)}</div>` : ""}
  </div>`;
}

/**
 * Build a self-contained HTML report from a compareSessions() result.
 * Offline: zero network requests, all CSS/JS inline.
 */
export function renderReport(diff, meta = {}) {
  const data = {
    ...diff,
    meta: {
      generatedAt: meta.generatedAt || new Date().toISOString(),
      sourceA: meta.sourceA || "",
      sourceB: meta.sourceB || "",
      tool: "agentdiff 0.1.1",
    },
  };
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const first = data.firstDivergence >= 0 ? data.firstDivergence : 0;
  const st = data.stats;

  const rowsHtml = data.rows
    .map((r) => {
      const cls = r.status === "diverge" ? "diverge" : "same";
      const reason = r.reason ? `<div class="why">${esc(r.reason.detail)}</div>` : "";
      return `<tr class="row ${cls}" data-i="${r.index}" id="row-${r.index}">
        <td class="idx">${r.index + 1}</td>
        <td class="side a">${stepCell(r.a)}</td>
        <td class="mid">${r.status === "diverge" ? `<span class="badge diverge">≠</span>${reason}` : `<span class="badge same">=</span>`}</td>
        <td class="side b">${stepCell(r.b)}</td>
      </tr>`;
    })
    .join("\n");

  const histA = histogram(data.rows.map((r) => r.a).filter(Boolean));
  const histB = histogram(data.rows.map((r) => r.b).filter(Boolean));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>AgentDiff — ${esc(data.labelA)} vs ${esc(data.labelB)}</title>
<style>
:root {
  --bg:#0d1117; --panel:#161b22; --border:#30363d; --text:#e6edf3; --muted:#8b949e;
  --a:#58a6ff; --b:#3fb950; --diverge:#f85149; --same:#238636; --accent:#a371f7;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin:0; padding:0; background:var(--bg); color:var(--text); font:14px/1.45 var(--sans); }
header {
  position: sticky; top:0; z-index:20; background:rgba(13,17,23,.92); backdrop-filter: blur(8px);
  border-bottom:1px solid var(--border); padding:14px 20px 12px;
}
header .top { display:flex; flex-wrap:wrap; gap:12px 20px; align-items:center; justify-content:space-between; }
h1 { margin:0; font-size:18px; font-weight:650; letter-spacing:.2px; }
h1 span { color:var(--accent); }
.meta { color:var(--muted); font-size:12px; }
.stats { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
.pill {
  background:var(--panel); border:1px solid var(--border); border-radius:999px;
  padding:4px 10px; font-size:12px; color:var(--muted);
}
.pill b { color:var(--text); font-weight:600; }
.pill.drift b { color: #ffa657; }
.pill.div b { color: var(--diverge); }
.controls { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:10px; }
button, .btn {
  background:#21262d; color:var(--text); border:1px solid var(--border); border-radius:8px;
  padding:6px 12px; font:12px/1.2 var(--sans); cursor:pointer;
}
button:hover { border-color:#8b949e; }
button.primary { background:#238636; border-color:#2ea043; }
button:disabled { opacity:.45; cursor:default; }
#scrub { flex:1; min-width:160px; accent-color:var(--accent); }
main { padding:16px 20px 48px; max-width:1280px; margin:0 auto; }
.legend { display:flex; gap:16px; color:var(--muted); font-size:12px; margin-bottom:12px; }
.legend i { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:6px; }
.legend .da { background:rgba(248,81,73,.25); border:1px solid var(--diverge); }
.legend .sa { background:rgba(35,134,54,.2); border:1px solid var(--same); }
table { width:100%; border-collapse:separate; border-spacing:0 6px; }
tr.row td { background:var(--panel); border-top:1px solid var(--border); border-bottom:1px solid var(--border); padding:10px 12px; vertical-align:top; }
tr.row td:first-child { border-left:1px solid var(--border); border-radius:10px 0 0 10px; }
tr.row td:last-child { border-right:1px solid var(--border); border-radius:0 10px 10px 0; }
tr.row.diverge td { background:rgba(248,81,73,.08); box-shadow: inset 3px 0 0 var(--diverge); }
tr.row.same td { /* quiet */ }
tr.row.active td { outline:1px solid var(--accent); outline-offset:-1px; }
td.idx { width:36px; color:var(--muted); font-family:var(--mono); font-size:11px; text-align:center; }
td.mid { width:140px; text-align:center; font-size:12px; color:var(--muted); }
td.side { width:calc((100% - 176px) / 2); }
.heads { display:grid; grid-template-columns:36px 1fr 140px 1fr; gap:0 0; margin-bottom:6px; color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.06em; padding:0 12px; }
.heads .la { color:var(--a); } .heads .lb { color:var(--b); }
.chip {
  display:inline-block; font:11px/1 var(--mono); padding:3px 7px; border-radius:6px;
  background:color-mix(in srgb, var(--c) 18%, transparent); color:var(--c); border:1px solid color-mix(in srgb, var(--c) 40%, transparent);
  margin-bottom:4px;
}
.chip.fail { color:#ff5370; border-color:#ff5370; background:rgba(255,83,112,.12); }
.lab { font-family:var(--mono); font-size:12.5px; word-break:break-word; }
.file { margin-top:3px; font-size:11px; color:var(--muted); font-family:var(--mono); }
.step.empty { opacity:.35; }
.badge { display:inline-block; min-width:22px; padding:2px 6px; border-radius:6px; font-weight:700; }
.badge.diverge { background:rgba(248,81,73,.2); color:var(--diverge); }
.badge.same { background:rgba(35,134,54,.2); color:#3fb950; }
.why { margin-top:4px; font-size:11px; color:#ffa657; }
.cols { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:16px 0 8px; }
.card { background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:12px 14px; }
.card h3 { margin:0 0 8px; font-size:13px; color:var(--muted); font-weight:600; }
.bar { display:flex; align-items:center; gap:8px; margin:4px 0; font-size:12px; font-family:var(--mono); }
.bar .n { width:72px; color:var(--muted); }
.bar .t { flex:1; height:8px; background:#21262d; border-radius:4px; overflow:hidden; }
.bar .t i { display:block; height:100%; background:var(--accent); }
.files { font-size:12px; font-family:var(--mono); color:var(--muted); }
.files b { color:var(--text); }
footer { margin-top:28px; color:var(--muted); font-size:11px; text-align:center; }
@media (max-width:800px) {
  .cols { grid-template-columns:1fr; }
  td.mid { width:72px; }
  .heads { display:none; }
}
</style>
</head>
<body>
<header>
  <div class="top">
    <div>
      <h1><span>AgentDiff</span> — side-by-side agent replay</h1>
      <div class="meta">${esc(data.meta.sourceA || data.labelA)} &nbsp;vs&nbsp; ${esc(data.meta.sourceB || data.labelB)}</div>
    </div>
    <div class="meta">${esc(data.agentA)} · ${esc(data.agentB)} · ${esc(data.meta.tool)}</div>
  </div>
  <div class="stats">
    <div class="pill drift">drift <b>${data.drift}</b>/100</div>
    <div class="pill div">divergences <b>${st.diverge}</b></div>
    <div class="pill">aligned <b>${st.same}</b>/${st.aligned}</div>
    <div class="pill">steps <b>${st.stepsA}</b> / <b>${st.stepsB}</b></div>
    <div class="pill">errors <b>${st.errorsA}</b> / <b>${st.errorsB}</b></div>
    <div class="pill">first ≠ <b>#${data.firstDivergence >= 0 ? data.firstDivergence + 1 : "—"}</b></div>
  </div>
  <div class="controls">
    <button class="primary" id="btnFirst" type="button">Jump to first divergence</button>
    <button id="btnPrev" type="button">Prev ≠</button>
    <button id="btnNext" type="button">Next ≠</button>
    <span class="meta">keys: j/k ≠ · ←/→ step · f first</span>
    <label class="meta" for="scrub">scrub</label>
    <input id="scrub" type="range" min="0" max="${Math.max(0, data.rows.length - 1)}" value="${first}" />
    <span class="meta" id="scrubLabel">#${first + 1}</span>
  </div>
</header>
<main>
  <div class="cols">
    <div class="card">
      <h3>Tool mix — A</h3>
      ${histBars(histA)}
      <div class="files" style="margin-top:10px">
        <div><b>Only A</b>: ${st.filesOnlyA.length ? esc(st.filesOnlyA.join(", ")) : "—"}</div>
        <div><b>Shared</b>: ${st.filesShared.length ? esc(st.filesShared.join(", ")) : "—"}</div>
      </div>
    </div>
    <div class="card">
      <h3>Tool mix — B</h3>
      ${histBars(histB)}
      <div class="files" style="margin-top:10px">
        <div><b>Only B</b>: ${st.filesOnlyB.length ? esc(st.filesOnlyB.join(", ")) : "—"}</div>
        <div><b>Titles</b>: ${esc(data.titleA)} · ${esc(data.titleB)}</div>
      </div>
    </div>
  </div>
  <div class="legend"><span><i class="da"></i>divergence</span><span><i class="sa"></i>aligned</span></div>
  <div class="heads"><div>#</div><div class="la">A — ${esc(data.labelA)}</div><div></div><div class="lb">B — ${esc(data.labelB)}</div></div>
  <table><tbody>
${rowsHtml}
  </tbody></table>
  <footer>Generated offline by AgentDiff. Nothing uploaded. ${esc(data.meta.generatedAt)}</footer>
</main>
<script id="data" type="application/json">${json}</script>
<script>
(function () {
  const data = JSON.parse(document.getElementById("data").textContent);
  const rows = [...document.querySelectorAll("tr.row")];
  const diverges = rows.filter(r => r.classList.contains("diverge"));
  const scrub = document.getElementById("scrub");
  const label = document.getElementById("scrubLabel");
  let cur = data.firstDivergence >= 0 ? data.firstDivergence : 0;

  function activate(i) {
    cur = Math.max(0, Math.min(rows.length - 1, i));
    rows.forEach(r => r.classList.remove("active"));
    const el = document.getElementById("row-" + cur);
    if (el) {
      el.classList.add("active");
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    scrub.value = String(cur);
    label.textContent = "#" + (cur + 1);
  }

  function jumpDiv(dir) {
    if (!diverges.length) return;
    const idxs = diverges.map(r => +r.dataset.i);
    let next;
    if (dir > 0) next = idxs.find(i => i > cur);
    else {
      for (let k = idxs.length - 1; k >= 0; k--) if (idxs[k] < cur) { next = idxs[k]; break; }
    }
    if (next === undefined) next = dir > 0 ? idxs[0] : idxs[idxs.length - 1];
    activate(next);
  }

  document.getElementById("btnFirst").onclick = () => activate(data.firstDivergence >= 0 ? data.firstDivergence : 0);
  document.getElementById("btnPrev").onclick = () => jumpDiv(-1);
  document.getElementById("btnNext").onclick = () => jumpDiv(1);
  scrub.oninput = () => activate(+scrub.value);
  rows.forEach(r => r.addEventListener("click", () => activate(+r.dataset.i)));
  document.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowDown" || e.key === "j" || e.key === "J") { e.preventDefault(); jumpDiv(1); }
    else if (e.key === "ArrowUp" || e.key === "k" || e.key === "K") { e.preventDefault(); jumpDiv(-1); }
    else if (e.key === "f" || e.key === "F" || e.key === "Enter") { e.preventDefault(); activate(data.firstDivergence >= 0 ? data.firstDivergence : 0); }
    else if (e.key === "ArrowRight" || e.key === "l" || e.key === "L") { e.preventDefault(); activate(cur + 1); }
    else if (e.key === "ArrowLeft" || e.key === "h" || e.key === "H") { e.preventDefault(); activate(cur - 1); }
  });
  activate(cur);
})();
</script>
</body>
</html>`;
}

function histogram(sides) {
  const m = new Map();
  for (const s of sides) m.set(s.kind, (m.get(s.kind) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function histBars(entries) {
  if (!entries.length) return `<div class="meta">no steps</div>`;
  const max = entries[0][1] || 1;
  return entries
    .map(
      ([k, n]) =>
        `<div class="bar"><span class="n">${esc(k)}</span><span class="t"><i style="width:${Math.round((n / max) * 100)}%;background:${KIND_COLOR[k] || "#a371f7"}"></i></span><span>${n}</span></div>`,
    )
    .join("");
}
