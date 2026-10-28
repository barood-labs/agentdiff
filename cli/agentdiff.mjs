#!/usr/bin/env node
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";
import { spawn } from "node:child_process";
import { loadSession } from "../src/load.mjs";
import { compareSessions } from "../src/align.mjs";
import { renderReport } from "../src/report.mjs";
import { explainDiff, renderMarkdown } from "../src/explain.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const args = process.argv.slice(2);

function flag(n) {
  return args.includes(n);
}
function opt(n) {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
}

function help() {
  console.log(`agentdiff — compare two AI coding-agent sessions side by side

usage:
  agentdiff compare <a.jsonl|dir> <b.jsonl|dir> [--out report.html]
  agentdiff demo [--out report.html]
  agentdiff --help

options:
  --out <file>     write HTML report (default: agentdiff-report.html)
  --label-a <name> left column title
  --label-b <name> right column title
  --json           print comparison JSON to stdout instead of HTML
  --md             print a Markdown summary (Discord / PR / X-ready)
  --open           open the report in your browser (local file)

Reads Claude Code (~/.claude/projects/**/*.jsonl) and Codex
(~/.codex/sessions/**/*.jsonl) logs. Offline: nothing is uploaded.`);
}

function openBrowser(fileUrl) {
  const cmd = platform() === "darwin" ? "open" : platform() === "win32" ? "cmd" : "xdg-open";
  const a = platform() === "win32" ? ["/c", "start", "", fileUrl] : [fileUrl];
  try {
    spawn(cmd, a, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  } catch {
    /* ignore */
  }
}

const cmd = args[0];
if (!cmd || flag("-h") || flag("--help")) {
  help();
  process.exit(0);
}

let pathA, pathB;
if (cmd === "demo") {
  pathA = resolve(ROOT, "examples/login-bug/a.jsonl");
  pathB = resolve(ROOT, "examples/login-bug/b.jsonl");
} else if (cmd === "compare") {
  pathA = args[1];
  pathB = args[2];
  if (!pathA || !pathB || pathA.startsWith("-") || pathB.startsWith("-")) {
    console.error("usage: agentdiff compare <a> <b> [--out report.html]");
    process.exit(2);
  }
} else {
  pathA = args[0];
  pathB = args[1];
  if (!pathA || !pathB || String(pathA).startsWith("-")) {
    console.error(`unknown command: ${cmd}\n`);
    help();
    process.exit(2);
  }
}

const loadedA = loadSession(pathA);
const loadedB = loadSession(pathB);
const diff = compareSessions(loadedA.session, loadedB.session, {
  labelA: opt("--label-a") || loadedA.name,
  labelB: opt("--label-b") || loadedB.name,
});

if (flag("--json")) {
  process.stdout.write(JSON.stringify(diff, null, 2) + "\n");
  process.exit(0);
}

if (flag("--md")) {
  const mdOut = opt("--out");
  const md = renderMarkdown(diff, { sourceA: loadedA.path, sourceB: loadedB.path });
  if (mdOut) {
    writeFileSync(resolve(mdOut), md, "utf8");
    console.log(`→ ${resolve(mdOut)}`);
  } else {
    process.stdout.write(md);
  }
  process.exit(0);
}

const out = resolve(opt("--out") || "agentdiff-report.html");
mkdirSync(dirname(out), { recursive: true });
const html = renderReport(diff, {
  sourceA: loadedA.path,
  sourceB: loadedB.path,
  generatedAt: new Date().toISOString(),
});
writeFileSync(out, html, "utf8");

const fd = diff.firstDivergence >= 0 ? `#${diff.firstDivergence + 1}` : "none";
const story = explainDiff(diff);
const top = (diff.reasons || []).slice(0, 5);
const reasonLines = top.length
  ? "\n  why:\n" + top.map((r) => `    #${r.index + 1}  ${r.detail}`).join("\n")
  : "";

console.log(`
  AgentDiff  drift ${diff.drift}/100
  ${story.headline}
  A  ${basename(loadedA.path)}  (${diff.stats.stepsA} steps, ${diff.agentA})
  B  ${basename(loadedB.path)}  (${diff.stats.stepsB} steps, ${diff.agentB})
  divergences ${diff.stats.diverge} · first ${fd}${reasonLines}
  → ${out}
`);
if (!existsSync(out)) process.exit(1);
if (flag("--open")) openBrowser(`file://${out}`);
