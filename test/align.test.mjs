import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSession } from "../src/parser.mjs";
import { compareSessions, alignSteps, actionable, stepKey } from "../src/align.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (name, side) => parseSession(readFileSync(join(ROOT, "examples", name, `${side}.jsonl`), "utf8"));

describe("stepKey / alignSteps", () => {
  it("keys file edits by kind+path", () => {
    assert.equal(stepKey({ kind: "edit", file: "src/a.ts", label: "edit src/a.ts" }), "edit:src/a.ts");
  });

  it("LCS aligns identical prefixes", () => {
    const a = [{ kind: "read", file: "a.ts", label: "read a.ts" }, { kind: "edit", file: "a.ts", label: "edit a.ts" }];
    const b = [{ kind: "read", file: "a.ts", label: "read a.ts" }, { kind: "edit", file: "b.ts", label: "edit b.ts" }];
    const pairs = alignSteps(a, b);
    assert.equal(pairs[0].match, true);
    assert.equal(pairs.some((p) => !p.match), true);
  });

  it("actionable drops think/prompt/done", () => {
    const acts = actionable([
      { kind: "prompt", label: "x", tokens: 0 },
      { kind: "think", label: "y", tokens: 0 },
      { kind: "edit", file: "f", label: "edit f", tokens: 0 },
      { kind: "done", label: "d", tokens: 0 },
    ]);
    assert.equal(acts.length, 1);
    assert.equal(acts[0].kind, "edit");
  });
});

describe("compareSessions fixtures", () => {
  it("login-bug diverges on middleware vs auth", () => {
    const diff = compareSessions(load("login-bug", "a"), load("login-bug", "b"));
    assert.ok(diff.drift > 0);
    assert.ok(diff.firstDivergence >= 0);
    assert.ok(diff.stats.diverge >= 1);
    assert.ok(diff.stats.filesOnlyA.includes("src/middleware.ts") || diff.rows.some((r) => r.reason?.code === "file"));
    assert.ok(diff.stats.errorsA >= diff.stats.errorsB);
  });

  it("flaky-test marks A's blind retries", () => {
    const diff = compareSessions(load("flaky-test", "a"), load("flaky-test", "b"));
    assert.ok(diff.stats.diverge >= 1);
    assert.ok(diff.firstDivergence >= 0);
  });

  it("wrong-file shows README-only vs parse.ts", () => {
    const diff = compareSessions(load("wrong-file", "a"), load("wrong-file", "b"));
    assert.ok(diff.stats.filesOnlyA.includes("README.md") || diff.stats.filesOnlyB.includes("src/parse.ts"));
    assert.ok(diff.drift >= 20);
  });

  it("identical sessions have zero drift", () => {
    const s = load("login-bug", "b");
    const diff = compareSessions(s, s);
    assert.equal(diff.drift, 0);
    assert.equal(diff.stats.diverge, 0);
    assert.equal(diff.firstDivergence, -1);
  });
});
