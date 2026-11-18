#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

export async function runCli({
	argv = process.argv.slice(2),
	env = process.env,
	home = homedir(),
	stdin = process.stdin,
	stdout = process.stdout,
	stderr = process.stderr,
	fetchImpl = globalThis.fetch,
} = {}) {
	const usage = "Usage: deepseek-web.mjs < request.json\nNative Chat Completions JSON on stdin; non-streaming only.\nSee ../references/request.schema.json relative to this script.\n";
	if (argv.length) {
		const help = argv.length === 1 && argv[0] === "--help";
		(help ? stdout : stderr).write(usage);
		return help ? 0 : 2;
	}

	let body;
	let request;
	try {
		const chunks = [];
		for await (const chunk of stdin) chunks.push(Buffer.from(chunk));
		body = Buffer.concat(chunks).toString("utf8");
		request = JSON.parse(body);
	} catch {
		stderr.write("Could not read a JSON request from stdin.\n");
		return 2;
	}
	if (request === null || typeof request !== "object" || Array.isArray(request)) {
		stderr.write("Request must be a JSON object.\n");
		return 2;
	}
	if (request.stream != null && request.stream !== false) {
		stderr.write("This CLI supports non-streaming requests; omit stream or set it to false.\n");
		return 2;
	}

	let fileEnv = {};
	try {
		fileEnv = parseEnv(await readFile(join(home, ".config", "deepseek-search", ".env"), "utf8"));
	} catch (error) {
		if (error.code !== "ENOENT") {
			stderr.write("Could not read ~/.config/deepseek-search/.env.\n");
			return 1;
		}
	}
	const apiKey = env.DEEPSEEK_API_KEY?.trim() || fileEnv.DEEPSEEK_API_KEY?.trim();
	if (!apiKey) {
		stderr.write("Missing DeepSeek API key. Set DEEPSEEK_API_KEY or configure ~/.config/deepseek-search/.env.\n");
		return 1;
	}

	let endpoint;
	try {
		const base = new URL(env.DEEPSEEK_BASE_URL?.trim() || fileEnv.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com");
		if (!["https:", "http:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
			throw new Error();
		}
		endpoint = `${base.href.replace(/\/+$/, "")}/chat/completions`;
	} catch {
		stderr.write("DEEPSEEK_BASE_URL must be an HTTP(S) API base URL without credentials, query or fragment.\n");
		return 2;
	}

	try {
		const response = await fetchImpl(endpoint, {
			method: "POST",
			redirect: "error",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body,
		});
		stdout.write(Buffer.from(await response.arrayBuffer()));
		if (!response.ok) {
			stderr.write(`DeepSeek API returned HTTP ${response.status}.\n`);
			return 1;
		}
		return 0;
	} catch {
		stderr.write("DeepSeek API transport failed while sending the request or reading its response. No automatic retry was made.\n");
		return 1;
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	process.exitCode = await runCli();
}
