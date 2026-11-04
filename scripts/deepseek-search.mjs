#!/usr/bin/env node

import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const API_BASE_URL = "https://api.deepseek.com";
const ENDPOINTS = Object.freeze({
	search: "/v1/tools/search",
	fetch: "/v1/tools/fetch",
});

function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}

async function readStdin(stream) {
	const chunks = [];
	for await (const chunk of stream) chunks.push(Buffer.from(chunk));
	return Buffer.concat(chunks).toString("utf8");
}

export async function runCli({
	argv = process.argv.slice(2),
	env = process.env,
	home = homedir(),
	stdin = process.stdin,
	stdout = process.stdout,
	stderr = process.stderr,
	fetchImpl = globalThis.fetch,
	loadEnvFile = (path) => process.loadEnvFile(path),
} = {}) {
	const operation = argv[0];
	if (!Object.hasOwn(ENDPOINTS, operation) || argv.length !== 1) {
		stderr.write("Usage: deepseek-search.mjs <search|fetch> < request.json\n");
		return 2;
	}

	if (!env.DEEPSEEK_API_KEY?.trim()) {
		delete env.DEEPSEEK_API_KEY;
		const envPath = join(home, ".config", "deepseek-search", ".env");
		try {
			loadEnvFile(envPath);
		} catch (error) {
			if (error?.code !== "ENOENT") {
				stderr.write(`Could not load DeepSeek credentials: ${errorMessage(error)}\n`);
				return 1;
			}
		}
	}

	const apiKey = env.DEEPSEEK_API_KEY?.trim();
	if (!apiKey) {
		stderr.write("Missing DeepSeek API key. Set DEEPSEEK_API_KEY or configure ~/.config/deepseek-search/.env.\n");
		return 1;
	}

	let request;
	try {
		request = JSON.parse(await readStdin(stdin));
	} catch (error) {
		stderr.write(`Invalid JSON request: ${errorMessage(error)}\n`);
		return 2;
	}
	if (request === null || typeof request !== "object" || Array.isArray(request)) {
		stderr.write("Request must be a JSON object.\n");
		return 2;
	}

	let response;
	try {
		response = await fetchImpl(`${API_BASE_URL}${ENDPOINTS[operation]}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(request),
		});
	} catch (error) {
		stderr.write(`DeepSeek API request failed: ${errorMessage(error)}\n`);
		return 1;
	}

	const responseBody = await response.text();
	stdout.write(responseBody);
	if (!response.ok) {
		stderr.write(`DeepSeek API returned HTTP ${response.status}.\n`);
		return 1;
	}
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = await runCli();
}
