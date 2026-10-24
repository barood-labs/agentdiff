import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSession } from "../src/parser.mjs";
import { compareSessions } from "../src/align.mjs";
import { renderReport, esc } from "../src/report.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (name, side) => parseSession(readFileSync(join(ROOT, "examples", name, `${side}.jsonl`), "utf8"));

describe("renderReport", () => {
  it("escapes HTML", () => {
    assert.equal(esc("<script>"), "&lt;script&gt;");
    assert.equal(esc('"x"'), "&quot;x&quot;");
  });

  it("emits a self-contained dark HTML document", () => {
    const diff = compareSessions(load("login-bug", "a"), load("login-bug", "b"), {
      labelA: "run-a",
      labelB: "run-b",
    });
    const html = renderReport(diff, { sourceA: "a.jsonl", sourceB: "b.jsonl" });
    assert.match(html, /<!DOCTYPE html>/);
    assert.match(html, /AgentDiff/);
    assert.match(html, /#0d1117/);
    assert.match(html, /Jump to first divergence/);
    assert.match(html, /id="scrub"/);
    assert.match(html, /application\/json/);
    assert.doesNotMatch(html, /https?:\/\/cdn\./);
    assert.doesNotMatch(html, /<script src=/);
    assert.match(html, /run-a/);
    assert.match(html, /run-b/);
    assert.match(html, /row-0/);
  });

  it("embeds divergence markers for login-bug", () => {
    const diff = compareSessions(load("login-bug", "a"), load("login-bug", "b"));
    const html = renderReport(diff);
    assert.match(html, /class="row diverge"/);
    assert.match(html, /drift/);
  });
});
