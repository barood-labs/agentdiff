// Align two agent sessions and score where they diverge.
// Inspired by WhyDiff's "what changed / why it failed" framing (MIT, barood-labs/whydiff).

const ACTION_KINDS = new Set([
  "read",
  "search",
  "edit",
  "write",
  "bash",
  "test_pass",
  "test_fail",
  "agent",
  "web",
  "todo",
  "mcp",
]);

/** Normalize a bash/search label for loose matching. */
function normCmd(label) {
  return String(label || "")
    .replace(/^\$\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 80);
}

/** Signature used for LCS alignment of actionable steps. */
export function stepKey(ev) {
  if (!ev) return "";
  if (ev.file && (ev.kind === "read" || ev.kind === "edit" || ev.kind === "write" || ev.kind === "search")) {
    return `${ev.kind}:${ev.file}`;
  }
  if (ev.kind === "bash" || ev.kind === "search") return `${ev.kind}:${normCmd(ev.label)}`;
  if (ev.kind === "test_pass" || ev.kind === "test_fail") return ev.kind;
  if (ev.kind === "web" || ev.kind === "agent" || ev.kind === "mcp" || ev.kind === "todo") {
    return `${ev.kind}:${normCmd(ev.label).slice(0, 40)}`;
  }
  return `${ev.kind}:${normCmd(ev.label).slice(0, 40)}`;
}

export function actionable(events) {
  return (events || [])
    .map((e, i) => ({ ...e, _i: i }))
    .filter((e) => ACTION_KINDS.has(e.kind));
}

/**
 * Classic LCS on step keys. Returns pairs of indices into the actionable arrays
 * (or -1 for gaps).
 */
export function alignSteps(left, right) {
  const n = left.length;
  const m = right.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (stepKey(left[i]) === stepKey(right[j])) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  /** @type {{li:number,ri:number,match:boolean}[]} */
  const pairs = [];
  let i = 0,
    j = 0;
  while (i < n && j < m) {
    if (stepKey(left[i]) === stepKey(right[j])) {
      pairs.push({ li: i, ri: j, match: true });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pairs.push({ li: i, ri: -1, match: false });
      i++;
    } else {
      pairs.push({ li: -1, ri: j, match: false });
      j++;
    }
  }
  while (i < n) pairs.push({ li: i++, ri: -1, match: false });
  while (j < m) pairs.push({ li: -1, ri: j++, match: false });
  return pairs;
}

function divergenceReason(a, b) {
  if (!a && b) return { code: "only_b", detail: `Only B: ${b.kind}${b.file ? " " + b.file : ""}` };
  if (a && !b) return { code: "only_a", detail: `Only A: ${a.kind}${a.file ? " " + a.file : ""}` };
  if (a.kind !== b.kind) return { code: "kind", detail: `Kind ${a.kind} ≠ ${b.kind}` };
  if ((a.file || "") !== (b.file || "")) return { code: "file", detail: `File ${a.file || "∅"} ≠ ${b.file || "∅"}` };
  if (a.kind === "bash" && normCmd(a.label) !== normCmd(b.label)) {
    return { code: "command", detail: "Different commands" };
  }
  if (!!a.failed !== !!b.failed) return { code: "error", detail: a.failed ? "A errored, B did not" : "B errored, A did not" };
  if ((a.kind === "test_fail") !== (b.kind === "test_fail")) {
    return { code: "test", detail: "Test outcome differs" };
  }
  if (stepKey(a) !== stepKey(b)) return { code: "label", detail: "Step labels diverge" };
  return null;
}

/**
 * Compare two parsed sessions.
 * @param {import("./parser.mjs").Session} sessionA
 * @param {import("./parser.mjs").Session} sessionB
 * @param {{labelA?:string,labelB?:string}} [opts]
 */
export function compareSessions(sessionA, sessionB, opts = {}) {
  const left = actionable(sessionA.events);
  const right = actionable(sessionB.events);
  const pairs = alignSteps(left, right);

  const rows = [];
  let firstDivergence = -1;
  const reasons = [];
  const filesA = new Set(left.filter((e) => e.file).map((e) => e.file));
  const filesB = new Set(right.filter((e) => e.file).map((e) => e.file));

  for (let k = 0; k < pairs.length; k++) {
    const { li, ri, match } = pairs[k];
    const a = li >= 0 ? left[li] : null;
    const b = ri >= 0 ? right[ri] : null;
    let status = "same";
    let reason = null;
    if (!match) {
      status = "diverge";
      reason = divergenceReason(a, b);
      if (firstDivergence < 0) firstDivergence = k;
      if (reason) reasons.push({ index: k, ...reason });
    } else if (a && b && (!!a.failed !== !!b.failed || a.kind !== b.kind)) {
      // same key but outcome differs (e.g. bash vs test_fail after settle)
      status = "diverge";
      reason = divergenceReason(a, b) || { code: "outcome", detail: "Outcome differs" };
      if (firstDivergence < 0) firstDivergence = k;
      if (reason) reasons.push({ index: k, ...reason });
    }
    rows.push({
      index: k,
      status,
      reason,
      a: a
        ? { kind: a.kind, file: a.file, label: a.label, failed: !!a.failed, tokens: a.tokens, eventIndex: a._i }
        : null,
      b: b
        ? { kind: b.kind, file: b.file, label: b.label, failed: !!b.failed, tokens: b.tokens, eventIndex: b._i }
        : null,
    });
  }

  const onlyA = [...filesA].filter((f) => !filesB.has(f));
  const onlyB = [...filesB].filter((f) => !filesA.has(f));
  const shared = [...filesA].filter((f) => filesB.has(f));

  const errorA = left.filter((e) => e.failed || e.kind === "test_fail").length;
  const errorB = right.filter((e) => e.failed || e.kind === "test_fail").length;
  const divergeCount = rows.filter((r) => r.status === "diverge").length;
  const sameCount = rows.filter((r) => r.status === "same").length;

  // Rough 0–100 "drift" score: more divergences + file asymmetry + error asymmetry → higher
  const denom = Math.max(1, rows.length);
  let drift = Math.round((divergeCount / denom) * 70);
  drift += Math.min(15, onlyA.length * 3 + onlyB.length * 3);
  drift += Math.min(15, Math.abs(errorA - errorB) * 5);
  drift = Math.min(100, drift);

  return {
    labelA: opts.labelA || sessionA.title || "A",
    labelB: opts.labelB || sessionB.title || "B",
    agentA: sessionA.agent,
    agentB: sessionB.agent,
    titleA: sessionA.title,
    titleB: sessionB.title,
    firstDivergence,
    drift,
    stats: {
      stepsA: left.length,
      stepsB: right.length,
      aligned: rows.length,
      same: sameCount,
      diverge: divergeCount,
      errorsA: errorA,
      errorsB: errorB,
      filesOnlyA: onlyA,
      filesOnlyB: onlyB,
      filesShared: shared,
    },
    reasons,
    rows,
    // full event lists for the scrubber / non-actionable context
    eventsA: sessionA.events.map((e, i) => ({ ...e, eventIndex: i })),
    eventsB: sessionB.events.map((e, i) => ({ ...e, eventIndex: i })),
  };
}
