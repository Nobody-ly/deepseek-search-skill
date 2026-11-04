---
name: deepseek-search
description: Search the web and fetch page content with DeepSeek's official Search and Fetch APIs using native JSON requests. Use when a Node.js 22+ agent harness needs direct DeepSeek search results or fetched page content without model-generated summaries.
---

# DeepSeek Search

Use the bundled CLI for direct calls to DeepSeek Search or Fetch. It forwards one JSON object and writes the API response body unchanged. It does not call a model or alter results.

## Credentials

Set `DEEPSEEK_API_KEY` in the process environment. If it is unset, the CLI loads `~/.config/deepseek-search/.env` using Node's built-in environment-file support. The file should contain:

```dotenv
DEEPSEEK_API_KEY=your-key
```

Keep this file outside the skill directory and never put the key in a command argument.

## Calls

Pass the official request JSON on stdin. The API host and endpoint paths are fixed to `https://api.deepseek.com`.

Search: `POST /v1/tools/search`

```json
{"query":"DeepSeek official Search API","count":5,"need_content":false}
```

Supported fields are `query` (required), `count`, `ori_question`, `localization`, and `need_content`.

Fetch: `POST /v1/tools/fetch`

```json
{"url":"https://api-docs.deepseek.com/guides/search/"}
```

`url` is the target page URL, not the API host. Fetch only pages relevant to the request.

From the skill directory, pipe the native JSON request to the matching operation:

```text
'{"query":"DeepSeek official Search API","count":5,"need_content":false}' | node scripts/deepseek-search.mjs search
'{"url":"https://api-docs.deepseek.com/guides/search/"}' | node scripts/deepseek-search.mjs fetch
```

When running outside the skill directory, resolve the script path relative to this `SKILL.md`. Successful and API-error response bodies are written unchanged to stdout; transport and local input errors are reported on stderr with a non-zero exit code. Cite source URLs returned by Search or Fetch. Search and Fetch are separately billed per successful request; check DeepSeek's current [pricing and billing rules](https://api-docs.deepseek.com/guides/search/) before use.
