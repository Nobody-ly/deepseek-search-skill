import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { runCli } from "../skills/deepseek-web/scripts/deepseek-web.mjs";

const skillDir = fileURLToPath(new URL("../skills/deepseek-web/", import.meta.url));
const schema = JSON.parse(await readFile(join(skillDir, "references", "request.schema.json"), "utf8"));

async function invoke({
	body = JSON.stringify(schema.examples[0]),
	argv = [],
	env = { DEEPSEEK_API_KEY: "test-key" },
	home = join(tmpdir(), `deepseek-web-absent-${randomUUID()}`),
	fetchImpl = async () => assert.fail("Unexpected HTTP request"),
} = {}) {
	const stdout = [];
	let stderr = "";
	const code = await runCli({
		argv, env, home, fetchImpl,
		stdin: Readable.from([body]),
		stdout: { write: (chunk) => stdout.push(Buffer.from(chunk)) },
		stderr: { write: (chunk) => (stderr += chunk) },
	});
	return { code, stdout: Buffer.concat(stdout), stderr };
}

test("all three native examples are forwarded in one request without defaults or result rewriting", async () => {
	for (const request of schema.examples) {
		request.provider_extension = { future: true };
		const body = `${JSON.stringify(request, null, 2)}\n`;
		const rawResponse = Buffer.from(' \n{"choices":[{"finish_reason":"stop","message":{"content":"回答","annotations":[{"type":"url_citation","url_citation":{"url":"https://example.com"}}],"server_tool_calls":[{"calls":[{"signature":"opaque","kind":"read_link"}]}]}}],"usage":{"server_tool_use":{"tool_search":2}},"future_field":true}\n');
		let calls = 0;
		const result = await invoke({
			body,
			fetchImpl: async (url, options) => {
				calls++;
				assert.equal(url, "https://api.deepseek.com/chat/completions");
				assert.equal(options.method, "POST");
				assert.equal(options.headers.Authorization, "Bearer test-key");
				assert.equal(options.headers["Content-Type"], "application/json");
				assert.equal(options.redirect, "error");
				assert.equal(options.body, body);
				return new Response(rawResponse);
			},
		});
		assert.equal(calls, 1);
		assert.equal(result.code, 0);
		assert.equal(result.stderr, "");
		assert.deepEqual(result.stdout, rawResponse);
		delete request.provider_extension;
	}
});

test("HTTP errors preserve their body and are not retried", async () => {
	for (const status of [400, 401, 402, 429, 503]) {
		let calls = 0;
		const raw = ` {"error":{"message":"upstream error","code":"test-${status}"}}\n`;
		const result = await invoke({ fetchImpl: async () => {
			calls++;
			return new Response(raw, { status });
		} });
		assert.equal(result.code, 1);
		assert.equal(calls, 1);
		assert.equal(result.stdout.toString(), raw);
		assert.match(result.stderr, new RegExp(`HTTP ${status}`));
	}
});

test("HTTP 200 responses retain incomplete answers, refusals and failed tool records for the caller", async () => {
	for (const finishReason of ["length", "content_filter", "stop"]) {
		const body = JSON.stringify({ choices: [{ finish_reason: finishReason, message: {
			content: "", server_tool_calls: [{ calls: [{ status: "failed", error: { code: "unavailable" } }] }],
		} }], usage: { completion_tokens: 5 } });
		const result = await invoke({ fetchImpl: async () => new Response(body) });
		assert.equal(result.code, 0);
		assert.equal(result.stdout.toString(), body);
	}
});

test("invalid local input and streaming fail before an HTTP request", async () => {
	for (const body of ["{", "null", "[]", '"text"', '{"stream":true}', '{"stream":"false"}']) {
		const result = await invoke({ body });
		assert.equal(result.code, 2);
		assert.equal(result.stdout.length, 0);
		assert.ok(result.stderr);
	}
	for (const stream of [undefined, null, false]) {
		const result = await invoke({ body: JSON.stringify({ ...schema.examples[0], stream }),
			fetchImpl: async () => new Response("{}"),
		});
		assert.equal(result.code, 0);
	}
});

test("environment overrides the shared env file per setting without mutating process configuration", async (t) => {
	const home = await mkdtemp(join(tmpdir(), "deepseek-web-config-"));
	t.after(() => rm(home, { recursive: true, force: true }));
	await mkdir(join(home, ".config", "deepseek-search"), { recursive: true });
	await writeFile(join(home, ".config", "deepseek-search", ".env"),
		'DEEPSEEK_API_KEY="file-key"\nDEEPSEEK_BASE_URL=https://gateway.example/v1/\n');
	const seen = [];
	const fetchImpl = async (url, options) => {
		seen.push([url, options.headers.Authorization]);
		return new Response("{}");
	};
	const env = {};
	assert.equal((await invoke({ home, env, fetchImpl })).code, 0);
	assert.deepEqual(env, {});
	assert.equal((await invoke({ home, env: { DEEPSEEK_API_KEY: "env-key" }, fetchImpl })).code, 0);
	assert.equal((await invoke({ home, env: { DEEPSEEK_BASE_URL: "https://api.deepseek.com/" }, fetchImpl })).code, 0);
	assert.deepEqual(seen, [
		["https://gateway.example/v1/chat/completions", "Bearer file-key"],
		["https://gateway.example/v1/chat/completions", "Bearer env-key"],
		["https://api.deepseek.com/chat/completions", "Bearer file-key"],
	]);
});

test("missing credentials, invalid base URLs and transport failures return diagnostics without leaking secrets", async () => {
	assert.equal((await invoke({ env: {} })).code, 1);
	for (const base of ["invalid", "file:///tmp/test", "https://user:pass@example.com", "https://example.com?x=1", "https://example.com/#test"]) {
		const result = await invoke({ env: { DEEPSEEK_API_KEY: "private-test-key", DEEPSEEK_BASE_URL: base } });
		assert.equal(result.code, 2);
		assert.doesNotMatch(result.stderr, /private-test-key|user:pass/);
	}
	for (const failReadingBody of [false, true]) {
		let calls = 0;
		const result = await invoke({ fetchImpl: async () => {
			calls++;
			if (!failReadingBody) throw new Error("request failed private-test-key");
			return { arrayBuffer: async () => { throw new Error("response failed private-test-key"); } };
		} });
		assert.equal(result.code, 1);
		assert.equal(calls, 1);
		assert.equal(result.stdout.length, 0);
		assert.doesNotMatch(result.stderr, /private-test-key/);
	}
});

test("the independently copied skill runs as a real CLI against HTTP from an unrelated working directory", async (t) => {
	const temp = await mkdtemp(join(tmpdir(), "deepseek-web-install-"));
	t.after(() => rm(temp, { recursive: true, force: true }));
	const installed = join(temp, "skills", "deepseek-web");
	await cp(skillDir, installed, { recursive: true });
	assert.match(await readFile(join(installed, "LICENSE.txt"), "utf8"), /MIT License/);
	JSON.parse(await readFile(join(installed, "references", "request.schema.json"), "utf8"));
	const expectedBody = JSON.stringify({ ...schema.examples[2], messages: [{ role: "user", content: "读取 https://example.com/ 并用中文回答。" }] });
	const rawResponse = ' \n{"choices":[{"finish_reason":"stop","message":{"content":"中文回答"}}]}\n';
	const received = [];
	const server = createServer(async (req, res) => {
		let body = "";
		for await (const chunk of req) body += chunk;
		received.push({ url: req.url, authorization: req.headers.authorization, body });
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(rawResponse);
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
	const child = spawn(process.execPath, [join(installed, "scripts", "deepseek-web.mjs")], {
		cwd: temp,
		env: { ...process.env, USERPROFILE: temp, HOME: temp,
			DEEPSEEK_API_KEY: "local-integration-key", DEEPSEEK_BASE_URL: `http://127.0.0.1:${server.address().port}/v1/` },
		stdio: ["pipe", "pipe", "pipe"],
	});
	const stdout = [];
	let stderr = "";
	child.stdout.on("data", (chunk) => stdout.push(chunk));
	child.stderr.on("data", (chunk) => (stderr += chunk));
	const closed = once(child, "close");
	child.stdin.end(expectedBody);
	const [code] = await closed;
	assert.equal(code, 0, stderr);
	assert.equal(stderr, "");
	assert.equal(Buffer.concat(stdout).toString(), rawResponse);
	assert.deepEqual(received, [{ url: "/v1/chat/completions", authorization: "Bearer local-integration-key", body: expectedBody }]);
});

test("help and unknown arguments are handled without credentials or HTTP", async () => {
	const help = await invoke({ argv: ["--help"], env: {} });
	assert.equal(help.code, 0);
	assert.match(help.stdout.toString(), /Usage:/);
	assert.equal((await invoke({ argv: ["--query", "test"] })).code, 2);
});
