# DeepSeek Search MCP

Optional MCP stdio server for the official DeepSeek Search and Fetch APIs. It calls the repository's shared skill CLI, so API requests, credentials, and response handling have one implementation.

## Requirements

- Node.js 22 or later
- A DeepSeek API key with Search/Fetch access

Configure `DEEPSEEK_API_KEY` in the environment inherited by the MCP host, or in `~/.config/deepseek-search/.env`. The shared CLI reads that file when the environment variable is absent. Keep the key outside this repository.

## Install

Clone the repository, then install this server's dependencies:

```powershell
git clone https://github.com/Nobody-ly/deepseek-search-skill.git
cd deepseek-search-skill\mcp\deepseek-search-mcp
npm install
```

Configure your MCP host to launch `node` with the absolute path to `server.mjs`. For example, a Codex `config.toml` entry is:

```toml
[mcp_servers.deepseek-search]
command = "node"
args = ["C:/path/to/deepseek-search-skill/mcp/deepseek-search-mcp/server.mjs"]
```

The server exposes two tools:

- `search`: DeepSeek's native `query`, `count`, `ori_question`, `localization`, and `need_content` fields. Unknown fields are passed through.
- `fetch`: DeepSeek's native `url` field.

The MCP response contains the DeepSeek API response body as text without summarization or filtering. API request errors are returned as MCP tool errors with the original response body when available.

## Test

```powershell
npm test
```

Tests use an in-memory MCP connection and a mocked API call. They require no API key and make no network requests.
