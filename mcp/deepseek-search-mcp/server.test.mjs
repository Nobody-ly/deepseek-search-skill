import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { createMcpServer } from "./server.mjs";

const serverPath = fileURLToPath(new URL("./server.mjs", import.meta.url));

test("MCP tools pass native requests to the shared CLI and return raw bodies", async (t) => {
	const calls = [];
	const server = createMcpServer(async (operation, request) => {
		calls.push({ operation, request });
		return { code: 0, stdout: JSON.stringify({ ok: true, operation }), stderr: "" };
	});
	const client = new Client({ name: "deepseek-search-test", version: "1.0.0" });
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	t.after(async () => {
		await client.close();
		await server.close();
	});

	await Promise.all([
		server.connect(serverTransport),
		client.connect(clientTransport),
	]);

	const listed = await client.listTools();
	assert.deepEqual(listed.tools.map(({ name }) => name).sort(), ["fetch", "search"]);

	const searchRequest = {
		query: "DeepSeek Search API",
		count: 4,
		ori_question: "How does the official endpoint work?",
		localization: "203.0.113.1",
		need_content: true,
	};
	const search = await client.callTool({ name: "search", arguments: searchRequest });
	const fetch = await client.callTool({
		name: "fetch",
		arguments: { url: "https://api-docs.deepseek.com/guides/search/" },
	});

	assert.deepEqual(calls, [
		{ operation: "search", request: searchRequest },
		{ operation: "fetch", request: { url: "https://api-docs.deepseek.com/guides/search/" } },
	]);
	assert.equal(search.content[0].text, '{"ok":true,"operation":"search"}');
	assert.equal(fetch.content[0].text, '{"ok":true,"operation":"fetch"}');
});

test("API failures are returned as MCP tool errors without rewriting the body", async (t) => {
	const server = createMcpServer(async () => ({
		code: 1,
		stdout: '{"error":"invalid key"}',
		stderr: "DeepSeek API returned HTTP 401.",
	}));
	const client = new Client({ name: "deepseek-search-test", version: "1.0.0" });
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	t.after(async () => {
		await client.close();
		await server.close();
	});
	await Promise.all([
		server.connect(serverTransport),
		client.connect(clientTransport),
	]);

	const result = await client.callTool({ name: "fetch", arguments: { url: "https://example.com" } });
	assert.equal(result.isError, true);
	assert.equal(result.content[0].text, '{"error":"invalid key"}');
});

test("the documented Node entrypoint starts as an MCP stdio server", async (t) => {
	const transport = new StdioClientTransport({
		command: process.execPath,
		args: [serverPath],
		stderr: "pipe",
	});
	const client = new Client({ name: "deepseek-search-stdio-test", version: "1.0.0" });
	t.after(async () => client.close());
	await client.connect(transport);
	const { tools } = await client.listTools();
	assert.deepEqual(tools.map(({ name }) => name).sort(), ["fetch", "search"]);
});
