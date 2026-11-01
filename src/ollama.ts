/**
 * localmodels core: a client for the Ollama local HTTP API.
 *
 * Ollama runs on the user's own machine and serves a keyless HTTP API
 * (default http://127.0.0.1:11434). The base URL comes from the
 * OLLAMA_HOST environment variable when set; no credential of any
 * kind is invented or sent. Each tool maps to one documented API
 * route:
 *
 *   list_models         GET    /api/tags
 *   show_model          POST   /api/show
 *   pull_model          POST   /api/pull     (stream: false)
 *   delete_model        DELETE /api/delete
 *   copy_model          POST   /api/copy
 *   generate_completion POST   /api/generate (stream: false)
 *   chat_completion     POST   /api/chat     (stream: false)
 *   create_embedding    POST   /api/embed
 *   list_running_models GET    /api/ps
 *   get_version         GET    /api/version
 *
 * A connection failure (the common case: no server running) is
 * surfaced as an error carrying the underlying message — never as a
 * fabricated empty result. All HTTP goes through an injected FetchFn.
 */
import type { ChatMessage, FetchFn, OllamaResult } from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_BASE_URL = "http://127.0.0.1:11434";

export function baseUrlFromEnv(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = typeof env.OLLAMA_HOST === "string" ? env.OLLAMA_HOST.trim() : "";
  return normalizeBaseUrl(raw || DEFAULT_BASE_URL);
}

export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_BASE_URL;
  return trimmed.includes("://") ? trimmed : `http://${trimmed}`;
}

function requireModel(model: unknown, field = "model"): string {
  const value = typeof model === "string" ? model.trim() : "";
  if (!value) throw new Error(`${field} must be a non-empty string`);
  return value;
}

async function request(
  fetchFn: FetchFn,
  baseUrl: string,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<OllamaResult> {
  const url = `${normalizeBaseUrl(baseUrl)}${path}`;
  let response;
  try {
    response = await fetchFn(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(
      `Failed to reach Ollama at ${url}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const text = await response.text();
  if (!response.ok) {
    const detail = text.trim().slice(0, 300);
    throw new Error(
      `Ollama request failed: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}${detail ? `: ${detail}` : ""}`,
    );
  }
  if (!text.trim()) return { data: null, text: "OK" };
  try {
    const data: unknown = JSON.parse(text);
    return { data, text: JSON.stringify(data, null, 2) };
  } catch {
    // Some routes answer newline-delimited JSON when streaming was not
    // fully disabled upstream; return the raw body rather than guessing.
    return { data: text, text };
  }
}

export async function listModels(fetchFn: FetchFn, baseUrl: string): Promise<OllamaResult> {
  return request(fetchFn, baseUrl, "GET", "/api/tags");
}

export async function showModel(fetchFn: FetchFn, baseUrl: string, model: string): Promise<OllamaResult> {
  return request(fetchFn, baseUrl, "POST", "/api/show", { model: requireModel(model) });
}

export async function pullModel(fetchFn: FetchFn, baseUrl: string, model: string): Promise<OllamaResult> {
  return request(fetchFn, baseUrl, "POST", "/api/pull", { model: requireModel(model), stream: false });
}

export async function deleteModel(fetchFn: FetchFn, baseUrl: string, model: string): Promise<OllamaResult> {
  return request(fetchFn, baseUrl, "DELETE", "/api/delete", { model: requireModel(model) });
}

export async function copyModel(
  fetchFn: FetchFn,
  baseUrl: string,
  source: string,
  destination: string,
): Promise<OllamaResult> {
  return request(fetchFn, baseUrl, "POST", "/api/copy", {
    source: requireModel(source, "source"),
    destination: requireModel(destination, "destination"),
  });
}

export async function generateCompletion(
  fetchFn: FetchFn,
  baseUrl: string,
  model: string,
  prompt: string,
  system?: string,
): Promise<OllamaResult> {
  const p = typeof prompt === "string" ? prompt : "";
  if (!p) throw new Error("prompt must be a non-empty string");
  const body: Record<string, unknown> = { model: requireModel(model), prompt: p, stream: false };
  if (typeof system === "string" && system) body.system = system;
  return request(fetchFn, baseUrl, "POST", "/api/generate", body);
}

export async function chatCompletion(
  fetchFn: FetchFn,
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
): Promise<OllamaResult> {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("messages must be a non-empty array");
  }
  for (const m of messages) {
    if (!m || typeof m.role !== "string" || !m.role || typeof m.content !== "string") {
      throw new Error("each message must have a non-empty role and a string content");
    }
  }
  return request(fetchFn, baseUrl, "POST", "/api/chat", {
    model: requireModel(model),
    messages,
    stream: false,
  });
}

export async function createEmbedding(
  fetchFn: FetchFn,
  baseUrl: string,
  model: string,
  input: string,
): Promise<OllamaResult> {
  const value = typeof input === "string" ? input : "";
  if (!value) throw new Error("input must be a non-empty string");
  return request(fetchFn, baseUrl, "POST", "/api/embed", { model: requireModel(model), input: value });
}

export async function listRunningModels(fetchFn: FetchFn, baseUrl: string): Promise<OllamaResult> {
  return request(fetchFn, baseUrl, "GET", "/api/ps");
}

export async function getVersion(fetchFn: FetchFn, baseUrl: string): Promise<OllamaResult> {
  return request(fetchFn, baseUrl, "GET", "/api/version");
}
