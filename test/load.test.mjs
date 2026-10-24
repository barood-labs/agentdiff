import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, copyFileSync, utimesSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { loadSession, resolveSessionPath } from "../src/load.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLE = join(ROOT, "examples/login-bug/a.jsonl");

describe("loadSession / resolveSessionPath", () => {
  it("loads a .jsonl file", () => {
    const s = loadSession(SAMPLE);
    assert.match(s.path, /a\.jsonl$/);
    assert.equal(s.session.agent, "claude-code");
    assert.ok(s.session.events.length > 0);
  });

  it("resolves a folder to the newest .jsonl", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdiff-load-"));
    try {
      const older = join(dir, "older.jsonl");
      const newer = join(dir, "newer.jsonl");
      copyFileSync(SAMPLE, older);
      copyFileSync(SAMPLE, newer);
      utimesSync(older, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));
      utimesSync(newer, new Date(), new Date());
      const p = resolveSessionPath(dir);
      assert.match(p, /newer\.jsonl$/);
      const loaded = loadSession(dir);
      assert.equal(loaded.session.agent, "claude-code");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects missing paths", () => {
    assert.throws(() => resolveSessionPath(join(tmpdir(), "no-such-agentdiff-session.jsonl")), /not found/i);
  });

  it("rejects non-jsonl files", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdiff-load-"));
    const f = join(dir, "notes.txt");
    try {
      writeFileSync(f, "hi");
      assert.throws(() => resolveSessionPath(f), /\.jsonl/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects empty folders", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdiff-load-"));
    try {
      mkdirSync(join(dir, "empty"), { recursive: true });
      assert.throws(() => resolveSessionPath(join(dir, "empty")), /No \.jsonl/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
