#!/usr/bin/env node
/**
 * localmodels CLI.
 *   localmodels list | show <model> | pull <model> | delete <model>
 *   localmodels copy <source> <destination>
 *   localmodels generate <model> <prompt...> | chat <model> <message...>
 *   localmodels embed <model> <input...> | running | version | mcp
 * Base URL: OLLAMA_HOST (default http://127.0.0.1:11434). Keyless.
 * Exit codes: 0 success, 1 error, 2 usage.
 */
import {
  baseUrlFromEnv,
  chatCompletion,
  copyModel,
  createEmbedding,
  deleteModel,
  generateCompletion,
  getVersion,
  listModels,
  listRunningModels,
  pullModel,
  showModel,
  VERSION,
} from "./ollama.js";
import type { FetchFn } from "./types.js";

function usage(): never {
  console.error(`Usage:
  localmodels list
  localmodels show <model>
  localmodels pull <model>
  localmodels delete <model>
  localmodels copy <source> <destination>
  localmodels generate <model> <prompt...>
  localmodels chat <model> <message...>
  localmodels embed <model> <input...>
  localmodels running
  localmodels version
  localmodels mcp
  localmodels --version`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") { console.log(VERSION); return; }
  if (cmd === "mcp") { await import("./mcp.js"); return; }
  if (!cmd) usage();
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const base = baseUrlFromEnv();
  try {
    if (cmd === "list") console.log((await listModels(fetchFn, base)).text);
    else if (cmd === "show") { if (!rest[0]) usage(); console.log((await showModel(fetchFn, base, rest[0])).text); }
    else if (cmd === "pull") { if (!rest[0]) usage(); console.log((await pullModel(fetchFn, base, rest[0])).text); }
    else if (cmd === "delete") { if (!rest[0]) usage(); console.log((await deleteModel(fetchFn, base, rest[0])).text); }
    else if (cmd === "copy") { if (!rest[0] || !rest[1]) usage(); console.log((await copyModel(fetchFn, base, rest[0], rest[1])).text); }
    else if (cmd === "generate") { if (!rest[0] || !rest[1]) usage(); console.log((await generateCompletion(fetchFn, base, rest[0], rest.slice(1).join(" "))).text); }
    else if (cmd === "chat") { if (!rest[0] || !rest[1]) usage(); console.log((await chatCompletion(fetchFn, base, rest[0], [{ role: "user", content: rest.slice(1).join(" ") }])).text); }
    else if (cmd === "embed") { if (!rest[0] || !rest[1]) usage(); console.log((await createEmbedding(fetchFn, base, rest[0], rest.slice(1).join(" "))).text); }
    else if (cmd === "running") console.log((await listRunningModels(fetchFn, base)).text);
    else if (cmd === "version") console.log((await getVersion(fetchFn, base)).text);
    else usage();
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
void main();
