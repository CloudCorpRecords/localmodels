# localmodels

localmodels puts a locally running Ollama server behind an MCP
interface (with a matching CLI). List what is installed, pull or
remove models, inspect one, then generate, chat, or embed — all
against models that run on your own machine.

There is no API key and no account. The server address comes from
`OLLAMA_HOST` and defaults to `http://127.0.0.1:11434`. A value
without a scheme gets `http://` in front of it, and trailing slashes
are ignored. If no Ollama server is reachable, calls fail with the
underlying connection error — they never invent an empty result.

## Install

```bash
npx @reneturcios/localmodels list
docker run -i ghcr.io/cloudcorprecords/localmodels
```

In a container, point `OLLAMA_HOST` at the host (for example with
host networking), since `127.0.0.1` inside the container is the
container itself.

## CLI

```bash
localmodels list
localmodels show llama3.2
localmodels pull qwen2.5
localmodels delete old:model
localmodels copy llama3.2 my-llama
localmodels generate llama3.2 "Write a haiku about autumn"
localmodels chat llama3.2 "Hello!"
localmodels embed nomic-embed-text "some text to embed"
localmodels running
localmodels version
localmodels --version
```

Exit codes: `0` success, `1` server/lookup error, `2` usage error.

## MCP server

```bash
npx -y @reneturcios/localmodels mcp
```

```json
{
  "mcpServers": {
    "localmodels": {
      "command": "npx",
      "args": ["-y", "@reneturcios/localmodels", "mcp"],
      "env": { "OLLAMA_HOST": "http://127.0.0.1:11434" }
    }
  }
}
```

The `env` block is optional; the default address is used without it.

### Tools

| Tool | Input | Upstream route |
| --- | --- | --- |
| `list_models` | — | `GET /api/tags` |
| `show_model` | `model` | `POST /api/show` |
| `pull_model` | `model` | `POST /api/pull` (stream: false) |
| `delete_model` | `model` | `DELETE /api/delete` |
| `copy_model` | `source`, `destination` | `POST /api/copy` |
| `generate_completion` | `model`, `prompt`, `system` (optional) | `POST /api/generate` (stream: false) |
| `chat_completion` | `model`, `messages` (array of `{role, content}`) | `POST /api/chat` (stream: false) |
| `create_embedding` | `model`, `input` | `POST /api/embed` |
| `list_running_models` | — | `GET /api/ps` |
| `get_version` | — | `GET /api/version` |

## Development

```bash
npm install
npm run build
npm test
npm run dev
```

Tests run entirely on fake-fetch fixtures; no live Ollama server is
required or contacted.

## License

MIT — see `LICENSE`.
