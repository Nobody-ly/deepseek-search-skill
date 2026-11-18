# DeepSeek API Skills

[简体中文](README.zh-CN.md) | English

[![skills.sh installs](https://skills.sh/b/Nobody-ly/deepseek-search-skill)](https://skills.sh/Nobody-ly/deepseek-search-skill)
[![Tests](https://github.com/Nobody-ly/deepseek-search-skill/actions/workflows/test.yml/badge.svg)](https://github.com/Nobody-ly/deepseek-search-skill/actions/workflows/test.yml)
[![M8ven Verified](https://m8ven.ai/badge/mcp/nobody-ly/deepseek-search-skill?variant=verified)](https://m8ven.ai/mcp/nobody-ly/deepseek-search-skill?s=readme)

Small adapters for DeepSeek's official APIs. Both standalone Search/Fetch and model-driven Web Tools are available through an Agent Skill or an MCP server.

## Why this exists

An API key selects and authenticates a model provider; it does not by itself give every harness the provider's server-side web search. Search availability depends on the model API, the harness's tool support, and the search provider the harness is configured to use. A harness may have its own web search, support a model provider's native search, or have no search configured.

These adapters make DeepSeek Search and Fetch explicit retrieval options for agents. Search can use DeepSeek's index while the agent continues using its current model, from DeepSeek or another provider. They do not impersonate a browser or ask a model to generate search results.

## Design

Both adapters share the bundled CLI, which sends DeepSeek's native JSON request to the documented Search or Fetch endpoint and prints the API response body unchanged. It does not call a model, summarize or filter results, cache, or retry. Each successful Search or Fetch request is billed separately. The skill is for harnesses that load Agent Skills and run scripts; the MCP server exposes the same operations as MCP tools. In either case, the agent decides when to search, which returned pages to fetch, and how to use the results in its answer.

These are small adapters, not a research agent or a replacement for every harness's built-in search. Use either entry point when you want DeepSeek Search/Fetch as a separate, model-independent retrieval backend. If your harness already provides the search provider and behavior you want, keep using that integration.

## Skills

| Skill | API | Result | Entry points |
| --- | --- | --- | --- |
| [`deepseek-search`](skills/deepseek-search/SKILL.md) | Standalone Search / Fetch | Raw retrieval JSON | Skill or MCP |
| [`deepseek-web`](skills/deepseek-web/SKILL.md) | Chat Completions with official Web Tools | Raw completion body, including the answer, citations and tool records | Skill or MCP |

Choose Skill or MCP for the same capability; installing both duplicates the entry points. The Design section above describes the existing Search/Fetch adapters.

`deepseek-web` covers web search, deep thinking search and URL questions using the official `tools` and `thinking` fields. It sends one non-streaming request without adding a prompt, model defaults, tool declarations or result processing. Common native fields and complete request examples are in its [request schema](skills/deepseek-web/references/request.schema.json). Model tokens and actual tool use are billed by DeepSeek.

Live-tested against the official API on 2026-11-18: all three examples completed their corresponding server tools (`search`, `deep_search`, `read_link`). Each invocation sent one unchanged request and returned a byte-identical response body. Tool execution and generated answers remain controlled by DeepSeek.

The Web MCP entry point was also live-tested through an MCP stdio client for URL reading. Offline tests cover all three modes through MCP and verify native-field passthrough, unchanged response text and error handling.

The Web Tools Skill includes its own script and license, requires Node.js 22+, and reuses `DEEPSEEK_API_KEY` or `~/.config/deepseek-search/.env`. Its optional `DEEPSEEK_BASE_URL` defaults to the official API origin. Existing Search/Fetch behavior is unchanged; its API URL remains fixed. The two MCP servers are separate entry points for the two APIs.

## Install Web Tools

Choose the Skill:

```powershell
npx skills add Nobody-ly/deepseek-search-skill --skill deepseek-web --global
```

Or copy the entire `skills/deepseek-web/` folder into your harness's skills directory.

For MCP instead, follow [`mcp/deepseek-web-mcp`](mcp/deepseek-web-mcp/README.md). Clone the whole repository, run `npm ci --prefix mcp/deepseek-web-mcp --ignore-scripts`, and configure your MCP host to launch that directory's `server.mjs`. It exposes one `web` tool with native Chat Completions fields, reusing the Skill's script and schema. Your main harness can use any model; this API call separately uses DeepSeek's model and bills model tokens and server-side tools.

## Install Search/Fetch

Install the skill with the open-source [`skills` CLI](https://github.com/vercel-labs/skills):

```powershell
npx skills add Nobody-ly/deepseek-search-skill --skill deepseek-search --global
```

Or copy the entire `skills/deepseek-search/` directory, including `LICENSE.txt`, into your agent's skills directory. The skill follows the open Agent Skills folder format and does not require an npm package install.

### MCP server

The optional MCP stdio server is in [`mcp/deepseek-search-mcp`](mcp/deepseek-search-mcp/README.md). Clone the repository, run `npm install` in that directory, and configure your MCP host to launch `server.mjs`. The server delegates to the same CLI as the skill.

## Requirements

- Node.js 22 or later
- A DeepSeek API key with Search/Fetch access

## Harness compatibility

This uses the portable Agent Skills folder format and a Node.js CLI. It is intended for harnesses that can discover `SKILL.md` skills, run local scripts, and pass script output back to the active model. Examples include Pi, Codex, Claude Code, Cursor, OpenCode, and VS Code Copilot. These names indicate format/runtime fit, not a claim that this repository has been end-to-end tested in each host. We have verified remote discovery with the `skills` CLI and run the offline tests; host-specific execution has not been integration-tested in every harness.

The script calls DeepSeek's Search/Fetch HTTP APIs directly. The model used by the harness can be from any provider, as long as the harness can execute the script and return its output to that model. This is separate from a provider-native server-side search tool, which must be supported by both the API and the harness.

## Native DeepSeek tools or these adapters?

DeepSeek now offers server-side web tools as well as standalone Search and Fetch APIs. With a compatible DeepSeek model and API protocol, enable `deepseek_web_search` for model-directed web search (including image search) and optionally `deepseek_read_url` for reading links in the user's message. DeepSeek performs the search and assembles the results into the model context. The current Web Tools guide documents these tools for the `deepseek-flash` model across Messages, Responses, and Chat Completions APIs. The harness must send the supported tool declarations and handle the protocol's response format.

DeepSeek's own DeepSeek Harness also ships the first-party `@deepseek-ai/dsh-web-deepseek-api` plugin. It connects the standalone Search and Fetch APIs to that harness's web-provider layer, without an extra model request. DeepSeek Harness separately supports loading Agent Skills and connecting external MCP servers; those generic capabilities do not make this repository an official DeepSeek package.

Choose the integration that fits the model and harness:

- DeepSeek model plus a harness/API integration that supports DeepSeek's server tools: use the native web tools. No Agent Skill or MCP adapter is needed for that path.
- DeepSeek Harness: prefer its first-party `@deepseek-ai/dsh-web-deepseek-api` provider for direct Search/Fetch integration.
- Any model plus a harness that can discover Agent Skills and run local scripts: use this Skill.
- Any model plus an MCP host: use this MCP server.
- A custom application that needs direct control over requests and raw responses: call the standalone Search/Fetch APIs or use the bundled CLI.

Codex has a separate DeepSeek provider integration with Alpha Search. When Codex is configured to use DeepSeek and Alpha Search is enabled, this project overlaps for search in that Codex setup. This repository remains useful in Codex when you want an explicit tool backed by DeepSeek Search while using another model provider. OpenCode's built-in `websearch` uses its configured OpenCode, Exa, or Parallel search path; it does not automatically mean DeepSeek Search. See the [DeepSeek Web Tools guide](https://api-docs.deepseek.com/guides/web_tools/), [DeepSeek Harness Search/Fetch provider](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/web/web-deepseek-api), [DeepSeek Harness Skill loader](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/skill/skill-filesystem), [DeepSeek Harness MCP client](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client), [Codex integration](https://api-docs.deepseek.com/quick_start/agent_integrations/codex/), [OpenAI web search API](https://developers.openai.com/api/docs/guides/tools-web-search), and [OpenCode web search providers](https://dev.opencode.ai/v2/docs/websearch/).

## Related approaches

This is not the only DeepSeek web-search integration. A similar [DeepSeek Search Agent Skill](https://www.skills.sh/jpcaparas/skills/deepseek-search) teaches the same official Search/Fetch API. Pi users can also choose a [Pi-specific provider-native search extension](https://pi.dev/packages/pi-web-search), while third-party MCP options such as [`ds-websearch-mcp`](https://github.com/prepaser/ds-websearch-mcp) expose the APIs as MCP tools. These differ in harness coverage and how much they do around the API calls. This project focuses on the narrow path of native Search/Fetch JSON in and the API response body out. It is an unofficial community project, not a DeepSeek product.

## Configure credentials

Set `DEEPSEEK_API_KEY` in the environment of the agent process. As a local fallback, create `~/.config/deepseek-search/.env`:

```dotenv
DEEPSEEK_API_KEY=your-key
```

On Windows, `~` resolves to your user profile directory. Keep the key outside this repository and never pass it as a command-line argument.

## Use

The skill runs the bundled CLI with a native JSON request on stdin:

```powershell
'{"query":"DeepSeek Search API","count":5,"need_content":false}' | node .\skills\deepseek-search\scripts\deepseek-search.mjs search
'{"url":"https://api-docs.deepseek.com/guides/search/"}' | node .\skills\deepseek-search\scripts\deepseek-search.mjs fetch
```

When a harness invokes the skill script, resolve its path relative to `skills/deepseek-search/SKILL.md`.

Search accepts DeepSeek's native fields: `query`, `count`, `ori_question`, `localization`, and `need_content`. Fetch accepts `url`. Requests go to `https://api.deepseek.com/v1/tools/search` or `/v1/tools/fetch`.

Successful and API-error response bodies are written unchanged to stdout. Local input and transport errors go to stderr with a non-zero exit code. The skill does not summarize, filter, cache, or retry results.

## Cost

DeepSeek charges for successful Search and Fetch requests. Empty search results, failed requests, and timeouts are not billed. Check the current [DeepSeek Search & Fetch pricing and billing rules](https://api-docs.deepseek.com/guides/search/) before use.

## Test

```powershell
npm test
```

Tests use mocked HTTP or a local HTTP server and do not require an API key or contact the official API.

GitHub Actions runs the CLI and MCP tests on Windows and Linux with Node.js 22. To run the full suite from a fresh clone, first install both MCP packages:

```powershell
npm ci --prefix mcp/deepseek-search-mcp --ignore-scripts
npm ci --prefix mcp/deepseek-web-mcp --ignore-scripts
npm test
```

## Scope

This is an unofficial community project that calls DeepSeek's documented HTTP API directly and provides both an Agent Skill and an optional MCP server. It is not affiliated with DeepSeek.

## License

[MIT](LICENSE). The standalone skill includes the same license in `LICENSE.txt`. DeepSeek's API terms and usage charges apply separately.
