import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSession, exitCodeOf } from "../src/parser.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ex = (name, side) => readFileSync(join(ROOT, "examples", name, `${side}.jsonl`), "utf8");

describe("parseSession", () => {
  it("parses Claude Code login-bug A", () => {
    const s = parseSession(ex("login-bug", "a"));
    assert.equal(s.agent, "claude-code");
    assert.match(s.title, /login/i);
    assert.ok(s.events.some((e) => e.kind === "edit" && e.file === "src/middleware.ts"));
    assert.ok(s.events.some((e) => e.kind === "test_fail" || e.failed));
    assert.equal(s.events.at(-1).kind, "done");
  });

  it("parses Claude Code login-bug B with passing tests", () => {
    const s = parseSession(ex("login-bug", "b"));
    assert.ok(s.events.some((e) => e.kind === "edit" && e.file === "src/auth.ts"));
    assert.ok(s.events.some((e) => e.kind === "test_pass"));
  });

  it("dedupes repeated uuid rows", () => {
    const base = ex("wrong-file", "a").trim().split("\n");
    const dup = base[base.length - 1];
    const s = parseSession(base.join("\n") + "\n" + dup + "\n");
    const edits = s.events.filter((e) => e.kind === "edit");
    assert.equal(edits.length, 1);
  });

  it("rejects unknown format", () => {
    assert.throws(() => parseSession('{"foo":1}\n'), /Unrecognized/);
  });

  it("rejects empty session", () => {
    assert.throws(
      () => parseSession('{"type":"assistant","message":{"role":"assistant","content":[]}}\n'),
      /No replayable/,
    );
  });

  it("exitCodeOf reads Codex-style exit lines", () => {
    assert.equal(exitCodeOf("Exit code: 1\n"), 1);
    assert.equal(exitCodeOf("Process exited with code 0"), 0);
    assert.equal(exitCodeOf("nope"), undefined);
  });

  it("parses a minimal Codex JSONL session", () => {
    const text = [
      JSON.stringify({ type: "session_meta", payload: { cwd: "/repo" }, timestamp: "t" }),
      JSON.stringify({
        type: "response_item",
        payload: { type: "message", role: "user", content: [{ type: "text", text: "fix it" }] },
      }),
      JSON.stringify({
        type: "response_item",
        payload: {
          type: "function_call",
          name: "shell",
          call_id: "c1",
          arguments: { command: "npm test" },
        },
      }),
      JSON.stringify({
        type: "response_item",
        payload: {
          type: "function_call_output",
          call_id: "c1",
          output: "Exit code: 0\nTests: 1 passed",
        },
      }),
    ].join("\n");
    const s = parseSession(text);
    assert.equal(s.agent, "codex");
    assert.ok(s.events.some((e) => e.kind === "prompt"));
    assert.ok(s.events.some((e) => e.kind === "test_pass" || e.kind === "bash"));
  });
});
