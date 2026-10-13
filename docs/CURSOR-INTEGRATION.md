# Cursor integration limits

Verified locally on 2026-10-13: `/Applications/Cursor.app` reports version **3.19.13**.

The current official Cursor Hooks documentation lists `preCompact`, `afterAgentResponse`, and related events. The documented `preCompact` event is explicitly observational: it cannot block or modify compaction. Its documented input contains trigger and context-window metadata, not the completed internal summary. The documented output is an optional user message.

Therefore ContextCheck v1 does not claim that a normal extension can:

- read Cursor's private chat database or hidden compaction summaries;
- block native compaction;
- receive the completed summary through `preCompact`;
- assume `afterAgentResponse` contains an internal compaction summary.

An optional project hook may notify a user that compaction occurred or record permitted metadata. It must not scrape private state, claim summary access it does not have, or automatically upload conversations. See the official reference: https://cursor.com/docs/hooks
