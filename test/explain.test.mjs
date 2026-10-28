import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSession } from "../src/parser.mjs";
import { compareSessions } from "../src/align.mjs";
import { explainDiff, renderMarkdown } from "../src/explain.mjs";
import { renderReport } from "../src/report.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (name, side) => parseSession(readFileSync(join(ROOT, "examples", name, `${side}.jsonl`), "utf8"));

describe("explainDiff", () => {
  it("summarizes login-bug with a headline and share text", () => {
    const diff = compareSessions(load("login-bug", "a"), load("login-bug", "b"), {
      labelA: "good",
      labelB: "bad",
    });
    const ex = explainDiff(diff);
    assert.ok(ex.headline.length > 10);
    assert.match(ex.headline, /fork|step|aligned|drift/i);
    assert.ok(ex.paragraphs.length >= 1);
    assert.ok(ex.bullets.length >= 1);
    assert.match(ex.shareText, /AgentDiff/);
    assert.match(ex.shareText, /drift/);
  });

  it("renderMarkdown includes a table and why section", () => {
    const diff = compareSessions(load("wrong-file", "a"), load("wrong-file", "b"));
    const md = renderMarkdown(diff, { sourceA: "a.jsonl", sourceB: "b.jsonl" });
    assert.match(md, /^# AgentDiff/m);
    assert.match(md, /\| Agent \|/);
    assert.match(md, /## Why they forked/);
    assert.match(md, /barood-labs\/agentdiff/);
  });

  it("HTML report embeds the story banner and copy button", () => {
    const diff = compareSessions(load("flaky-test", "a"), load("flaky-test", "b"));
    const html = renderReport(diff);
    assert.match(html, /id="story"/);
    assert.match(html, /Copy summary/);
    assert.match(html, /btnCopy/);
    assert.match(html, /agentdiff 0\.2\.0/);
  });
});
