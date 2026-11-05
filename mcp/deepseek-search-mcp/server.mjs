#!/usr/bin/env node

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const cliPath = fileURLToPath(
	new URL("../../skills/deepseek-search/scripts/deepseek-search.mjs", import.meta.url),
);

function callCli(operation, request) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [cliPath, operation], {
			stdio: ["pipe", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";

		child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
		child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
		child.once("error", reject);
		child.once("close", (code) => resolve({ code, stdout, stderr }));
		child.stdin.end(JSON.stringify(request));
	});
}

function toolResult(result) {
	const content = [{ type: "text", text: result.stdout || result.stderr || "" }];
	return result.code === 0 ? { content } : { content, isError: true };
}

export function createMcpServer(runCliImpl = callCli) {
	const server = new McpServer({ name: "deepseek-search", version: "1.0.0" });
	const optionalString = z.string().optional();

	server.registerTool(
		"search",
		{
			description: "Search the web using DeepSeek's official Search API and return its raw JSON response.",
			inputSchema: z.object({
				query: z.string().min(1).max(128),
				count: z.number().int().min(1).max(50).optional(),
				ori_question: z.string().min(1).max(128).nullable().optional(),
				localization: optionalString,
				need_content: z.boolean().optional(),
			}).passthrough(),
		},
		async (request) => toolResult(await runCliImpl("search", request)),
	);

	server.registerTool(
		"fetch",
		{
			description: "Fetch a web page using DeepSeek's official Fetch API and return its raw JSON response.",
			inputSchema: z.object({
				url: z.string().min(1).max(8192),
			}).passthrough(),
		},
		async (request) => toolResult(await runCliImpl("fetch", request)),
	);

	return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	const server = createMcpServer();
	await server.connect(new StdioServerTransport());
}
