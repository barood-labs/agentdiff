import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import { parseSession } from "./parser.mjs";

function walkJsonl(dir, out = [], depth = 0) {
  if (!dir || depth > 6 || !existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "subagents" || name === "node_modules" || name === ".git") continue;
    const p = join(dir, name);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) walkJsonl(p, out, depth + 1);
    else if (name.endsWith(".jsonl") && !name.startsWith("agent-")) out.push({ path: p, mtime: s.mtimeMs, size: s.size });
  }
  return out;
}

/** Resolve a path that is either a .jsonl file or a session folder containing one. */
export function resolveSessionPath(input) {
  const p = resolve(input);
  if (!existsSync(p)) throw new Error(`Session not found: ${p}`);
  const st = statSync(p);
  if (st.isFile()) {
    if (!p.endsWith(".jsonl")) throw new Error(`Expected a .jsonl session file: ${p}`);
    return p;
  }
  const found = walkJsonl(p).filter((f) => f.size > 50).sort((a, b) => b.mtime - a.mtime);
  if (!found.length) throw new Error(`No .jsonl session files under ${p}`);
  return found[0].path;
}

export function loadSession(input) {
  const path = resolveSessionPath(input);
  const text = readFileSync(path, "utf8");
  const session = parseSession(text);
  return {
    path,
    name: basename(path),
    dir: basename(dirname(path)),
    session,
  };
}
