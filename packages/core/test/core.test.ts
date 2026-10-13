import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { analyze, generate, GrammarValidationError, type Grammar } from "../src/index.js";

const demo = JSON.parse(readFileSync("packages/core/grammars/synthetic-demo.json", "utf8")) as Grammar;

test("generates a deterministic synthetic form with a trace", () => {
  const forms = generate("tal", { number: "plural", tense: "past" }, demo);
  assert.equal(forms.length, 1);
  assert.equal(forms[0].surfaceForm, "natadmu");
  assert.deepEqual(forms[0].morphemes.map((m) => m.form), ["na", "tal", "mu"]);
  assert.deepEqual(forms[0].trace.map((step) => step.id), ["concatenate", "l-before-mu-voices"]);
});

test("analyzes every plausible analysis instead of selecting one", () => {
  const ambiguous: Grammar = { ...demo, lexicon: [{ lemma: "alpha", stem: "x" }, { lemma: "beta", stem: "x" }], affixes: [], rules: [] };
  const results = analyze("x", ambiguous);
  assert.equal(results.length, 2);
  assert.deepEqual(results.map((result) => result.lemma).sort(), ["alpha", "beta"]);
});

test("applies ordered rules deterministically", () => {
  const grammar: Grammar = {
    ...demo,
    lexicon: [{ lemma: "a" }], affixes: [{ id: "suffix", kind: "suffix", form: "b", features: { form: "x" } }],
    rules: [
      { id: "first", operation: "replace", find: "ab", replace: "cb" },
      { id: "second", operation: "replace", find: "cb", replace: "d" }
    ]
  };
  const form = generate("a", { form: "x" }, grammar)[0];
  assert.equal(form.surfaceForm, "d");
  assert.deepEqual(form.trace.map((step) => step.id), ["concatenate", "first", "second"]);
});

test("returns no analysis for an unknown form", () => {
  assert.deepEqual(analyze("unlicensed", demo), []);
});

test("reports malformed grammar files clearly", () => {
  assert.throws(() => generate("tal", {}, { schemaVersion: 1, id: "bad" }), (error: unknown) =>
    error instanceof GrammarValidationError && error.issues.some((issue) => issue.includes("morphology"))
  );
});

test("preserves Unicode input", () => {
  const generated = generate("émi", { tense: "present" }, demo)[0];
  assert.equal(generated.surfaceForm, "émii");
  assert.equal(analyze("e\u0301mii", demo)[0]?.lemma, "émi");
});

test("generated forms analyze back to the intended feature bundle", () => {
  const generated = generate("lum", { number: "plural", tense: "past" }, demo)[0];
  const analyses = analyze(generated.surfaceForm, demo);
  assert.ok(analyses.some((analysis) => analysis.lemma === "lum" && analysis.features.number === "plural" && analysis.features.tense === "past"));
});
