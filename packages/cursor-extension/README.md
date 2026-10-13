# ContextCheck

**Review whether an AI-generated summary preserved the instructions that matter.**

ContextCheck is a local-first extension for Cursor and VS Code. It compares a source conversation with a candidate handoff summary, then shows evidence-backed findings when a summary may have dropped a prohibition, changed an approval requirement, widened a scope, turned permission into obligation, or added an unsupported claim.

> ContextCheck is a review aid, not a guarantee that a summary is correct or that an agent is safe. Version 1 deliberately supports a restricted, deterministic set of instruction patterns.

---

## Why ContextCheck

A summary can preserve the topic while changing what someone is allowed to do.

| Original conversation | Candidate summary | What ContextCheck flags |
| --- | --- | --- |
| “Prepare the database update, but **do not run it**.” | “Update the database.” | The prohibition may be missing. Preparing is not the same as executing. |
| “**Do not deploy until I approve.**” | “Deployment requires the user’s approval.” | Supported meaning-preserving paraphrase. |
| “Deploy **only in staging**.” | “Deploy only in production.” | Scope changed. |

The extension keeps the relevant source and summary passages beside each finding so a developer can decide what is actually correct.

## What it checks in v1

ContextCheck’s offline baseline recognizes a documented subset of instructions involving:

- **Prohibitions:** `Do not X`, `Do not X until Y`, `Never X`
- **Permissions:** `You may X`, `You can X`
- **Requirements:** `X requires Y`, `X only after Y`, `X only in Y`, `Must X`
- **Explicit exceptions:** `Do not X except/unless Y`
- **Later corrections:** a later incompatible modeled instruction can supersede an earlier one

It reports one of these review categories:

- Preserved meaning
- Potentially omitted constraint
- Direct contradiction
- Permission becoming obligation
- Changed condition or scope
- Unsupported addition
- Uncertain interpretation

## Quick start

1. Open the Command Palette in Cursor or VS Code.
2. Run **ContextCheck: Load Source Conversation**.
   - Choose a structured JSON conversation, or explicitly paste plain text.
3. Run **ContextCheck: Check Summary Against Conversation**.
   - Choose or paste the candidate summary.
4. Review evidence in the side panel and label each finding:
   - Confirmed issue
   - Acceptable paraphrase
   - False alarm
   - Needs clarification
5. Optionally run **ContextCheck: Export Review Report** to save a JSON report.

Use **ContextCheck: Clear Saved Review Data** to remove an explicitly loaded source and reviewer labels from extension storage.

## Supported input

For the strongest review, use structured messages with stable IDs and roles:

```json
{
  "messages": [
    {
      "id": "u1",
      "role": "user",
      "text": "Do not deploy until I approve."
    },
    {
      "id": "a1",
      "role": "assistant",
      "text": "I will wait for approval."
    }
  ]
}
```

ContextCheck retains message IDs and character offsets for evidence. It extracts source instructions from user messages, not assistant proposals or tool output. Plain text is supported, but the lack of roles is made visible and related findings are treated conservatively.

## How the comparison works

ContextCheck separates three steps:

1. **Extract** supported instructions into structured fields: actor when known, action, target, modality, condition, scope, exception, source spans, and unresolved references.
2. **Compare** source and summary structures without relying on keyword overlap alone.
3. **Report** findings with exact source and summary passages for human review.

The baseline runs locally and deterministically. A future model adapter is optional, never required for the demo, and must validate every proposed evidence span against the actual input.

## Privacy and safety boundaries

- Local by default. The extension does not call an external model or send conversations to a service.
- It does not scrape Cursor’s private chat databases or hidden summaries.
- It does not rewrite the conversation or candidate summary.
- It does not block agent actions in v1.
- Imported conversations are treated as untrusted text. The review panel escapes content and uses a restrictive content security policy.

## Important limitations

ContextCheck is intentionally narrow. It does **not** claim unrestricted natural-language understanding. Ambiguous references, complicated corrections, unsupported phrasing, or missing message roles should produce uncertainty or abstention rather than a fabricated answer.

In particular, it cannot automatically audit Cursor’s native compaction. Cursor’s documented `preCompact` hook is observational and does not expose the completed internal summary.

## CLI and MCP

The open-source repository includes the same checker as a TypeScript API, command-line tool, and local MCP server exposing `check_summary`.

```bash
npm run mcp
```

See the repository for the reproducible demo, evaluation scope, supported patterns, and MCP client configuration:

[github.com/AryanSudhirDev/morphtrace](https://github.com/AryanSudhirDev/morphtrace)

## Open source

MIT licensed. Issues and source code: [AryanSudhirDev/morphtrace](https://github.com/AryanSudhirDev/morphtrace).
