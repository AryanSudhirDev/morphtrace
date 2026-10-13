# MorphTrace

**Make word formation visible.** MorphTrace is a local-first extension for Cursor and VS Code that analyzes a selected surface form into modeled morphemes, grammatical features, and explicit rule-by-rule traces. It can also generate a form from a lemma and feature bundle.

> **Current scope:** v0.1 supports only concatenative morphology: ordered prefixes, stems, suffixes, and deterministic replacement rules. The included grammar is a **synthetic demo**, not a model of a real language.

## What you can do

| Command | What it does |
| --- | --- |
| **MorphTrace: Analyze Selected Word** | Reads the selected form and shows every analysis licensed by the workspace grammar. |
| **MorphTrace: Generate Word Form** | Takes a lemma plus a JSON feature bundle and shows every generated form and its trace. |

Each result shows:

- **Morpheme boundaries** such as `na + tal + mu`
- **Features** such as `number=plural, tense=past`
- **A deterministic trace** of concatenation and every ordered rule
- **Multiple analyses** when the grammar licenses ambiguity, rather than silently guessing

## Quick start

1. Install MorphTrace in Cursor or VS Code.
2. Copy the [synthetic demo grammar](https://github.com/AryanSudhirDev/morphtrace/blob/main/examples/morphtrace.grammar.json) into your workspace as either:
   - `morphtrace.grammar.json`, or
   - `.morphtrace/grammar.json`
3. Select a word and run **MorphTrace: Analyze Selected Word** from the Command Palette.
4. Or run **MorphTrace: Generate Word Form**, enter a lemma, then enter features as JSON, for example:

```json
{"number":"plural","tense":"past"}
```

## Example: synthetic demo

The bundled demo grammar contains invented forms only. Given the synthetic lemma `tal` with plural and past features, it builds the form in clear stages:

```text
na + tal + mu        concatenate morphemes
nat al mu → natadmu  apply the synthetic l → d before mu rule
```

MorphTrace reports the modeled form, features, morphemes, and trace. It does not claim that this example describes a natural language.

## Grammar format

Grammar data lives in JSON and remains separate from the TypeScript engine. A minimal grammar has a lexicon, affixes, and optional ordered rules:

```json
{
  "schemaVersion": 1,
  "id": "my-grammar",
  "label": "My grammar",
  "status": "synthetic-demo",
  "morphology": { "type": "concatenative" },
  "lexicon": [{ "lemma": "tal", "gloss": "observe" }],
  "affixes": [
    { "id": "past-mu", "kind": "suffix", "form": "mu", "features": { "tense": "past" } }
  ],
  "rules": [
    { "id": "example-rule", "operation": "replace", "find": "lmu", "replace": "dmu", "whenFeatures": { "tense": "past" } }
  ]
}
```

Malformed or unsupported grammar files produce clear errors. Unicode text is normalized safely, so grammar data is not limited to English letters.

## Privacy and limits

- **Local only:** selected text and grammar files stay in the workspace. MorphTrace calls no external services and sends no telemetry.
- **No hidden linguistic claims:** a passing software test means the engine followed the supplied rules. It does not prove the rules are linguistically correct.
- **No whole-language claims:** do not label a grammar as real-language support until its data and examples have been reviewed.
- **v1 limitation:** non-concatenative patterns, such as templatic morphology, reduplication, or rich allomorphy, need a deliberate extension rather than an implicit workaround.

Use the repository's [`VALIDATION.md`](https://github.com/AryanSudhirDev/morphtrace/blob/main/VALIDATION.md) template to document data sources, licensing, review, tested forms, and known errors before publishing real-language grammar data.

## Open source

MorphTrace is MIT-licensed. The TypeScript core is independent of Cursor and can also be used from Node.js. Source, examples, and issue tracking are at [github.com/AryanSudhirDev/morphtrace](https://github.com/AryanSudhirDev/morphtrace).
