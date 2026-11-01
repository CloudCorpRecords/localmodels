# BUILD-REPORT — localmodels (original: ollama)

Built 2026-10-26 for the MCP Rebuild 100 program. Local only; nothing
pushed or published.

## Identity

- npm: `@reneturcios/localmodels`, bin `localmodels`, version 0.1.0
- Registry name: `io.github.CloudCorpRecords/localmodels`
  (matches package.json `mcpName`, server.json `name`, and the
  Dockerfile `io.modelcontextprotocol.server.name` label)
- server.json description: 77 chars (≤100, counted)
- server.json OCI package entry: no `version` field (version only in
  the tagged identifier `ghcr.io/cloudcorprecords/localmodels:0.1.0`)

## Tools (10/10)

Defined from the public Ollama HTTP API plus the common community
Ollama MCP surface (see fixture `_source`):

| Tool | Upstream route | Required args |
| --- | --- | --- |
| `list_models` | `GET /api/tags` | — |
| `show_model` | `POST /api/show` | `model` |
| `pull_model` | `POST /api/pull` (`stream: false`) | `model` |
| `delete_model` | `DELETE /api/delete` | `model` |
| `copy_model` | `POST /api/copy` | `source`, `destination` |
| `generate_completion` | `POST /api/generate` (`stream: false`) | `model`, `prompt` (`system` optional) |
| `chat_completion` | `POST /api/chat` (`stream: false`) | `model`, `messages[] {role, content}` |
| `create_embedding` | `POST /api/embed` | `model`, `input` |
| `list_running_models` | `GET /api/ps` | — |
| `get_version` | `GET /api/version` | — |

Registered via the low-level MCP `Server` API with explicit
inputSchema literals; zod validates call arguments.

## Implementation

- Keyless by design: no credential is invented or sent. The base URL
  comes from the `OLLAMA_HOST` env var, default
  `http://127.0.0.1:11434`; schemeless values get `http://` and
  trailing slashes are stripped.
- All HTTP goes through an injectable `FetchFn`. JSON bodies are
  parsed and re-rendered; non-JSON bodies are returned raw rather
  than guessed at; empty success bodies report `OK`.
- Connection failure is an honest error carrying the underlying
  message: verified live in this VM (no Ollama running) —
  `node dist/cli.js version` exits 1 with
  `Failed to reach Ollama at http://127.0.0.1:11434/api/version: fetch failed`.

## Verification (all foreground, verified from disk/output)

- tsc: `npx tsc` exit 0; `dist/cli.js` present; `node dist/cli.js --version` → `0.1.0`
- Tests: 15/15 pass (`npm test`, fake fetch only — every route's
  method/URL/body, base-URL handling, validation, HTTP failure,
  connection failure, non-JSON body)
- Parity: fixture `harness/fixtures/ollama-tools-original.json`
  (docs-derived defined spec, labelled in `_source`) vs live stdio
  rebuild via `harness/parity.py` → `parity_pct == 100.0`,
  identical 10/10, output in `parity-out/parity.json` (verdict PASS)

## Honest gaps

- No live Ollama server exists in this VM, so no live upstream call
  was made or claimed; happy paths are fake-fetch tested only and
  upstream response-shape drift is unverified until a publish-wave
  smoke against a real server.
- Parameter naming is the defined docs-derived spec (`model`,
  `source`/`destination`, embedding `input` as a single string);
  other community servers vary (e.g. `name`, array inputs) — flagged
  in the fixture `_source`.
- Container note: a containerised localmodels reaches a host Ollama
  only via `OLLAMA_HOST` / host networking (`127.0.0.1` inside the
  container is the container); the container smoke covers
  initialize/usage only.
- Lockfile flag: `package-lock.json` is a copy of the libdocs
  lockfile with identity fields edited (name, bin). **Clean lockfile
  regeneration (no node_modules present) is required before
  publish** — fleet lesson 2026-10-25 / Blocker 3.
- mcpaudit / mcpvet / shipcheck pre-publish gate not run (belongs to
  the publish wave, per SCOREBOARD).
