# MorphTrace

A TypeScript computational morphology engine and Cursor-compatible extension. It analyzes a word into modeled morphemes and generates word forms from explicit rules, showing every rule application.

## Important scope

MorphTrace v0.1 ships only a **synthetic demo grammar**, not a description of a real language. It supports v1 **concatenative morphology**: ordered prefixes, stems, suffixes, and deterministic string-replacement rules. It does not claim coverage of any natural language.

A real-language grammar requires evidence, licensing, and review. Use [`VALIDATION.md`](VALIDATION.md) before changing a grammar's status to `validated-language-data`.

## Core package

```ts
import { analyze, generate } from "@morphtrace/core";

const forms = generate("tal", { number: "plural", tense: "past" }, grammar);
const analyses = analyze("natadmu", grammar);
```

Both functions return every licensed result, morphemes, grammatical features, and a deterministic trace. `analyze` returns `[]` when no licensed analysis exists. Invalid or unsupported grammars throw `GrammarValidationError` with clear issues.

## Synthetic demo

`packages/core/grammars/synthetic-demo.json` uses invented stems and affixes. For example, the synthetic rule `l → d / __mu` changes `nat + al + mu` into `natadmu`. It is solely a software demo.

## Workspace grammar for Cursor

Place a JSON grammar at either:

- `morphtrace.grammar.json`, or
- `.morphtrace/grammar.json`

in the root of the current workspace, then run:

- **MorphTrace: Analyze Selected Word**
- **MorphTrace: Generate Word Form**

The extension reads grammar files locally, sends no selected text or grammar data to external services, and displays analyses or generated forms in a side panel.

## Development

```bash
npm install
npm test
npm run package:extension
```

`npm test` covers generation, ambiguous analyses, rule order, unknown forms, malformed grammars, Unicode normalization, and software-level round trips. Round-trip success is not linguistic proof.
