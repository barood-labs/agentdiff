#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CWD = "/Users/dev/acme-app";

function line(obj) {
  return JSON.stringify(obj);
}

function userText(uuid, text, extra = {}) {
  return {
    parentUuid: null,
    isSidechain: false,
    userType: "external",
    cwd: CWD,
    sessionId: "sess-demo",
    version: "2.0.14",
    type: "user",
    uuid,
    timestamp: "2026-10-23T18:00:00.000Z",
    message: { role: "user", content: text },
    ...extra,
  };
}

function assistant(uuid, msgId, content, usage = { input_tokens: 10, output_tokens: 20 }) {
  return {
    parentUuid: null,
    isSidechain: false,
    userType: "external",
    cwd: CWD,
    sessionId: "sess-demo",
    version: "2.0.14",
    type: "assistant",
    uuid,
    timestamp: "2026-10-23T18:00:00.000Z",
    message: { id: msgId, role: "assistant", content, usage },
  };
}

function toolResult(uuid, toolId, content, is_error = false) {
  return {
    parentUuid: null,
    isSidechain: false,
    userType: "external",
    cwd: CWD,
    sessionId: "sess-demo",
    version: "2.0.14",
    type: "user",
    uuid,
    timestamp: "2026-10-23T18:00:00.000Z",
    message: {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolId, content, is_error }],
    },
  };
}

function writePair(name, summary, stepsA, stepsB) {
  const dir = join(ROOT, "examples", name);
  mkdirSync(dir, { recursive: true });
  const build = (steps) => {
    const rows = [{ type: "summary", summary, leafUuid: "leaf" }];
    rows.push(userText("u-prompt", summary));
    let n = 0;
    for (const s of steps) {
      n++;
      const id = `toolu_${n}`;
      const msg = `msg_${n}`;
      if (s.think) rows.push(assistant(`a-t${n}`, msg, [{ type: "text", text: s.think }]));
      rows.push(
        assistant(`a-${n}`, msg, [
          { type: "tool_use", id, name: s.tool, input: s.input },
        ]),
      );
      if (s.result !== undefined) {
        rows.push(toolResult(`u-${n}`, id, s.result, !!s.error));
      }
    }
    return rows.map(line).join("\n") + "\n";
  };
  writeFileSync(join(dir, "a.jsonl"), build(stepsA));
  writeFileSync(join(dir, "b.jsonl"), build(stepsB));
  writeFileSync(
    join(dir, "README.md"),
    `# ${name}\n\n${summary}\n\nCompare with:\n\n\`\`\`bash\nnpx @barood-labs/agentdiff compare examples/${name}/a.jsonl examples/${name}/b.jsonl\n\`\`\`\n`,
  );
  console.log("wrote", name);
}

// 1) login-bug: both investigate auth; A edits wrong middleware, B fixes auth.ts and tests pass
writePair(
  "login-bug",
  "Fix login redirect loop",
  [
    { think: "Looking at auth flow.", tool: "Read", input: { file_path: `${CWD}/src/auth.ts` }, result: "export function login(){}" },
    { tool: "Grep", input: { pattern: "redirect", path: `${CWD}/src` }, result: "src/middleware.ts" },
    { tool: "Read", input: { file_path: `${CWD}/src/middleware.ts` }, result: "export function mw(){}" },
    { tool: "Edit", input: { file_path: `${CWD}/src/middleware.ts`, old_string: "a", new_string: "b" }, result: "ok" },
    { tool: "Bash", input: { command: "npm test -- auth" }, result: "FAIL auth.test.ts", error: true },
    { tool: "Edit", input: { file_path: `${CWD}/src/middleware.ts`, old_string: "b", new_string: "c" }, result: "ok" },
    { tool: "Bash", input: { command: "npm test -- auth" }, result: "FAIL still looping", error: true },
  ],
  [
    { think: "Looking at auth flow.", tool: "Read", input: { file_path: `${CWD}/src/auth.ts` }, result: "export function login(){}" },
    { tool: "Grep", input: { pattern: "redirect", path: `${CWD}/src` }, result: "src/auth.ts" },
    { tool: "Read", input: { file_path: `${CWD}/src/auth.ts` }, result: "export function login(){}" },
    { tool: "Edit", input: { file_path: `${CWD}/src/auth.ts`, old_string: "a", new_string: "b" }, result: "ok" },
    { tool: "Bash", input: { command: "npm test -- auth" }, result: "Tests: 4 passed, 4 total" },
  ],
);

// 2) flaky-test: A retries blindly; B finds race and adds wait
writePair(
  "flaky-test",
  "Stop flaky checkout test",
  [
    { tool: "Read", input: { file_path: `${CWD}/tests/checkout.test.ts` }, result: "it(pays)" },
    { tool: "Bash", input: { command: "npm test -- checkout" }, result: "1 failed", error: true },
    { tool: "Bash", input: { command: "npm test -- checkout" }, result: "1 failed", error: true },
    { tool: "Bash", input: { command: "npm test -- checkout" }, result: "Tests: 1 passed" },
    { think: "Flaky but green now.", tool: "TodoWrite", input: { todos: [{ content: "done", status: "completed" }] }, result: "ok" },
  ],
  [
    { tool: "Read", input: { file_path: `${CWD}/tests/checkout.test.ts` }, result: "it(pays)" },
    { tool: "Bash", input: { command: "npm test -- checkout" }, result: "1 failed", error: true },
    { tool: "Grep", input: { pattern: "waitFor|setTimeout", path: `${CWD}/tests` }, result: "none" },
    { tool: "Edit", input: { file_path: `${CWD}/tests/checkout.test.ts`, old_string: "pay()", new_string: "await waitFor(() => pay())" }, result: "ok" },
    { tool: "Bash", input: { command: "npm test -- checkout" }, result: "Tests: 1 passed" },
  ],
);

// 3) wrong-file: A patches README; B finds real bug in parser
writePair(
  "wrong-file",
  "Fix JSON parse error on empty input",
  [
    { tool: "Read", input: { file_path: `${CWD}/README.md` }, result: "# app" },
    { tool: "Edit", input: { file_path: `${CWD}/README.md`, old_string: "a", new_string: "handles empty" }, result: "ok" },
    { tool: "Bash", input: { command: "npm test" }, result: "FAIL parse", error: true },
  ],
  [
    { tool: "Grep", input: { pattern: "JSON.parse", path: `${CWD}/src` }, result: "src/parse.ts" },
    { tool: "Read", input: { file_path: `${CWD}/src/parse.ts` }, result: "JSON.parse(x)" },
    { tool: "Edit", input: { file_path: `${CWD}/src/parse.ts`, old_string: "JSON.parse(x)", new_string: "x?JSON.parse(x):{}" }, result: "ok" },
    { tool: "Bash", input: { command: "npm test" }, result: "Tests: 12 passed, 12 total" },
  ],
);

console.log("fixtures ready");
