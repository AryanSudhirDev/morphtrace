#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { checkSummary } from "./index.js";
const args=process.argv.slice(2);const value=(flag:string)=>args[args.indexOf(flag)+1];
if(args.includes("--help")||!value("--conversation")||!value("--summary")){console.error("Usage: contextcheck --conversation source.json|source.txt --summary summary.txt [--format json|text]");process.exit(args.includes("--help")?0:2);}
const sourcePath=value("--conversation")!,summaryPath=value("--summary")!;const sourceRaw=await readFile(sourcePath,"utf8"),summary=await readFile(summaryPath,"utf8");let source:unknown=sourceRaw;try{source=JSON.parse(sourceRaw);}catch{}const result=checkSummary(source,summary);console.log(value("--format")==="text"?result.readableReport:JSON.stringify(result,null,2));
