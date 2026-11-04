# DeepSeek Search and Fetch Skill

An installable Agent Skill for calling DeepSeek's official Search and Fetch APIs from Node.js-enabled agent harnesses. It sends native JSON requests and prints the API response body unchanged; it does not call a model or rewrite results.

## Install

Install with the open-source [`skills` CLI](https://github.com/vercel-labs/skills):

```powershell
npx skills add Nobody-ly/deepseek-search-skill --skill deepseek-search --global
```

Or copy this repository's `SKILL.md` and `scripts/` into your agent's skills directory. The skill follows the open Agent Skills folder format and does not require an npm package install.

## Requirements

- Node.js 22 or later
- A DeepSeek API key with Search/Fetch access

## Configure credentials

Set `DEEPSEEK_API_KEY` in the environment of the agent process. As a local fallback, create `~/.config/deepseek-search/.env`:

```dotenv
DEEPSEEK_API_KEY=your-key
```

On Windows, `~` resolves to your user profile directory. Keep the key outside this repository and never pass it as a command-line argument.

## Use

The skill runs the bundled CLI with a native JSON request on stdin:

```powershell
'{"query":"DeepSeek Search API","count":5,"need_content":false}' | node .\scripts\deepseek-search.mjs search
'{"url":"https://api-docs.deepseek.com/guides/search/"}' | node .\scripts\deepseek-search.mjs fetch
```

When your harness invokes the script, resolve its path relative to this `SKILL.md`.

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

This is an unofficial community skill. It calls DeepSeek's documented HTTP API directly. It is not an MCP server and is not affiliated with DeepSeek.
