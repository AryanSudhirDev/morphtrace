/** Deterministic, grammar-driven morphology for explicitly modeled concatenative systems. */
export type FeatureValue = string | number | boolean;
export type Features = Record<string, FeatureValue>;
export type AffixKind = "prefix" | "suffix";

export interface Lexeme {
  lemma: string;
  stem?: string;
  features?: Features;
  gloss?: string;
}

export interface Affix {
  id: string;
  kind: AffixKind;
  form: string;
  features: Features;
  order?: number;
  gloss?: string;
}

export interface RewriteRule {
  id: string;
  operation: "replace";
  find: string;
  replace: string;
  whenFeatures?: Features;
  whenLemma?: string;
  note?: string;
}

export interface Grammar {
  schemaVersion: 1;
  id: string;
  label: string;
  status: "synthetic-demo" | "validated-language-data";
  morphology: { type: "concatenative" };
  lexicon: Lexeme[];
  affixes: Affix[];
  rules?: RewriteRule[];
}

export interface TraceStep {
  kind: "morpheme" | "rule";
  id: string;
  input: string;
  output: string;
  explanation: string;
}

export interface Morpheme {
  id: string;
  kind: "stem" | AffixKind;
  form: string;
  gloss?: string;
  features?: Features;
}

export interface GeneratedForm {
  lemma: string;
  surfaceForm: string;
  features: Features;
  morphemes: Morpheme[];
  trace: TraceStep[];
}

export interface Analysis extends GeneratedForm {}

export class GrammarValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Invalid MorphTrace grammar:\n- ${issues.join("\n- ")}`);
    this.name = "GrammarValidationError";
    this.issues = issues;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalized = (value: string): string => value.normalize("NFC");
const sameFeatures = (left: Features = {}, right: Features = {}): boolean =>
  Object.entries(left).every(([key, value]) => right[key] === value);

function validateFeatures(value: unknown, where: string, issues: string[]): void {
  if (!isRecord(value)) { issues.push(`${where} must be an object.`); return; }
  for (const [key, item] of Object.entries(value)) {
    if (!key || !["string", "number", "boolean"].includes(typeof item)) {
      issues.push(`${where}.${key || "<empty>"} must be a string, number, or boolean.`);
    }
  }
}

/** Validate supported v1 grammar shape. Throws clear, aggregated errors. */
export function validateGrammar(grammar: unknown): asserts grammar is Grammar {
  const issues: string[] = [];
  if (!isRecord(grammar)) throw new GrammarValidationError(["Grammar must be an object."]);
  if (grammar.schemaVersion !== 1) issues.push("schemaVersion must be 1.");
  if (typeof grammar.id !== "string" || !grammar.id.trim()) issues.push("id must be a non-empty string.");
  if (typeof grammar.label !== "string" || !grammar.label.trim()) issues.push("label must be a non-empty string.");
  if (grammar.status !== "synthetic-demo" && grammar.status !== "validated-language-data") issues.push("status must be 'synthetic-demo' or 'validated-language-data'.");
  if (!isRecord(grammar.morphology) || grammar.morphology.type !== "concatenative") issues.push("Only morphology.type 'concatenative' is supported in v1.");
  if (!Array.isArray(grammar.lexicon) || grammar.lexicon.length === 0) issues.push("lexicon must contain at least one lexeme.");
  else grammar.lexicon.forEach((entry, index) => {
    if (!isRecord(entry) || typeof entry.lemma !== "string" || !entry.lemma.trim()) issues.push(`lexicon[${index}].lemma must be a non-empty string.`);
    if (isRecord(entry) && entry.stem !== undefined && typeof entry.stem !== "string") issues.push(`lexicon[${index}].stem must be a string.`);
    if (isRecord(entry) && entry.features !== undefined) validateFeatures(entry.features, `lexicon[${index}].features`, issues);
  });
  if (!Array.isArray(grammar.affixes)) issues.push("affixes must be an array.");
  else grammar.affixes.forEach((affix, index) => {
    if (!isRecord(affix)) { issues.push(`affixes[${index}] must be an object.`); return; }
    if (typeof affix.id !== "string" || !affix.id) issues.push(`affixes[${index}].id must be a non-empty string.`);
    if (affix.kind !== "prefix" && affix.kind !== "suffix") issues.push(`affixes[${index}].kind must be 'prefix' or 'suffix'.`);
    if (typeof affix.form !== "string" || !affix.form) issues.push(`affixes[${index}].form must be a non-empty Unicode string.`);
    validateFeatures(affix.features, `affixes[${index}].features`, issues);
    if (typeof affix.order !== "undefined" && (!Number.isFinite(affix.order) || typeof affix.order !== "number")) issues.push(`affixes[${index}].order must be a finite number.`);
  });
  if (grammar.rules !== undefined && !Array.isArray(grammar.rules)) issues.push("rules must be an array.");
  else (grammar.rules ?? []).forEach((rule, index) => {
    if (!isRecord(rule)) { issues.push(`rules[${index}] must be an object.`); return; }
    if (typeof rule.id !== "string" || !rule.id) issues.push(`rules[${index}].id must be a non-empty string.`);
    if (rule.operation !== "replace") issues.push(`rules[${index}].operation must be 'replace'.`);
    if (typeof rule.find !== "string" || !rule.find) issues.push(`rules[${index}].find must be a non-empty string.`);
    if (typeof rule.replace !== "string") issues.push(`rules[${index}].replace must be a string.`);
    if (rule.whenFeatures !== undefined) validateFeatures(rule.whenFeatures, `rules[${index}].whenFeatures`, issues);
    if (rule.whenLemma !== undefined && typeof rule.whenLemma !== "string") issues.push(`rules[${index}].whenLemma must be a string.`);
  });
  if (issues.length) throw new GrammarValidationError(issues);
}

function selectedAffixes(features: Features, grammar: Grammar): Affix[] {
  return grammar.affixes
    .filter((affix) => sameFeatures(affix.features, features))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
}

function applies(rule: RewriteRule, lemma: string, features: Features): boolean {
  return (!rule.whenLemma || rule.whenLemma === lemma) && sameFeatures(rule.whenFeatures, features);
}

/** Generate every explicitly licensed form for a lemma and feature bundle. */
export function generate(lemma: string, features: Features, grammar: unknown): GeneratedForm[] {
  validateGrammar(grammar);
  if (typeof lemma !== "string" || !lemma.trim()) throw new TypeError("lemma must be a non-empty string.");
  if (!isRecord(features)) throw new TypeError("features must be an object.");
  const requested = Object.fromEntries(Object.entries(features));
  const entries = grammar.lexicon.filter((entry) => normalized(entry.lemma) === normalized(lemma) && sameFeatures(entry.features, requested));
  if (!entries.length) return [];
  const affixes = selectedAffixes(requested, grammar);
  return entries.map((entry) => {
    const prefixes = affixes.filter((affix) => affix.kind === "prefix");
    const suffixes = affixes.filter((affix) => affix.kind === "suffix");
    const stem = normalized(entry.stem ?? entry.lemma);
    let current = normalized(`${prefixes.map((a) => a.form).join("")}${stem}${suffixes.map((a) => a.form).join("")}`);
    const morphemes: Morpheme[] = [
      ...prefixes.map((a) => ({ id: a.id, kind: a.kind, form: normalized(a.form), gloss: a.gloss, features: a.features })),
      { id: `lexeme:${entry.lemma}`, kind: "stem" as const, form: stem, gloss: entry.gloss, features: entry.features },
      ...suffixes.map((a) => ({ id: a.id, kind: a.kind, form: normalized(a.form), gloss: a.gloss, features: a.features }))
    ];
    const trace: TraceStep[] = [{ kind: "morpheme", id: "concatenate", input: "", output: current, explanation: "Concatenate ordered prefixes, stem, and suffixes." }];
    for (const rule of grammar.rules ?? []) {
      if (!applies(rule, entry.lemma, requested)) continue;
      const next = normalized(current.replace(rule.find, rule.replace));
      trace.push({ kind: "rule", id: rule.id, input: current, output: next, explanation: rule.note ?? `Replace '${rule.find}' with '${rule.replace}'.` });
      current = next;
    }
    return { lemma: entry.lemma, surfaceForm: current, features: requested, morphemes, trace };
  });
}

function candidateFeatureBundles(grammar: Grammar): Features[] {
  const values = new Map<string, FeatureValue[]>();
  for (const affix of grammar.affixes) for (const [key, value] of Object.entries(affix.features)) {
    const list = values.get(key) ?? [];
    if (!list.some((existing) => existing === value)) list.push(value);
    values.set(key, list);
  }
  let bundles: Features[] = [{}];
  for (const [key, options] of [...values.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    bundles = bundles.flatMap((bundle) => [bundle, ...options.map((value) => ({ ...bundle, [key]: value }))]);
  }
  return bundles;
}

/** Return every analysis licensed by the grammar. An empty array means no analysis was found. */
export function analyze(surfaceForm: string, grammar: unknown): Analysis[] {
  validateGrammar(grammar);
  if (typeof surfaceForm !== "string" || !surfaceForm.trim()) throw new TypeError("surfaceForm must be a non-empty string.");
  const target = normalized(surfaceForm);
  const analyses: Analysis[] = [];
  const seen = new Set<string>();
  for (const entry of grammar.lexicon) {
    for (const features of candidateFeatureBundles(grammar)) {
      for (const form of generate(entry.lemma, features, grammar)) {
        if (form.surfaceForm !== target) continue;
        const key = `${form.lemma}|${JSON.stringify(form.features)}|${form.surfaceForm}`;
        if (!seen.has(key)) { seen.add(key); analyses.push(form); }
      }
    }
  }
  return analyses;
}
