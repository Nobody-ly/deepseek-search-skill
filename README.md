# DeepSeek Search and Fetch

[简体中文](README.zh-CN.md) | English

Small, model-independent adapters for DeepSeek's official Search and Fetch APIs: an installable Agent Skill and an optional MCP server.

## Why this exists

An API key selects and authenticates a model provider; it does not by itself give every harness the provider's server-side web search. Search availability depends on the model API, the harness's tool support, and the search provider the harness is configured to use. A harness may have its own web search, support a model provider's native search, or have no search configured.

These adapters make DeepSeek Search and Fetch explicit retrieval options for agents. Search can use DeepSeek's index while the agent continues using its current model, from DeepSeek or another provider. They do not impersonate a browser or ask a model to generate search results.

## Design

Both adapters share the bundled CLI, which sends DeepSeek's native JSON request to the documented Search or Fetch endpoint and prints the API response body unchanged. It does not call a model, summarize or filter results, cache, or retry. The skill is for harnesses that load Agent Skills and run scripts; the MCP server exposes the same operations as MCP tools. The agent decides when to search, which returned pages to fetch, and how to use the results in its answer.

These are small adapters, not a research agent or a replacement for every harness's built-in search. Use either entry point when you want DeepSeek Search/Fetch as a separate, model-independent retrieval backend. If your harness already provides the search provider and behavior you want, keep using that integration.

## Install

Install the skill with the open-source [`skills` CLI](https://github.com/vercel-labs/skills):

```powershell
npx skills add Nobody-ly/deepseek-search-skill --skill deepseek-search --global
```

Or copy `skills/deepseek-search/SKILL.md` and its `scripts/` directory into your agent's skills directory. The skill follows the open Agent Skills folder format and does not require an npm package install.

### MCP server

The optional MCP stdio server is in [`mcp/deepseek-search-mcp`](mcp/deepseek-search-mcp/README.md). Clone the repository, run `npm install` in that directory, and configure your MCP host to launch `server.mjs`. The server delegates to the same CLI as the skill.

## Requirements

- Node.js 22 or later
- A DeepSeek API key with Search/Fetch access

## Harness compatibility

This uses the portable Agent Skills folder format and a Node.js CLI. It is intended for harnesses that can discover `SKILL.md` skills, run local scripts, and pass script output back to the active model. Examples include Pi, Codex, Claude Code, Cursor, OpenCode, and VS Code Copilot. These names indicate format/runtime fit, not a claim that this repository has been end-to-end tested in each host. We have verified remote discovery with the `skills` CLI and run the offline tests; host-specific execution has not been integration-tested in every harness.

The script calls DeepSeek's Search/Fetch HTTP APIs directly. The model used by the harness can be from any provider, as long as the harness can execute the script and return its output to that model. This is separate from a provider-native server-side search tool, which must be supported by both the API and the harness.

For example, DeepSeek's Responses API `web_search` currently requires `deepseek-v4-pro` and a harness that sends and handles the Responses tool format. OpenAI's Responses API also offers its own `web_search`, which likewise needs client support. OpenCode's built-in `websearch` uses its configured OpenCode, Exa, or Parallel search path; it does not automatically mean DeepSeek Search. See the [DeepSeek Responses API tool support](https://api-docs.deepseek.com/guides/responses_api/), [OpenAI web search API](https://developers.openai.com/api/docs/guides/tools-web-search), and [OpenCode web search providers](https://dev.opencode.ai/v2/docs/websearch/).

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

Tests use a mocked HTTP transport and do not require an API key or make network requests.

## Scope

This is an unofficial community project that calls DeepSeek's documented HTTP API directly and provides both an Agent Skill and an optional MCP server. It is not affiliated with DeepSeek.
