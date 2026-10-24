import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "cli/agentdiff.mjs");

function run(args, cwd = ROOT) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", cwd });
}

describe("CLI", () => {
  it("prints help", () => {
    const r = run(["--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /agentdiff/);
    assert.match(r.stdout, /compare/);
  });

  it("compare writes HTML report", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdiff-"));
    const out = join(dir, "report.html");
    const r = run([
      "compare",
      "examples/login-bug/a.jsonl",
      "examples/login-bug/b.jsonl",
      "--out",
      out,
    ]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /drift/);
    assert.ok(existsSync(out));
    const html = readFileSync(out, "utf8");
    assert.match(html, /AgentDiff/);
    rmSync(dir, { recursive: true, force: true });
  });

  it("demo command works", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdiff-"));
    const out = join(dir, "demo.html");
    const r = run(["demo", "--out", out]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.ok(existsSync(out));
    rmSync(dir, { recursive: true, force: true });
  });

  it("accepts session folders", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdiff-"));
    const out = join(dir, "folder.html");
    const r = run(["compare", "examples/flaky-test", "examples/wrong-file", "--out", out]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.ok(existsSync(out));
    rmSync(dir, { recursive: true, force: true });
  });

  it("--json prints structured result", () => {
    const r = run(["compare", "examples/wrong-file/a.jsonl", "examples/wrong-file/b.jsonl", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const j = JSON.parse(r.stdout);
    assert.ok(typeof j.drift === "number");
    assert.ok(Array.isArray(j.rows));
  });

  it("prints top divergence reasons", () => {
    const r = run(["compare", "examples/login-bug/a.jsonl", "examples/login-bug/b.jsonl", "--out", join(tmpdir(), "agentdiff-why.html")]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /why:/);
    assert.match(r.stdout, /#\d+/);
  });

  it("fails on missing file", () => {
    const r = run(["compare", "examples/login-bug/a.jsonl", "nope.jsonl"]);
    assert.notEqual(r.status, 0);
  });
});
