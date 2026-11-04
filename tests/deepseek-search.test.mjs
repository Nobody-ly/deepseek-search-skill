import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";

import { runCli } from "../scripts/deepseek-search.mjs";

function output() {
	let value = "";
	return {
		stream: { write: (chunk) => (value += chunk) },
		read: () => value,
	};
}

async function invoke({ args = ["search"], body = "{}", env = {}, home = "C:/test-home", fetchImpl, loadEnvFile } = {}) {
	const stdout = output();
	const stderr = output();
	const exitCode = await runCli({
		argv: args,
		env,
		home,
		stdin: Readable.from([body]),
		stdout: stdout.stream,
		stderr: stderr.stream,
		fetchImpl,
		loadEnvFile,
	});
	return { exitCode, stdout: stdout.read(), stderr: stderr.read() };
}

test("search forwards native fields to the official endpoint and returns the body unchanged", async () => {
	let captured;
	const responseBody = '{"results":[{"url":"https://example.com","summary":"result"}]}';
	const result = await invoke({
		body: '{"query":"x","count":3,"ori_question":"original","localization":"127.0.0.1","need_content":true}',
		env: { DEEPSEEK_API_KEY: "env-key" },
		fetchImpl: async (url, options) => {
			captured = { url, options };
			return { ok: true, status: 200, text: async () => responseBody };
		},
	});

	assert.equal(result.exitCode, 0);
	assert.equal(result.stdout, responseBody);
	assert.equal(captured.url, "https://api.deepseek.com/v1/tools/search");
	assert.equal(captured.options.method, "POST");
	assert.equal(captured.options.headers.Authorization, "Bearer env-key");
	assert.equal(captured.options.headers["Content-Type"], "application/json");
	assert.deepEqual(JSON.parse(captured.options.body), {
		query: "x",
		count: 3,
		ori_question: "original",
		localization: "127.0.0.1",
		need_content: true,
	});
});

test("fetch uses the official endpoint and preserves an HTTP error body", async () => {
	let capturedUrl;
	const errorBody = '{"error":"invalid url"}';
	const result = await invoke({
		args: ["fetch"],
		body: '{"url":"https://example.com/page"}',
		env: { DEEPSEEK_API_KEY: "key" },
		fetchImpl: async (url) => {
			capturedUrl = url;
			return { ok: false, status: 400, text: async () => errorBody };
		},
	});

	assert.equal(result.exitCode, 1);
	assert.equal(result.stdout, errorBody);
	assert.match(result.stderr, /HTTP 400/);
	assert.equal(capturedUrl, "https://api.deepseek.com/v1/tools/fetch");
});

test("loads the configured env file as fallback and preserves an environment key", async () => {
	const home = await mkdtemp(join(tmpdir(), "deepseek-search-"));
	const envFile = join(home, ".config", "deepseek-search", ".env");
	await mkdir(join(home, ".config", "deepseek-search"), { recursive: true });
	await writeFile(envFile, "DEEPSEEK_API_KEY=file-key\n", "utf8");
	const originalKey = process.env.DEEPSEEK_API_KEY;
	const seenKeys = [];
	const fetchImpl = async (_url, options) => {
		seenKeys.push(options.headers.Authorization);
		return { ok: true, status: 200, text: async () => "{}" };
	};

	try {
		delete process.env.DEEPSEEK_API_KEY;
		const fromFile = await invoke({
			env: process.env,
			home,
			fetchImpl,
			loadEnvFile: (path) => process.loadEnvFile(path),
		});
		assert.equal(fromFile.exitCode, 0);
		assert.equal(process.env.DEEPSEEK_API_KEY, "file-key");

		process.env.DEEPSEEK_API_KEY = "env-key";
		const fromEnvironment = await invoke({
			env: process.env,
			home,
			fetchImpl,
			loadEnvFile: (path) => process.loadEnvFile(path),
		});
		assert.equal(fromEnvironment.exitCode, 0);
		assert.deepEqual(seenKeys, ["Bearer file-key", "Bearer env-key"]);
	} finally {
		if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
		else process.env.DEEPSEEK_API_KEY = originalKey;
		await rm(home, { recursive: true, force: true });
	}
});

test("missing credentials do not send a request or reveal a secret", async () => {
	const result = await invoke({
		loadEnvFile: () => {
			throw Object.assign(new Error("missing"), { code: "ENOENT" });
		},
		fetchImpl: async () => assert.fail("request must not be sent"),
	});

	assert.equal(result.exitCode, 1);
	assert.match(result.stderr, /Missing DeepSeek API key/);
	assert.doesNotMatch(result.stderr, /env-key|file-key|Bearer [^\s]+/);
});

test("invalid JSON and unsupported operations fail before making a request", async () => {
	const fetchImpl = async () => assert.fail("request must not be sent");
	const invalidJson = await invoke({
		body: "{",
		env: { DEEPSEEK_API_KEY: "key" },
		fetchImpl,
	});
	const invalidOperation = await invoke({
		args: ["anything"],
		env: { DEEPSEEK_API_KEY: "key" },
		fetchImpl,
	});

	assert.equal(invalidJson.exitCode, 2);
	assert.match(invalidJson.stderr, /Invalid JSON request/);
	assert.equal(invalidOperation.exitCode, 2);
	assert.match(invalidOperation.stderr, /Usage:/);
});
