/**
 * Turn a compareSessions() result into a short plain-English story of the fork.
 * Used by the HTML report banner, --md export, and the CLI summary.
 */

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * @param {ReturnType<import("./align.mjs").compareSessions>} diff
 * @returns {{ headline: string, paragraphs: string[], bullets: string[], shareText: string }}
 */
export function explainDiff(diff) {
  const st = diff.stats;
  const reasons = diff.reasons || [];
  const first = diff.firstDivergence >= 0 ? reasons.find((r) => r.index === diff.firstDivergence) || reasons[0] : null;

  let headline;
  if (st.diverge === 0) {
    headline = `${diff.labelA} and ${diff.labelB} stayed aligned (drift ${diff.drift}/100).`;
  } else if (first) {
    headline = `They fork at step #${first.index + 1}: ${first.detail}.`;
  } else {
    headline = `${plural(st.diverge, "divergence", "divergences")} · drift ${diff.drift}/100.`;
  }

  const paragraphs = [];
  paragraphs.push(
    `Compared ${st.stepsA} actionable steps on A (${diff.agentA}) with ${st.stepsB} on B (${diff.agentB}). ` +
      `${st.same} aligned, ${st.diverge} diverged.`,
  );

  if (st.filesOnlyA.length || st.filesOnlyB.length) {
    const bits = [];
    if (st.filesOnlyA.length) bits.push(`only A touched ${st.filesOnlyA.slice(0, 4).join(", ")}${st.filesOnlyA.length > 4 ? "…" : ""}`);
    if (st.filesOnlyB.length) bits.push(`only B touched ${st.filesOnlyB.slice(0, 4).join(", ")}${st.filesOnlyB.length > 4 ? "…" : ""}`);
    paragraphs.push(`File asymmetry: ${bits.join("; ")}.`);
  }

  if (st.errorsA !== st.errorsB) {
    paragraphs.push(
      `Error/test-fail count differs: A ${st.errorsA}, B ${st.errorsB}.`,
    );
  }

  const codeCount = new Map();
  for (const r of reasons) codeCount.set(r.code, (codeCount.get(r.code) || 0) + 1);
  const bullets = [...codeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([code, n]) => `${humanCode(code)} ×${n}`);

  for (const r of reasons.slice(0, 5)) {
    if (!bullets.some((b) => b.includes(r.detail))) {
      /* keep code tallies; detail lives in shareText */
    }
  }

  const detailBullets = reasons.slice(0, 5).map((r) => `#${r.index + 1} — ${r.detail}`);

  const shareText = [
    `AgentDiff · ${diff.labelA} vs ${diff.labelB}`,
    `drift ${diff.drift}/100 · ${st.diverge} divergences · first ≠ ${diff.firstDivergence >= 0 ? "#" + (diff.firstDivergence + 1) : "—"}`,
    headline,
    ...detailBullets.map((b) => `• ${b}`),
  ].join("\n");

  return { headline, paragraphs, bullets: detailBullets, shareText };
}

function humanCode(code) {
  switch (code) {
    case "only_a":
      return "Only on A";
    case "only_b":
      return "Only on B";
    case "kind":
      return "Different tool kinds";
    case "file":
      return "Different files";
    case "command":
      return "Different commands";
    case "error":
      return "Error asymmetry";
    case "test":
      return "Test outcome";
    case "label":
      return "Label mismatch";
    case "outcome":
      return "Outcome mismatch";
    default:
      return code;
  }
}

/**
 * Markdown report suitable for Discord, PR comments, or X drafts.
 * @param {ReturnType<import("./align.mjs").compareSessions>} diff
 * @param {{ sourceA?: string, sourceB?: string }} [meta]
 */
export function renderMarkdown(diff, meta = {}) {
  const ex = explainDiff(diff);
  const st = diff.stats;
  const lines = [];
  lines.push(`# AgentDiff — ${diff.labelA} vs ${diff.labelB}`);
  lines.push("");
  lines.push(`**${ex.headline}**`);
  lines.push("");
  lines.push(`| | A | B |`);
  lines.push(`|---|---|---|`);
  lines.push(`| Agent | ${diff.agentA} | ${diff.agentB} |`);
  lines.push(`| Steps | ${st.stepsA} | ${st.stepsB} |`);
  lines.push(`| Errors / test fails | ${st.errorsA} | ${st.errorsB} |`);
  lines.push(`| Drift | **${diff.drift}/100** | |`);
  lines.push(`| Divergences | **${st.diverge}** (first ${diff.firstDivergence >= 0 ? "#" + (diff.firstDivergence + 1) : "—"}) | |`);
  lines.push("");
  for (const p of ex.paragraphs) lines.push(p);
  lines.push("");
  if (ex.bullets.length) {
    lines.push("## Why they forked");
    lines.push("");
    for (const b of ex.bullets) lines.push(`- ${b}`);
    lines.push("");
  }
  if (st.filesOnlyA.length) lines.push(`**Files only A:** ${st.filesOnlyA.join(", ")}`);
  if (st.filesOnlyB.length) lines.push(`**Files only B:** ${st.filesOnlyB.join(", ")}`);
  if (st.filesShared.length) lines.push(`**Shared files:** ${st.filesShared.join(", ")}`);
  lines.push("");
  if (meta.sourceA || meta.sourceB) {
    lines.push(`_Sources: ${meta.sourceA || "A"} · ${meta.sourceB || "B"}_`);
    lines.push("");
  }
  lines.push("_Generated offline by [@barood-labs/agentdiff](https://github.com/barood-labs/agentdiff). Nothing uploaded._");
  return lines.join("\n") + "\n";
}
