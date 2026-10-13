# ContextCheck for Cursor and VS Code

Review whether a candidate AI summary preserves modeled user instructions and constraints from a loaded conversation.

## Local workflow

1. Run **ContextCheck: Load Source Conversation** and explicitly choose structured conversation JSON or plain text.
2. Run **ContextCheck: Check Summary Against Conversation** and choose or paste a candidate summary.
3. Inspect evidence in **ContextCheck: Review Findings**.
4. Label each finding as a confirmed issue, acceptable paraphrase, false alarm, or needs clarification.
5. Use **ContextCheck: Export Review Report** only when you want to save a report.

All processing is local. The extension does not scrape Cursor chat state, call an external service, rewrite summaries, or block actions. It supports a narrow deterministic subset of prohibition, permission, requirement, condition, scope, and exception patterns. It is a review aid, not a safety guarantee.

See the repository README for the supported patterns, demo, MCP setup, and Cursor hook limitations.
