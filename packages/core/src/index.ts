/** ContextCheck v1: a local deterministic baseline for a documented subset of instruction language. */
export type Role = "user" | "assistant" | "tool" | "system" | "unknown";
export type Modality = "prohibition" | "permission" | "requirement" | "unsupported";
export type FindingCategory = "preserved" | "potentially-omitted-constraint" | "direct-contradiction" | "permission-becoming-obligation" | "changed-condition-or-scope" | "unsupported-addition" | "uncertain-interpretation";
export interface Message { id: string; role: Role; text: string }
export interface Conversation { messages: Message[]; roleInformationAvailable: boolean; inputKind: "structured" | "plain" }
export interface Span { messageId: string; start: number; end: number; text: string }
export interface Instruction { id: string; actor?: string; action: string; target?: string; modality: Modality; condition?: string; scope?: string; exception?: string; source: Span; unresolved: string[]; supersededBy?: string }
export interface Finding { id: string; category: FindingCategory; explanation: string; sourceInstructionIds: string[]; sourceSpans: Span[]; summarySpans: Span[]; confidence: "limited"; reviewLabel?: ReviewLabel }
export type ReviewLabel = "confirmed-issue" | "acceptable-paraphrase" | "false-alarm" | "needs-clarification";
export interface CheckResult { version: "1"; conversation: Conversation; candidateSummary: string; sourceInstructions: Instruction[]; summaryInstructions: Instruction[]; findings: Finding[]; limitations: string[]; readableReport: string }
/** Optional boundary for future model assistance. No adapter ships or runs in v1. */
export interface ModelExtractionAdapter { extract(input:{conversation:Conversation;candidateSummary:string}):Promise<{source:Instruction[];summary:Instruction[]}> }
/** Rejects any external/model evidence span that is not an exact span of the supplied input. */
export function validateEvidenceSpans(conversation:Conversation,candidateSummary:string,instructions:Instruction[],kind:"source"|"summary"):Instruction[]{const messageMap=new Map(conversation.messages.map(m=>[m.id,m.text]));return instructions.filter(item=>{const text=kind==="summary"?(item.source.messageId==="summary"?candidateSummary:undefined):messageMap.get(item.source.messageId);return !!text&&item.source.start>=0&&item.source.end>=item.source.start&&item.source.end<=text.length&&text.slice(item.source.start,item.source.end)===item.source.text;});}
export class InputError extends Error { constructor(message: string) { super(message); this.name="InputError"; } }

const clean=(text:string)=>text.normalize("NFC").replace(/\s+/g," ").trim();
const normalizeAction=(text:string)=>clean(text.toLowerCase()).replace(/^(to )/,"").replace(/\b(deployment|deploying|deployed)\b/g,"deploy").replace(/\b(updating|updated)\b/g,"update").replace(/\b(running|ran)\b/g,"run").replace(/\b(preparing|prepared)\b/g,"prepare").replace(/\b(the|a|an)\b/g," ").replace(/\s+/g," ").trim();
const same=(a?:string,b?:string)=>!!a&&!!b&&normalizeAction(a)===normalizeAction(b);
const overlap=(a?:string,b?:string)=>!!a&&!!b&&(normalizeAction(a).includes(normalizeAction(b))||normalizeAction(b).includes(normalizeAction(a)));
const role=(value:unknown):Role=>["user","assistant","tool","system"].includes(String(value))?String(value) as Role:"unknown";

/** Accepts structured messages or plain text supplied explicitly by a user. */
export function loadConversation(input: unknown): Conversation {
 if(typeof input==="string") return {inputKind:"plain",roleInformationAvailable:false,messages:[{id:"plain-1",role:"unknown",text:input}]};
 if(!input||typeof input!=="object"||!Array.isArray((input as {messages?:unknown}).messages)) throw new InputError("Conversation must be plain text or JSON with a messages array.");
 const messages=(input as {messages:unknown[]}).messages.map((item,index)=>{
  if(!item||typeof item!=="object") throw new InputError(`messages[${index}] must be an object.`);
  const x=item as {id?:unknown;role?:unknown;text?:unknown;content?:unknown};const text=typeof x.text==="string"?x.text:typeof x.content==="string"?x.content:undefined;
  if(text===undefined) throw new InputError(`messages[${index}] needs text.`);
  return {id:typeof x.id==="string"&&x.id?x.id:`message-${index+1}`,role:role(x.role),text};
 });
 if(!messages.length) throw new InputError("Conversation.messages cannot be empty.");
 return {inputKind:"structured",roleInformationAvailable:messages.every(m=>m.role!=="unknown"),messages};
}

function parts(message:Message): Array<{text:string;start:number}> {
 const result:Array<{text:string;start:number}>=[];const re=/[^.!?\n]+(?:[.!?]+|$)/g;let match:RegExpExecArray|null;
 while((match=re.exec(message.text))) { const raw=match[0]; let cursor=0; for(const clause of raw.split(/,\s*(?:but|and)\s+(?=(?:do not|never|must|may|can|deploy|prepare|run|update|delete|publish|send|install|change|execute)\b)/i)){const offset=clause.search(/\S/);if(offset>=0) result.push({text:clause.trim(),start:match.index+cursor+offset});cursor+=clause.length+2;} }
 return result;
}
function instruction(id:string, message:Message, start:number, raw:string, modality:Modality, action:string, condition?:string, scope?:string, exception?:string, unresolved:string[]=[]):Instruction {
 const actionClean=clean(action); let target:string|undefined;const m=actionClean.match(/^(deploy|prepare|run|update|delete|publish|send|install|change|execute)\s+(.+)$/i); if(m) target=clean(m[2]);
 if(/\b(it|this|that|them)\b/i.test(actionClean)) unresolved.push("Action target contains an unresolved reference.");
 return {id,actor:"user",action:actionClean,target,modality,condition:condition&&clean(condition),scope:scope&&clean(scope),exception:exception&&clean(exception),source:{messageId:message.id,start,end:start+raw.length,text:raw},unresolved};
}
/** Extracts only documented v1 patterns. Quoted/example text and non-user source messages are excluded. */
export function extractInstructions(conversation:Conversation, mode:"source"|"summary"="source"):Instruction[] {
 const out:Instruction[]=[];let count=0;
 for(const message of conversation.messages){
  if(mode==="source"&&["assistant","tool","system"].includes(message.role)) continue;
  for(const piece of parts(message)){
   const t=piece.text; if(/^(?:example|original|summary|quote)\s*:/i.test(t)||/^\s*["“]/.test(t)) continue;
   const add=(modality:Modality,action:string,condition?:string,scope?:string,exception?:string,unresolved:string[]=[])=>out.push(instruction(`${mode}-${++count}`,message,piece.start,t,modality,action,condition,scope,exception,unresolved));
   let m:RegExpMatchArray|null;
   if((m=t.match(/^(?:.*?\b)?do not\s+(.+?)\s+until\s+(.+?)[.!?]?$/i))) {add("prohibition",m[1],m[2]);continue;}
   if((m=t.match(/^(?:please\s+)?do not\s+(.+?)\s+(?:except|unless)\s+(.+?)[.!?]?$/i))) {add("prohibition",m[1],undefined,undefined,m[2]);continue;}
   if((m=t.match(/^(?:please\s+)?(?:do not|never)\s+(.+?)[.!?]?$/i))) {add("prohibition",m[1]);continue;}
   if((m=t.match(/^(?:you\s+)?(?:may|can|are allowed to)\s+(.+?)[.!?]?$/i))) {add("permission",m[1]);continue;}
   if((m=t.match(/^(.+?)\s+(?:requires|require)\s+(.+?)[.!?]?$/i))) {add("requirement",m[1],m[2]);continue;}
   if((m=t.match(/^(.+?)\s+only\s+after\s+(.+?)[.!?]?$/i))) {add("requirement",m[1],m[2]);continue;}
   if((m=t.match(/^(.+?)\s+only\s+in\s+(.+?)[.!?]?$/i))) {add("requirement",m[1],undefined,m[2]);continue;}
   if((m=t.match(/^(?:please\s+)?(?:must|need to|have to)\s+(.+?)[.!?]?$/i))) {add("requirement",m[1]);continue;}
   // Summary imperatives are claims about what an agent should do; source imperatives are user requirements.
   if((m=t.match(/^(?:please\s+)?(prepare|run|deploy|update|delete|publish|send|install|change|execute)(?:\s+(.+?))?[.!?]?$/i))) {add("requirement",`${m[1]}${m[2]?` ${m[2]}`:""}`);continue;}
   if(/\b(do not|must|may|requires|only after|only in|unless|except|perhaps|maybe|if it feels)\b/i.test(t)) add("unsupported",t,undefined,undefined,undefined,["This construction is outside ContextCheck v1's deterministic patterns."]);
  }
 }
 // Resolve a local pronoun only when the immediately preceding modeled instruction gives a target.
 for(let i=1;i<out.length;i++){const previous=out[i-1],current=out[i];if(previous.source.messageId===current.source.messageId&&previous.target&&/\b(it|this|that|them)\b/i.test(current.action)){current.action=current.action.replace(/\b(it|this|that|them)\b/i,previous.target);current.target=previous.target;current.unresolved=current.unresolved.filter(x=>!x.includes("unresolved reference"));}}
 // A later user instruction about the same action supersedes an earlier incompatible one.
 for(let i=0;i<out.length;i++) for(let j=i+1;j<out.length;j++) if(overlap(out[i].action,out[j].action)&&out[i].modality!==out[j].modality) {out[i].supersededBy=out[j].id;break;}
 return out;
}
function canonicalCondition(value:string){const raw=clean(value.toLowerCase()).replace(/[’']/g,"");if(/^i approve\b/.test(raw)||/^the users approval\b/.test(raw)||/^users approval\b/.test(raw))return "user approval";return normalizeAction(raw);}
function compatibleCondition(source:Instruction,summary:Instruction){return !source.condition||!!summary.condition&&canonicalCondition(source.condition)===canonicalCondition(summary.condition);}
function candidateFor(source:Instruction, summaries:Instruction[]){return summaries.filter(s=>overlap(source.action,s.action));}
function finding(category:FindingCategory, explanation:string, source:Instruction[], summary:Instruction[]=[]):Finding {return {id:`finding-${category}-${source.map(s=>s.id).join("-")||"none"}-${summary.map(s=>s.id).join("-")||"none"}`,category,explanation,sourceInstructionIds:source.map(s=>s.id),sourceSpans:source.map(s=>s.source),summarySpans:summary.map(s=>s.source),confidence:"limited"};}
/** Compare explicit instruction structures. It is not general natural-language understanding. */
export function compareInstructions(source:Instruction[], summary:Instruction[], uncertainRoles:boolean):Finding[] {
 const findings:Finding[]=[];const matched=new Set<string>();
 for(const original of source.filter(x=>!x.supersededBy&&x.modality!=="unsupported")){
  const candidates=candidateFor(original,summary);const usable=candidates.filter(c=>c.modality!=="unsupported");
  if(original.unresolved.length||uncertainRoles){findings.push(finding("uncertain-interpretation",`Cannot safely resolve '${original.source.text}'${uncertainRoles?" because source role information is absent.":" because it contains an unresolved reference."}`,[original],usable));continue;}
  if(!usable.length){findings.push(finding("potentially-omitted-constraint",`The summary does not preserve the explicit ${original.modality} in: “${original.source.text}”.`,[original]));continue;}
  const s=usable[0];matched.add(s.id);
  if(original.scope&&!same(original.scope,s.scope)){findings.push(finding("changed-condition-or-scope",`The source restricts ${original.action} to “${original.scope}”, but the summary uses “${s.scope??"no stated scope"}”.`,[original],[s]));continue;}
  if(original.exception&&s.modality==="prohibition"&&!same(original.exception,s.exception)){findings.push(finding("changed-condition-or-scope",`The source has the explicit exception “${original.exception}”, but the summary uses “${s.exception??"no stated exception"}”.`,[original],[s]));continue;}
  if(!compatibleCondition(original,s)){ findings.push(finding("changed-condition-or-scope",`The condition for ${original.action} changed or disappeared: “${original.condition}” versus “${s.condition??"none"}”.`,[original],[s]));continue;}
  const conditionEquivalent=original.modality==="prohibition"&&!!original.condition&&s.modality==="requirement";
  if(original.modality==="permission"&&s.modality==="requirement"){findings.push(finding("permission-becoming-obligation",`The source permits ${original.action}; the summary turns it into a requirement.`,[original],[s]));continue;}
  if(original.modality==="prohibition"&&s.modality==="requirement"&&!conditionEquivalent){findings.push(finding("direct-contradiction",`The source prohibits ${original.action}; the summary requires it.`,[original],[s]));continue;}
  if(original.modality==="requirement"&&s.modality==="permission"){findings.push(finding("potentially-omitted-constraint",`The source requires ${original.action}; the summary only permits it.`,[original],[s]));continue;}
  if(original.modality!==s.modality&&!conditionEquivalent){findings.push(finding("uncertain-interpretation",`The source and summary use different modalities for ${original.action}; v1 cannot resolve this pair safely.`,[original],[s]));continue;}
  findings.push(finding("preserved",`The summary preserves the modeled ${original.modality}${original.condition?` and condition “${original.condition}”`:""} for ${original.action}.`,[original],[s]));
 }
 for(const addition of summary.filter(x=>x.modality!=="unsupported"&&!matched.has(x.id))){
  const related=source.some(s=>overlap(s.action,addition.action));if(!related) findings.push(finding("unsupported-addition",`The summary adds “${addition.source.text}”, which is not supported by a modeled user instruction.`,[],[addition]));
 }
 for(const unsupported of [...source,...summary].filter(x=>x.modality==="unsupported")) findings.push(finding("uncertain-interpretation",`ContextCheck v1 abstains on: “${unsupported.source.text}”.`,[unsupported]));
 return findings;
}
export function formatReport(result:Omit<CheckResult,"readableReport">):string {const counts=result.findings.reduce<Record<string,number>>((a,f)=>(a[f.category]=(a[f.category]??0)+1,a),{});return [`ContextCheck v1 review`,`${result.findings.length} findings: ${Object.entries(counts).map(([k,v])=>`${v} ${k}`).join(", ")||"none"}.`,"",...result.findings.map((f,i)=>`${i+1}. [${f.category}] ${f.explanation}\n   Source: ${f.sourceSpans.map(s=>`“${s.text}”`).join("; ")||"none"}\n   Summary: ${f.summarySpans.map(s=>`“${s.text}”`).join("; ")||"none"}`),"",`Limitations: ${result.limitations.join(" ")}`].join("\n");}
export function checkSummary(conversationInput:unknown,candidateSummary:string):CheckResult {if(typeof candidateSummary!=="string"||!candidateSummary.trim()) throw new InputError("candidateSummary must be non-empty text.");const conversation=loadConversation(conversationInput);const sourceInstructions=extractInstructions(conversation,"source");const summaryConversation:Conversation={inputKind:"plain",roleInformationAvailable:true,messages:[{id:"summary",role:"user",text:candidateSummary}]};const summaryInstructions=extractInstructions(summaryConversation,"summary");const limitations=["Deterministic v1 covers only selected prohibition, permission, requirement, condition, scope, and exception patterns.","It does not guarantee summary correctness or agent safety.","Quoted examples, assistant proposals, and tool output are excluded from source instruction extraction.",...(conversation.roleInformationAvailable?[]:["Source role information is unavailable; findings based on plain text are marked uncertain."])];const partial:Omit<CheckResult,"readableReport">={version:"1",conversation,candidateSummary,sourceInstructions,summaryInstructions,findings:compareInstructions(sourceInstructions,summaryInstructions,!conversation.roleInformationAvailable),limitations};return {...partial,readableReport:formatReport(partial)};}
