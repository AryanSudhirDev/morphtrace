# ContextCheck

**ContextCheck reviews whether a handoff summary preserves important instructions from the original conversation.** It is a local, deterministic review aid for a narrow, documented subset of instruction language. It is not a guarantee that a summary is correct or that an agent is safe.

## The problem

A summary may retain the topic but lose what someone is allowed, required, or forbidden to do.

```text
Source:  Prepare the database update, but do not run it.
Summary: Update the database.
```

ContextCheck flags the missing prohibition and points a reviewer to the original span. It also recognizes supported paraphrases when the actor, action, condition, and scope align:

```text
Source:  Do not deploy until I approve.
Summary: Deployment requires the user's approval.
```

## What v1 supports

The deterministic baseline extracts and compares a restricted set of user instructions involving:

- prohibitions: `Do not X`, `Do not X until Y`, `Never X`
- permissions: `You may X`, `You can X`
- requirements: `X requires Y`, `X only after Y`, `X only in Y`, `Must X`
- explicit exceptions: `Do not X except/unless Y`

It represents actor when known, action, target, modality, condition, scope, exception, source message ID, character offsets, and unresolved references. It distinguishes preserved meaning, omitted constraints, contradictions, permission becoming obligation, changed scope/condition, unsupported additions, and uncertainty.

## Important limits

- This is **not unrestricted natural-language understanding**. Unsupported or ambiguous patterns should receive an uncertainty or abstention, not a guessed answer.
- Permission is not a requirement. Preparing a change is not executing it. `Only in staging` is a scope restriction.
- Tool output and assistant proposals are excluded from source-instruction extraction. Quoted/example text is not silently treated as a user request.
- Plain text is accepted, but because it lacks message roles, the limitation is explicit and findings are marked uncertain.
- Later, incompatible user instructions about the same modeled action supersede earlier ones. Complex corrections and unresolved references remain uncertain.
- No model or paid API is required. A future model adapter must remain optional, local by default, and validate any returned evidence spans against the input.

## Local use

```bash
npm install
npm test
npm run build
node packages/core/dist/src/cli.js \
  --conversation examples/contextcheck/source.json \
  --summary examples/contextcheck/changed-summary.txt \
  --format text
```

### Reproducible demo

```bash
# 1. Genuine changed instruction: flags a lost prohibition
node packages/core/dist/src/cli.js --conversation examples/contextcheck/source.json --summary examples/contextcheck/changed-summary.txt --format text

# 2. Meaning-preserving paraphrase: reports preserved meaning
node packages/core/dist/src/cli.js --conversation examples/contextcheck/preserved-source.json --summary examples/contextcheck/preserved-summary.txt --format text

# 3. Ambiguous pronoun: declines to resolve it
node packages/core/dist/src/cli.js --conversation examples/contextcheck/ambiguous-source.json --summary examples/contextcheck/ambiguous-summary.txt --format text
```

## TypeScript API

```ts
import { checkSummary } from "@contextcheck/core";

const review = checkSummary(
  { messages: [{ id: "u1", role: "user", text: "Do not deploy until I approve." }] },
  "Deployment requires the user's approval."
);
console.log(review.findings, review.readableReport);
```

## Cursor and VS Code extension

Build a local VSIX without publishing it:

```bash
npm run package:extension
# Install the resulting contextcheck-0.1.0.vsix using Extensions: Install from VSIX.
```

Commands:

- **ContextCheck: Load Source Conversation**: explicitly load structured JSON or plain text.
- **ContextCheck: Check Summary Against Conversation**: select or paste a candidate summary.
- **ContextCheck: Review Findings**: open the accessible, evidence-backed review panel.
- **ContextCheck: Export Review Report**: explicitly save JSON with review labels.
- **ContextCheck: Clear Saved Review Data**: remove explicitly saved source data and labels.

The webview escapes imported text, uses a restrictive CSP, uses visible labels instead of color alone, and keeps reviewer labels separate from predictions.

## MCP

Run the local stdio server after building:

```bash
npm run mcp
```

Example MCP client configuration:

```json
{
  "mcpServers": {
    "contextcheck": {
      "command": "node",
      "args": ["/absolute/path/to/morphtrace/packages/mcp/dist/src/index.js"]
    }
  }
}
```

It exposes one `check_summary` tool with `conversation` and `candidateSummary` inputs. It returns structured findings plus the readable review report. Calling the tool is voluntary for an agent; it does not automatically block an action.

## Cursor hook limits

The locally installed Cursor is **3.19.13**. Its official `preCompact` hook is observational: it can notify a user but cannot block or alter compaction, and its documented input supplies compaction metadata rather than the completed internal summary. See [docs/CURSOR-INTEGRATION.md](docs/CURSOR-INTEGRATION.md). ContextCheck therefore does **not** claim automatic native compaction auditing, access to hidden chat state, or access to a completed compaction summary through `afterAgentResponse`.

## Tests and evaluation

`npm test` includes development fixtures and held-out fixtures. It reports only actual pass/fail results. The suite covers lost prohibitions, conditions, permission/obligation changes, staging scope, paraphrases, exceptions, supersession, ambiguity, quoted instructions, assistant proposals, unsupported additions, invalid input, and unsafe markup. Development and held-out examples live in separate fixture folders. Passing these tests demonstrates only the supported deterministic patterns, not generalization.

## Privacy

ContextCheck processes inputs locally by default. It does not scrape undocumented chat databases, call a remote model, rewrite summaries, modify source conversations, or automatically block agent actions. Conversation persistence occurs only when the user explicitly uses **Load Source Conversation**; **Clear Saved Review Data** removes it.
