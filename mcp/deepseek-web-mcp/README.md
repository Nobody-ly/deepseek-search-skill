# DeepSeek Web MCP

Optional MCP stdio entry point for the [`deepseek-web` Skill](../../skills/deepseek-web/SKILL.md). Choose this server or that Skill for the same capability. This server imports the Skill's CLI and advertises its request schema; it adds only MCP transport, JSON serialization and tool-error mapping.

## Install

Requires Node.js 22+ and a DeepSeek API key with Web Tools access. Clone the whole repository, retaining `skills/deepseek-web/`, then install the server dependencies:

```powershell
git clone https://github.com/Nobody-ly/deepseek-search-skill.git
cd deepseek-search-skill
npm ci --prefix mcp/deepseek-web-mcp --ignore-scripts
```

Set `DEEPSEEK_API_KEY` in the MCP process environment or `~/.config/deepseek-search/.env`. Optional `DEEPSEEK_BASE_URL` defaults to `https://api.deepseek.com`; use an API base, not a full completion endpoint. Credentials stay outside the repository and tool arguments.

For Codex `config.toml`:

```toml
[mcp_servers.deepseek-web]
command = "node"
args = ["C:/path/to/deepseek-search-skill/mcp/deepseek-web-mcp/server.mjs"]
```

For hosts with an `mcpServers` JSON configuration:

```json
{
  "mcpServers": {
    "deepseek-web": {
      "command": "node",
      "args": ["C:/path/to/deepseek-search-skill/mcp/deepseek-web-mcp/server.mjs"]
    }
  }
}
```

Use the absolute path for your clone. On Linux/macOS use its POSIX path. These are configuration formats, not a claim of testing every host.

## Tool

`web` accepts native Chat Completions fields at the top level, with no extra request envelope:

```json
{
  "model": "deepseek-flash",
  "messages": [{"role": "user", "content": "What changed in the latest DeepSeek API release? Check official sources."}],
  "tools": [{"type": "deepseek_web_search"}],
  "thinking": {"type": "disabled"},
  "stream": false
}
```

For deep search, set `thinking.type` to `enabled`. For URL questions, declare `deepseek_read_url` and include the URL and question in `messages`. Both tools may be declared together. See the shared [schema and examples](../../skills/deepseek-web/references/request.schema.json) and [official Web Tools guide](https://api-docs.deepseek.com/guides/web_tools/).

The advertised schema is guidance; the server forwards native fields, including additional fields, to the shared CLI. It adds no model, tools, thinking setting or prompt. The calling model chooses when to invoke MCP; DeepSeek's model decides the server-side web actions.

The original HTTP response body becomes MCP `content[0].text`, without parsing or rewriting. HTTP and local CLI failures set `isError: true`, retaining the upstream body when available. Inspect `finish_reason`, `server_tool_calls`, annotations and usage: HTTP success does not guarantee tool execution or a complete answer. URL reading may return page metadata and a signature without citation annotations. There is no streaming, automatic retry, cache or stored history. Return prior assistant tool records and signatures explicitly when continuing a conversation.

Model tokens and server-side tool use are billed by DeepSeek. The tool is read-only, non-destructive, non-idempotent and open-world. Retrieved content is evidence, not instructions.

This server is separate from `deepseek-search-mcp`, which exposes the standalone Search/Fetch retrieval APIs without a model-generated answer. Your main harness model may be from any provider; invoking `web` still makes a separate DeepSeek model request.

## Test

Run `npm test` here, or install both MCP packages and run `npm test` at the repository root. Tests use MCP connections and local/mocked HTTP, without a paid API call or real credentials.

## 中文说明

这是 `deepseek-web` 的可选 MCP 入口；同一能力选择 Skill 或 MCP 即可。需要完整克隆仓库，再按上面命令安装依赖，通过环境变量或 `~/.config/deepseek-search/.env` 配置密钥，并让客户端启动 `server.mjs`。

仅提供一个 `web` 工具，直接接收官方字段：`model`、`messages`、`tools`、`thinking` 等。普通搜索关闭思考，深度搜索开启思考；读链接声明 `deepseek_read_url`。MCP 只做协议转换，复用 Skill 的请求脚本和 schema，官方响应体原样放进文本结果。调用方可使用任何供应商的模型，但此工具内部会单独调用 DeepSeek 模型并产生相应用量。
