import * as vscode from "vscode";
import { analyze, generate, validateGrammar, type Analysis, type Features, type GeneratedForm, type Grammar } from "@morphtrace/core";

const GRAMMAR_CANDIDATES = ["morphtrace.grammar.json", ".morphtrace/grammar.json"];

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

async function loadGrammar(): Promise<Grammar> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) throw new Error("Open a workspace folder and add morphtrace.grammar.json or .morphtrace/grammar.json.");
  const configured = vscode.workspace.getConfiguration("morphtrace", folder.uri).get<string>("grammarPath", "").trim();
  const candidates = configured ? [configured] : GRAMMAR_CANDIDATES;
  for (const candidate of candidates) {
    const uri = vscode.Uri.joinPath(folder.uri, ...candidate.split("/"));
    try {
      const contents = new TextDecoder("utf-8", { fatal: true }).decode(await vscode.workspace.fs.readFile(uri));
      const parsed: unknown = JSON.parse(contents);
      validateGrammar(parsed);
      return parsed;
    } catch (error) {
      if ((error as { code?: string }).code === "FileNotFound") continue;
      throw new Error(`Could not load ${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error("No valid MorphTrace grammar is present. Add morphtrace.grammar.json or .morphtrace/grammar.json. Start from the synthetic demo, then complete VALIDATION.md before making real-language claims.");
}

function resultHtml(title: string, results: GeneratedForm[]): string {
  const body = results.length === 0 ? "<p>No analysis or generated form is licensed by this grammar.</p>" : results.map((result, index) => {
    const features = Object.entries(result.features).map(([key, value]) => `${escapeHtml(key)}=${escapeHtml(value)}`).join(", ") || "none";
    const morphemes = result.morphemes.map((morpheme) => `${escapeHtml(morpheme.form)}${morpheme.gloss ? ` (${escapeHtml(morpheme.gloss)})` : ""}`).join(" + ");
    const trace = result.trace.map((step) => `<li><code>${escapeHtml(step.input)} → ${escapeHtml(step.output)}</code><br>${escapeHtml(step.id)}: ${escapeHtml(step.explanation)}</li>`).join("");
    return `<section><h2>Result ${index + 1}: ${escapeHtml(result.surfaceForm)}</h2><p><strong>Lemma:</strong> ${escapeHtml(result.lemma)}<br><strong>Features:</strong> ${features}<br><strong>Morphemes:</strong> ${morphemes}</p><h3>Rule trace</h3><ol>${trace}</ol></section>`;
  }).join("<hr>");
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font:14px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.45;padding:0 16px}code{white-space:pre-wrap}section{margin:18px 0}h1{font-size:1.35rem}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
}

function showResults(title: string, results: GeneratedForm[]): void {
  const panel = vscode.window.createWebviewPanel("morphtrace.results", "MorphTrace Results", vscode.ViewColumn.Beside, { enableScripts: false, retainContextWhenHidden: true });
  panel.webview.html = resultHtml(title, results);
}

async function analyzeSelectedWord(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  const selected = editor?.document.getText(editor.selection).trim();
  if (!selected) { vscode.window.showInformationMessage("MorphTrace: select a word or surface form first."); return; }
  try {
    const grammar = await loadGrammar();
    showResults(`Analyses for ${selected}`, analyze(selected, grammar) as Analysis[]);
  } catch (error) {
    vscode.window.showErrorMessage(`MorphTrace: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function generateWordForm(): Promise<void> {
  const lemma = await vscode.window.showInputBox({ prompt: "Lemma", placeHolder: "Enter a lemma from the workspace grammar" });
  if (!lemma?.trim()) return;
  const featureText = await vscode.window.showInputBox({ prompt: "Feature bundle as JSON", value: "{}", placeHolder: '{"tense":"past","number":"plural"}' });
  if (featureText === undefined) return;
  try {
    const features: unknown = JSON.parse(featureText);
    if (!features || typeof features !== "object" || Array.isArray(features)) throw new Error("Feature bundle must be a JSON object.");
    const grammar = await loadGrammar();
    showResults(`Generated forms for ${lemma}`, generate(lemma, features as Features, grammar));
  } catch (error) {
    vscode.window.showErrorMessage(`MorphTrace: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("morphtrace.analyzeSelectedWord", analyzeSelectedWord),
    vscode.commands.registerCommand("morphtrace.generateWordForm", generateWordForm)
  );
}

export function deactivate(): void {}
