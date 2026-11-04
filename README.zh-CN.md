# DeepSeek Search and Fetch Skill

简体中文 | [English](README.md)

一个可安装的 Agent Skill，可在兼容的 agent harness 中调用 DeepSeek 官方 Search 和 Fetch API。

## 为什么需要它

配置 API key 只会选择并认证模型供应商，并不会自动让每个 harness 获得该供应商的服务端网页搜索能力。搜索能力取决于模型 API、harness 对工具协议的支持，以及 harness 配置的搜索服务。Harness 可能自带网页搜索、支持模型供应商的原生搜索，也可能没有配置搜索。

这个 skill 为能够运行本地 Node.js 脚本的 agent，提供一个明确调用 DeepSeek Search 和 Fetch 的选项。搜索使用 DeepSeek 的索引，而 agent 可以继续使用当前模型，无论它来自 DeepSeek 还是其他供应商。它不模拟浏览器，也不让模型生成搜索结果。

## 设计

Skill 将 DeepSeek 原生 JSON 请求发送到官方 Search 或 Fetch 接口，并将 API 响应正文原样写出。它不调用模型、不总结或过滤结果、不缓存、不重试，也不额外加入 MCP 协议层。Agent 自行决定何时搜索、要抓取哪些结果页面，以及如何在答复中使用返回内容。

这是一个小型适配器，不是研究代理，也不打算取代所有 harness 自带的搜索功能。当你希望把 DeepSeek Search/Fetch 作为独立于当前模型的检索后端时，可以使用它。如果 harness 已提供你需要的搜索服务和行为，继续使用现有集成即可。

## 安装

通过开源的 [`skills` CLI](https://github.com/vercel-labs/skills) 安装：

```powershell
npx skills add Nobody-ly/deepseek-search-skill --skill deepseek-search --global
```

也可以将仓库中的 `SKILL.md` 和 `scripts/` 复制到 agent 的 skills 目录。该 skill 遵循开放的 Agent Skills 文件夹格式，无需安装 npm 包。

## 环境要求

- Node.js 22 或更高版本
- 有 Search/Fetch 权限的 DeepSeek API key

## Harness 兼容性

本 skill 使用可移植的 Agent Skills 文件夹格式和 Node.js CLI。适用于能够发现 `SKILL.md` skill、运行本地脚本并将脚本输出交回当前模型的 harness。例如 Pi、Codex、Claude Code、Cursor、OpenCode 和 VS Code Copilot。列出这些名称表示格式和运行环境可能兼容，不代表本项目已在每个宿主中完成端到端测试。目前已验证 `skills` CLI 可以从远程仓库发现此 skill，离线测试也已通过；尚未逐一完成各宿主的集成测试。

脚本直接调用 DeepSeek 的 Search/Fetch HTTP API。只要 harness 能运行脚本并将输出交给模型，模型可以来自任何供应商。这与模型供应商提供的服务端原生搜索是两种集成方式；后者要求 API 和 harness 同时支持相应工具协议。

例如，DeepSeek Responses API 的 `web_search` 目前要求使用 `deepseek-v4-pro`，并且 harness 必须发送和处理 Responses API 工具格式。OpenAI Responses API 也提供自己的 `web_search`，同样需要客户端支持。OpenCode 的内置 `websearch` 使用其配置的 OpenCode、Exa 或 Parallel 搜索路径，并不代表它会自动调用 DeepSeek Search。详见 [DeepSeek Responses API 工具支持](https://api-docs.deepseek.com/guides/responses_api/)、[OpenAI Web Search API](https://developers.openai.com/api/docs/guides/tools-web-search) 和 [OpenCode 搜索服务说明](https://dev.opencode.ai/v2/docs/websearch/)。

## 相关方案

DeepSeek 网页搜索并非只有这一种集成方式。已有相近的 [DeepSeek Search Agent Skill](https://www.skills.sh/jpcaparas/skills/deepseek-search)，同样介绍官方 Search/Fetch API。Pi 用户也可以选择 [Pi 专用的 provider-native 搜索扩展](https://pi.dev/packages/pi-web-search)；第三方 MCP 项目，例如 [`ds-websearch-mcp`](https://github.com/prepaser/ds-websearch-mcp)，则将 API 暴露为 MCP 工具。不同方案在 harness 覆盖范围和 API 外部处理逻辑上各有取舍。本项目专注于最窄的路径：输入 DeepSeek 原生 Search/Fetch JSON，输出 API 原始响应正文。本项目由社区维护，非 DeepSeek 官方产品。

## 配置凭据

在 agent 进程的环境变量中设置 `DEEPSEEK_API_KEY`。也可以将它配置在外置文件 `~/.config/deepseek-search/.env` 中：

```dotenv
DEEPSEEK_API_KEY=your-key
```

在 Windows 上，`~` 表示当前用户目录。请将 key 保存在本仓库之外，不要将它作为命令行参数传入。

## 使用

该 skill 将 DeepSeek 原生 JSON 请求通过标准输入传给 CLI：

```powershell
'{"query":"DeepSeek Search API","count":5,"need_content":false}' | node .\scripts\deepseek-search.mjs search
'{"url":"https://api-docs.deepseek.com/guides/search/"}' | node .\scripts\deepseek-search.mjs fetch
```

Harness 调用脚本时，应根据此 `SKILL.md` 所在目录解析脚本路径。

Search 接受 DeepSeek 原生字段：`query`、`count`、`ori_question`、`localization` 和 `need_content`。Fetch 接受 `url`。请求分别发送到 `https://api.deepseek.com/v1/tools/search` 或 `/v1/tools/fetch`。

成功和 API 错误响应正文都会原样写入 stdout。本地输入错误和传输错误会写入 stderr，并返回非零退出码。该 skill 不会总结、过滤、缓存或重试结果。

## 费用

DeepSeek 会对成功的 Search 和 Fetch 请求收费。空搜索结果、失败请求和超时不收费。使用前请查看最新的 [DeepSeek Search/Fetch 计费规则](https://api-docs.deepseek.com/guides/search/)。

## 测试

```powershell
npm test
```

测试使用模拟 HTTP 传输，无需 API key，也不会发起网络请求。

## 项目范围

这是一个非官方社区 skill，直接调用 DeepSeek 有文档说明的 HTTP API。它不是 MCP server，也不隶属于 DeepSeek。
