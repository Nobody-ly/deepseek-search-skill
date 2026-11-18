import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createMcpServer } from "./server.mjs";

const serverPath = fileURLToPath(new URL("./server.mjs", import.meta.url));
const schema = JSON.parse(await readFile(
	new URL("../../skills/deepseek-web/references/request.schema.json", import.meta.url), "utf8",
));

async function connect(t, runCliImpl) {
	const server = createMcpServer(runCliImpl);
	const client = new Client({ name: "web-test", version: "1.0.0" });
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	t.after(async () => { await client.close(); await server.close(); });
	await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
	return client;
}

test("Web MCP advertises the shared native schema and forwards all three modes without defaults", async (t) => {
	const seen = [];
	const raw = ' \n{"choices":[{"message":{"content":"原始回答","server_tool_calls":[{"calls":[{"signature":"opaque"}]}]}}],"future":true}\n';
	const client = await connect(t, async ({ argv, stdin, stdout }) => {
		assert.deepEqual(argv, []);
		let body = "";
		for await (const chunk of stdin) body += chunk;
		seen.push(JSON.parse(body));
		stdout.write(Buffer.from(raw));
		return 0;
	});
	const { tools } = await client.listTools();
	assert.deepEqual(tools.map(tool => tool.name), ["web"]);
	assert.deepEqual(tools[0].inputSchema, schema);
	assert.deepEqual(tools[0].annotations, {
		readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true,
	});
	for (const example of schema.examples) {
		const request = { ...example, provider_extension: { future: "保留" } };
		const result = await client.callTool({ name: "web", arguments: request });
		assert.equal(result.content[0].text, raw);
		assert.notEqual(result.isError, true);
		assert.deepEqual(seen.at(-1), request);
	}
	assert.equal(seen.length, 3);
	await assert.rejects(() => client.callTool({ name: "unknown", arguments: {} }), /Unknown tool/);
	assert.equal(seen.length, 3);
});

test("Web MCP maps upstream errors and local diagnostics without rewriting the response", async (t) => {
	let raw = ' {"error":{"message":"upstream failure"}}\n';
	const client = await connect(t, async ({ stdout, stderr }) => {
		if (raw) stdout.write(raw);
		stderr.write("Safe local diagnostic.\n");
		return 1;
	});
	let result = await client.callTool({ name: "web", arguments: schema.examples[0] });
	assert.equal(result.isError, true);
	assert.equal(result.content[0].text, raw);
	raw = "";
	result = await client.callTool({ name: "web", arguments: schema.examples[0] });
	assert.equal(result.isError, true);
	assert.equal(result.content[0].text, "Safe local diagnostic.\n");
});

test("real MCP stdio entrypoint uses the shared CLI and local HTTP from an unrelated directory", async (t) => {
	const temp = await mkdtemp(join(tmpdir(), "deepseek-web-mcp-"));
	const seen = [];
	const raw = ' \n{"choices":[{"finish_reason":"length","message":{"content":"中文回答","annotations":[],"server_tool_calls":[]}}],"usage":{"server_tool_use":{"tool_search":1}}}\n';
	const error = ' {"error":{"message":"HTTP error unchanged"}}\n';
	const http = createServer(async (req, res) => {
		let body = "";
		for await (const chunk of req) body += chunk;
		const parsed = JSON.parse(body);
		seen.push({ url: req.url, auth: req.headers.authorization, request: parsed });
		res.writeHead(parsed.model === "test-error" ? 429 : 200, { "Content-Type": "application/json" });
		res.end(parsed.model === "test-error" ? error : raw);
	});
	http.listen(0, "127.0.0.1");
	await once(http, "listening");
	const transport = new StdioClientTransport({
		command: process.execPath, args: [serverPath], cwd: temp, stderr: "pipe",
		env: { ...process.env, USERPROFILE: temp, HOME: temp, DEEPSEEK_API_KEY: "local-mcp-key",
			DEEPSEEK_BASE_URL: `http://127.0.0.1:${http.address().port}/v1` },
	});
	const client = new Client({ name: "web-stdio-test", version: "1.0.0" });
	t.after(async () => {
		await client.close();
		http.closeAllConnections();
		await new Promise(resolve => http.close(resolve));
		await rm(temp, { recursive: true, force: true });
	});
	await client.connect(transport);
	assert.deepEqual((await client.listTools()).tools[0].inputSchema, schema);
	for (const example of schema.examples) {
		const request = { ...example, messages: [{ role: "user", content: "读取链接并用中文回答。" }], extra: { keep: true } };
		const result = await client.callTool({ name: "web", arguments: request });
		assert.equal(result.content[0].text, raw);
		assert.notEqual(result.isError, true);
		assert.deepEqual(seen.at(-1), { url: "/v1/chat/completions", auth: "Bearer local-mcp-key", request });
	}
	const failed = await client.callTool({ name: "web", arguments: { ...schema.examples[0], model: "test-error" } });
	assert.equal(failed.isError, true);
	assert.equal(failed.content[0].text, error);
	assert.equal(seen.length, 4);
	const streaming = await client.callTool({ name: "web", arguments: { ...schema.examples[0], stream: true } });
	assert.equal(streaming.isError, true);
	assert.match(streaming.content[0].text, /non-streaming/);
	assert.equal(seen.length, 4);
});
