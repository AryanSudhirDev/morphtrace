#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkSummary } from "@contextcheck/core";

const server=new McpServer({name:"contextcheck",version:"0.1.0"});
server.registerTool("check_summary",{title:"Check Summary Against Conversation",description:"Locally compare a candidate handoff summary with structured JSON messages or explicitly supplied plain text. Returns deterministic, evidence-backed, limited-scope findings; it is not a safety guarantee.",inputSchema:{conversation:z.union([z.string(),z.object({messages:z.array(z.object({id:z.string().optional(),role:z.string().optional(),text:z.string().optional(),content:z.string().optional()}))})]),candidateSummary:z.string()}},async({conversation,candidateSummary})=>{const result=checkSummary(conversation,candidateSummary);return {content:[{type:"text",text:result.readableReport}],structuredContent:result as unknown as Record<string,unknown>};});
await server.connect(new StdioServerTransport());
