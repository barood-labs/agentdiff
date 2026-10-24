# AgentDiff

**Two AI coding-agent sessions. One side-by-side failure diff.**

Point it at two Claude Code or Codex runs of the same task. AgentDiff aligns their tool-call timelines, jumps to the first divergence, and writes a single offline HTML report.

![AgentDiff hero](docs/hero.svg)

```bash
npx @barood-labs/agentdiff compare run-a.jsonl run-b.jsonl --out report.html
# or two session folders:
npx @barood-labs/agentdiff compare ~/.claude/projects/.../a ~/.claude/projects/.../b
npx @barood-labs/agentdiff demo
```

Open `report.html`. No account. No upload. No cloud deps in the viewer.

## Why

AgentTown replays **one** session as a city. WhyDiff scores **one** diff. AgentDiff answers the question you actually ask in Discord:

> “These two agents got the same prompt — where did the bad one go off the rails?”

Typical divergences it highlights:

- different files edited
- different shell commands
- one side errored / failed tests
- steps only present on A or B

## What you get

| Piece | Detail |
|-------|--------|
| CLI | `compare`, `demo`, `--json`, `--out`, folder or `.jsonl` |
| Parsers | Claude Code + Codex JSONL (adapted from [AgentTown](https://github.com/barood-labs/agenttown), MIT) |
| Align | LCS on actionable steps (read/edit/write/bash/test/…) |
| Report | Dark single-file HTML: dual timeline, scrubber, “first divergence” jump, tool histograms, drift score |
| Fixtures | `examples/login-bug`, `flaky-test`, `wrong-file` |

## Drift score

Rough 0–100 “how far apart”: share of diverging aligned rows, plus file asymmetry and error asymmetry. Not a model quality ranking — a debug compass.

## Library

```js
import { loadSession, compareSessions, renderReport } from "@barood-labs/agentdiff";

const a = loadSession("a.jsonl");
const b = loadSession("b.jsonl");
const diff = compareSessions(a.session, b.session);
console.log(diff.firstDivergence, diff.drift, diff.stats);
```

## Gallery

After `npm run build`, open `docs/index.html` for the three fixture reports.

## Develop

```bash
npm test          # node:test
npm run build     # write docs/*.html gallery
npm run demo      # compare login-bug → /tmp/agentdiff-demo.html
```

## Not in v0.1

Live webhooks, cloud agent APIs, Cursor log format, GIF export, SaaS.

## License

MIT © barood-labs

Session parsers adapted from `@barood-labs/agenttown` (MIT). Divergence framing inspired by `@barood-labs/whydiff` (MIT).
