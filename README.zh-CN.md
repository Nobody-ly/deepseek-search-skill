# DeepSeek API Skills

简体中文 | [English](README.md)

[![skills.sh 安装量](https://skills.sh/b/Nobody-ly/deepseek-search-skill)](https://skills.sh/Nobody-ly/deepseek-search-skill)
[![测试](https://github.com/Nobody-ly/deepseek-search-skill/actions/workflows/test.yml/badge.svg)](https://github.com/Nobody-ly/deepseek-search-skill/actions/workflows/test.yml)

一组轻量的 DeepSeek 官方 API 适配器。独立 Search/Fetch 和通过模型执行的 Web Tools，均可选择 Agent Skill 或 MCP 接入。

## 为什么需要它

配置 API key 只会选择并认证模型供应商，并不会自动让每个 harness 获得该供应商的服务端网页搜索能力。搜索能力取决于模型 API、harness 对工具协议的支持，以及 harness 配置的搜索服务。Harness 可能自带网页搜索、支持模型供应商的原生搜索，也可能没有配置搜索。

这两种适配方式为 agent 提供了明确调用 DeepSeek Search 和 Fetch 的选项。搜索使用 DeepSeek 的索引，而 agent 可以继续使用当前模型，无论它来自 DeepSeek 还是其他供应商。它们不模拟浏览器，也不让模型生成搜索结果。

## 设计

两种适配方式共用同一个 CLI：它将 DeepSeek 原生 JSON 请求发送到官方 Search 或 Fetch 接口，并将 API 响应正文原样写出。它不调用模型、不总结或过滤结果、不缓存，也不重试。每次成功的 Search 或 Fetch 请求都会单独计费。Agent Skill 适用于能加载 Agent Skills 并运行脚本的 harness；MCP server 则将相同操作暴露为 MCP 工具。两种方式都由 agent 决定何时搜索、要抓取哪些结果页面，以及如何在答复中使用返回内容。

这是一组小型适配器，不是研究代理，也不打算取代所有 harness 自带的搜索功能。当你希望把 DeepSeek Search/Fetch 作为独立于当前模型的检索后端时，可以选择其中一种接入方式。如果 harness 已提供你需要的搜索服务和行为，继续使用现有集成即可。

## Skills

| Skill | 对应 API | 返回内容 | 使用入口 |
| --- | --- | --- | --- |
| [`deepseek-search`](skills/deepseek-search/SKILL.md) | 独立 Search / Fetch | 原始检索 JSON | Skill 或 MCP |
| [`deepseek-web`](skills/deepseek-web/SKILL.md) | 带官方 Web Tools 的 Chat Completions | 原始响应，包含回答、引用和工具记录 | Skill 或 MCP |

同一能力选择 Skill 或 MCP 即可，同时安装会重复提供入口。上面的设计部分描述的是现有 Search/Fetch 适配器。

`deepseek-web` 使用官方 `tools` 和 `thinking` 字段覆盖网页搜索、深度搜索和链接问答。脚本只发送一次非流式请求，不添加提示词、默认模型、工具声明或结果处理。[请求 schema](skills/deepseek-web/references/request.schema.json) 提供常用原生字段说明和完整示例。模型 token 与实际工具使用由 DeepSeek 计费。

2026-11-18 已使用官方 API 实测：三个示例分别完成了 `search`、`deep_search`、`read_link` 服务端工具调用。每次脚本仅发送一个未改动的请求，输出与官方响应体逐字节一致。实际工具执行和生成答案由 DeepSeek 决定。

Web MCP 入口也已通过 MCP stdio 客户端实测官方读链接调用。离线测试覆盖通过 MCP 调用三种模式，并验证原生字段透传、响应文本不变及错误处理。

Web Tools Skill 包含独立脚本和许可证，要求 Node.js 22+，复用环境变量 `DEEPSEEK_API_KEY` 或 `~/.config/deepseek-search/.env`。可选 `DEEPSEEK_BASE_URL` 默认为官方 API 地址。现有 Search/Fetch 行为不变，其 API 地址仍固定为官网。两个 MCP server 分别提供两套 API 的入口。

## 安装 Web Tools

选择 Skill 时：

```powershell
npx skills add Nobody-ly/deepseek-search-skill --skill deepseek-web --global
```

也可以将整个 `skills/deepseek-web/` 文件夹复制到 harness 的 skills 目录。

若选择 MCP，参见 [`mcp/deepseek-web-mcp`](mcp/deepseek-web-mcp/README.md)。完整克隆仓库后，运行 `npm ci --prefix mcp/deepseek-web-mcp --ignore-scripts`，再配置 MCP host 启动该目录的 `server.mjs`。它仅提供一个 `web` 工具，接收原生 Chat Completions 字段，复用 Skill 的脚本和 schema。主 harness 可使用任何模型；此 API 调用会单独使用 DeepSeek 模型，并按模型 token 和服务端工具用量计费。

## 安装 Search/Fetch

通过开源的 [`skills` CLI](https://github.com/vercel-labs/skills) 安装 Agent Skill：

```powershell
npx skills add Nobody-ly/deepseek-search-skill --skill deepseek-search --global
```

也可以将整个 `skills/deepseek-search/` 目录（包括 `LICENSE.txt`）复制到 agent 的 skills 目录。该 skill 遵循开放的 Agent Skills 文件夹格式，无需安装 npm 包。

### MCP server

可选 MCP stdio server 位于 [`mcp/deepseek-search-mcp`](mcp/deepseek-search-mcp/README.md)。克隆仓库后，在该目录运行 `npm install`，再配置 MCP host 启动 `server.mjs`。MCP server 会调用与 skill 相同的 CLI。

## 环境要求

- Node.js 22 或更高版本
- 有 Search/Fetch 权限的 DeepSeek API key

## Harness 兼容性

本 skill 使用可移植的 Agent Skills 文件夹格式和 Node.js CLI。适用于能够发现 `SKILL.md` skill、运行本地脚本并将脚本输出交回当前模型的 harness。例如 Pi、Codex、Claude Code、Cursor、OpenCode 和 VS Code Copilot。列出这些名称表示格式和运行环境可能兼容，不代表本项目已在每个宿主中完成端到端测试。目前已验证 `skills` CLI 可以从远程仓库发现此 skill，离线测试也已通过；尚未逐一完成各宿主的集成测试。

脚本直接调用 DeepSeek 的 Search/Fetch HTTP API。只要 harness 能运行脚本并将输出交给模型，模型可以来自任何供应商。这与模型供应商提供的服务端原生搜索是两种集成方式；后者要求 API 和 harness 同时支持相应工具协议。

## 使用 DeepSeek 原生工具，还是本项目适配器？

DeepSeek 现在同时提供服务端网页工具和独立的 Search、Fetch API。如果使用兼容的 DeepSeek 模型和 API 协议，可以启用 `deepseek_web_search`，让模型自行决定何时网页搜索（也包括图片搜索）；也可以启用 `deepseek_read_url`，读取用户消息中提供的链接。搜索和结果上下文组装由 DeepSeek 服务端完成。目前官方 Web Tools 文档说明，这些工具可通过 Messages、Responses 和 Chat Completions API 配合 `deepseek-flash` 使用。Harness 必须发送对应工具声明，并能处理该协议的响应格式。

DeepSeek 自家的 DeepSeek Harness 还提供官方 `@deepseek-ai/dsh-web-deepseek-api` 插件，可将独立 Search/Fetch API 接入其 Web provider 层，不需要额外模型请求。DeepSeek Harness 也分别支持加载 Agent Skills 和连接外部 MCP server；这类通用能力并不代表本仓库是 DeepSeek 官方发布的包。

根据模型和 harness 选择接入方式：

- 使用 DeepSeek 模型，且 harness/API 集成支持 DeepSeek 服务端工具：使用原生 Web Tools，无需本项目的 Skill 或 MCP 适配器。
- 使用 DeepSeek Harness：优先使用它自带的 `@deepseek-ai/dsh-web-deepseek-api` provider 接入 Search/Fetch。
- 使用任意模型，且 harness 能发现 Agent Skill 并运行本地脚本：使用本项目 Skill。
- 使用任意模型，且 harness 支持 MCP：使用本项目 MCP server。
- 自行开发应用，需要控制请求并获取原始响应：直接调用独立 Search/Fetch API，或使用本项目 CLI。

Codex 另有 DeepSeek provider 集成和 Alpha Search。如果 Codex 已配置为使用 DeepSeek 并启用 Alpha Search，那么在该配置下本项目的搜索功能有重叠。若 Codex 继续使用其他模型，而你希望显式调用 DeepSeek Search，本项目仍然适用。OpenCode 的内置 `websearch` 使用其配置的 OpenCode、Exa 或 Parallel 搜索路径，并不代表它会自动调用 DeepSeek Search。详见 [DeepSeek Web Tools 文档](https://api-docs.deepseek.com/guides/web_tools/)、[DeepSeek Harness 的 Search/Fetch provider](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/web/web-deepseek-api)、[DeepSeek Harness Skill loader](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/skill/skill-filesystem)、[DeepSeek Harness MCP client](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client)、[Codex 集成说明](https://api-docs.deepseek.com/quick_start/agent_integrations/codex/)、[OpenAI Web Search API](https://developers.openai.com/api/docs/guides/tools-web-search) 和 [OpenCode 搜索服务说明](https://dev.opencode.ai/v2/docs/websearch/)。

## 相关方案

DeepSeek 网页搜索并非只有这一种集成方式。已有相近的 [DeepSeek Search Agent Skill](https://www.skills.sh/jpcaparas/skills/deepseek-search)，同样介绍官方 Search/Fetch API。Pi 用户也可以选择 [Pi 专用的 provider-native 搜索扩展](https://pi.dev/packages/pi-web-search)；第三方 MCP 项目，例如 [`ds-websearch-mcp`](https://github.com/prepaser/ds-websearch-mcp)，则将 API 暴露为 MCP 工具。不同方案在 harness 覆盖范围和 API 外部处理逻辑上各有取舍。本项目专注于最窄的路径：输入 DeepSeek 原生 Search/Fetch JSON，输出 API 原始响应正文。本项目由社区维护，非 DeepSeek 官方产品。

## 配置凭据

在 agent 进程的环境变量中设置 `DEEPSEEK_API_KEY`。也可以将它配置在外置文件 `~/.config/deepseek-search/.env` 中：

```dotenv
DEEPSEEK_API_KEY=your-key
```

在 Windows 上，`~` 表示当前用户目录。请将 key 保存在本仓库之外，不要将它作为命令行参数传入。

## 使用

该 skill 将 DeepSeek 原生 JSON 请求通过标准输入传给 CLI。以下示例从仓库根目录运行：

```powershell
'{"query":"DeepSeek Search API","count":5,"need_content":false}' | node .\skills\deepseek-search\scripts\deepseek-search.mjs search
'{"url":"https://api-docs.deepseek.com/guides/search/"}' | node .\skills\deepseek-search\scripts\deepseek-search.mjs fetch
```

Harness 调用 skill 脚本时，应根据 `skills/deepseek-search/SKILL.md` 所在目录解析脚本路径。

Search 接受 DeepSeek 原生字段：`query`、`count`、`ori_question`、`localization` 和 `need_content`。Fetch 接受 `url`。请求分别发送到 `https://api.deepseek.com/v1/tools/search` 或 `/v1/tools/fetch`。

成功和 API 错误响应正文都会原样写入 stdout。本地输入错误和传输错误会写入 stderr，并返回非零退出码。该 skill 不会总结、过滤、缓存或重试结果。

## 费用

DeepSeek 会对成功的 Search 和 Fetch 请求收费。空搜索结果、失败请求和超时不收费。使用前请查看最新的 [DeepSeek Search/Fetch 计费规则](https://api-docs.deepseek.com/guides/search/)。

## 测试

```powershell
npm test
```

测试使用模拟 HTTP 或本地 HTTP server，无需 API key，不会访问官方 API。

GitHub Actions 使用 Node.js 22 在 Windows 和 Linux 上运行 CLI 与 MCP 测试。从新克隆的仓库运行完整测试前，先安装两个 MCP 包：

```powershell
npm ci --prefix mcp/deepseek-search-mcp --ignore-scripts
npm ci --prefix mcp/deepseek-web-mcp --ignore-scripts
npm test
```

## 项目范围

这是一个非官方社区项目，直接调用 DeepSeek 有文档说明的 HTTP API，并提供 Agent Skill 与可选 MCP server 两种接入方式。本项目不隶属于 DeepSeek。

## 许可证

[MIT](LICENSE)。可单独安装的 skill 在 `LICENSE.txt` 中附带同一份许可证。DeepSeek API 的服务条款和使用费用另行适用。
