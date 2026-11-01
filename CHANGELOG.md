# Changelog

## 0.1.0 (2026-10-26)

- Initial release.
- CLI: `list`, `show`, `pull`, `delete`, `copy`, `generate`, `chat`,
  `embed`, `running`, and `version` subcommands.
- MCP server (`localmodels mcp`, stdio) with ten tools mapping 1:1 to
  the documented Ollama HTTP API routes: list/show/pull/delete/copy
  models, generate, chat, embed, list running models, and version.
- Keyless by design: the base URL comes from `OLLAMA_HOST`
  (default `http://127.0.0.1:11434`); no credential is sent.
- Generation and chat are non-streaming (`stream: false`).
- Connection failures surface the underlying error as a tool error.
- All HTTP goes through an injectable fetch function, so tests run on
  fixtures with no network access.
