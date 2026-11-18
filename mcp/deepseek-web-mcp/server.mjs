#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";
import { runCli } from "../../skills/deepseek-web/scripts/deepseek-web.mjs";

const inputSchema = JSON.parse(await readFile(
	new URL("../../skills/deepseek-web/references/request.schema.json", import.meta.url), "utf8",
));

export function createMcpServer(runCliImpl = runCli) {
	const server = new Server({ name: "deepseek-web", version: "0.1.0" }, { capabilities: { tools: {} } });
	server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [{
		name: "web",
		description: "Call DeepSeek's official Web Tools using native Chat Completions fields. Use model deepseek-flash. Declare deepseek_web_search in tools with thinking disabled for web search or enabled for deep search; declare deepseek_read_url to read URLs in messages. Returns the raw completion body, including the generated answer, citations, server tool records and usage. Non-streaming only. Model tokens and tool use are billed. No defaults, prompts, result processing, research loop or retries are added.",
		inputSchema,
		annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
	}] }));

	server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
		if (params.name !== "web") throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${params.name}`);
		const stdout = [];
		let stderr = "";
		const code = await runCliImpl({
			argv: [],
			stdin: Readable.from([JSON.stringify(params.arguments ?? {})]),
			stdout: { write: (chunk) => stdout.push(Buffer.from(chunk)) },
			stderr: { write: (chunk) => (stderr += chunk) },
		});
		const content = [{ type: "text", text: Buffer.concat(stdout).toString("utf8") || stderr }];
		return code === 0 ? { content } : { content, isError: true };
	});
	return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	await createMcpServer().connect(new StdioServerTransport());
}
