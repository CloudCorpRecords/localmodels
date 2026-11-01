import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
  normalizeBaseUrl,
  pullModel,
  showModel,
} from "../src/ollama.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

interface Captured { url?: string; init?: { method?: string; headers?: Record<string, string>; body?: string } }
const BASE = "http://127.0.0.1:11434";

function fake(captured: Captured, body = "{}", status = 200): FetchFn {
  return async (url, init) => {
    captured.url = url; captured.init = init;
    return { ok: status >= 200 && status < 300, status, statusText: status === 200 ? "OK" : "Error", headers: { get: () => null }, text: async () => body } satisfies HttpResponse;
  };
}
const sentBody = (c: Captured) => JSON.parse(c.init?.body ?? "{}");

describe("base URL handling", () => {
  it("defaults to the documented local address and honours OLLAMA_HOST", () => {
    assert.equal(baseUrlFromEnv({}), BASE);
    assert.equal(baseUrlFromEnv({ OLLAMA_HOST: "http://localhost:9999/" }), "http://localhost:9999");
    assert.equal(baseUrlFromEnv({ OLLAMA_HOST: "  " }), BASE);
  });
  it("normalises trailing slashes and a missing scheme", () => {
    assert.equal(normalizeBaseUrl("127.0.0.1:11434///"), "http://127.0.0.1:11434");
    assert.equal(normalizeBaseUrl("https://example.test/"), "https://example.test");
  });
});

describe("read tools", () => {
  it("list_models GETs /api/tags and returns parsed JSON", async () => {
    const c: Captured = {};
    const out = await listModels(fake(c, '{"models":[{"name":"llama3.2:latest"}]}'), BASE);
    assert.equal(c.url, `${BASE}/api/tags`); assert.equal(c.init?.method, "GET");
    assert.deepEqual((out.data as { models: unknown[] }).models, [{ name: "llama3.2:latest" }]);
  });
  it("list_running_models GETs /api/ps and get_version GETs /api/version", async () => {
    const c1: Captured = {}; await listRunningModels(fake(c1, '{"models":[]}'), BASE);
    assert.equal(c1.url, `${BASE}/api/ps`);
    const c2: Captured = {}; const v = await getVersion(fake(c2, '{"version":"0.9.0"}'), BASE);
    assert.equal(c2.url, `${BASE}/api/version`); assert.equal((v.data as { version: string }).version, "0.9.0");
  });
  it("show_model POSTs the model to /api/show", async () => {
    const c: Captured = {}; await showModel(fake(c), BASE, "llama3.2");
    assert.equal(c.url, `${BASE}/api/show`); assert.equal(c.init?.method, "POST");
    assert.deepEqual(sentBody(c), { model: "llama3.2" });
  });
});

describe("model management tools", () => {
  it("pull_model POSTs /api/pull with stream false", async () => {
    const c: Captured = {}; await pullModel(fake(c, '{"status":"success"}'), BASE, "qwen2.5");
    assert.equal(c.url, `${BASE}/api/pull`); assert.deepEqual(sentBody(c), { model: "qwen2.5", stream: false });
  });
  it("delete_model DELETEs /api/delete and tolerates an empty body", async () => {
    const c: Captured = {}; const out = await deleteModel(fake(c, ""), BASE, "old:model");
    assert.equal(c.init?.method, "DELETE"); assert.equal(c.url, `${BASE}/api/delete`);
    assert.deepEqual(sentBody(c), { model: "old:model" }); assert.equal(out.text, "OK");
  });
  it("copy_model POSTs source and destination to /api/copy", async () => {
    const c: Captured = {}; await copyModel(fake(c, ""), BASE, "llama3.2", "my-llama");
    assert.equal(c.url, `${BASE}/api/copy`); assert.deepEqual(sentBody(c), { source: "llama3.2", destination: "my-llama" });
  });
  it("rejects empty model names before any request", async () => {
    await assert.rejects(() => showModel(fake({}), BASE, "  "), /model must be a non-empty/);
    await assert.rejects(() => copyModel(fake({}), BASE, "a", ""), /destination must be a non-empty/);
  });
});

describe("inference tools", () => {
  it("generate_completion POSTs /api/generate with stream false and optional system", async () => {
    const c: Captured = {};
    const out = await generateCompletion(fake(c, '{"response":"hi","done":true}'), BASE, "llama3.2", "Say hi", "Be brief");
    assert.equal(c.url, `${BASE}/api/generate`);
    assert.deepEqual(sentBody(c), { model: "llama3.2", prompt: "Say hi", stream: false, system: "Be brief" });
    assert.equal((out.data as { response: string }).response, "hi");
    const c2: Captured = {}; await generateCompletion(fake(c2), BASE, "m", "p");
    assert.deepEqual(sentBody(c2), { model: "m", prompt: "p", stream: false });
    await assert.rejects(() => generateCompletion(fake({}), BASE, "m", ""), /prompt must be a non-empty/);
  });
  it("chat_completion POSTs /api/chat with the message list and stream false", async () => {
    const c: Captured = {};
    await chatCompletion(fake(c, '{"message":{"role":"assistant","content":"yo"}}'), BASE, "llama3.2", [{ role: "user", content: "hi" }]);
    assert.equal(c.url, `${BASE}/api/chat`);
    assert.deepEqual(sentBody(c), { model: "llama3.2", messages: [{ role: "user", content: "hi" }], stream: false });
    await assert.rejects(() => chatCompletion(fake({}), BASE, "m", []), /non-empty array/);
    await assert.rejects(() => chatCompletion(fake({}), BASE, "m", [{ role: "", content: "x" }]), /role/);
  });
  it("create_embedding POSTs /api/embed with model and input", async () => {
    const c: Captured = {};
    const out = await createEmbedding(fake(c, '{"embeddings":[[0.1,0.2]]}'), BASE, "nomic-embed-text", "hello");
    assert.equal(c.url, `${BASE}/api/embed`); assert.deepEqual(sentBody(c), { model: "nomic-embed-text", input: "hello" });
    assert.deepEqual((out.data as { embeddings: number[][] }).embeddings, [[0.1, 0.2]]);
    await assert.rejects(() => createEmbedding(fake({}), BASE, "m", ""), /input must be a non-empty/);
  });
});

describe("failure honesty", () => {
  it("surfaces HTTP failures with status and body detail", async () => {
    await assert.rejects(() => showModel(fake({}, '{"error":"model not found"}', 404), BASE, "nope"), /HTTP 404.*model not found/);
  });
  it("surfaces connection failures with the underlying error, naming the URL", async () => {
    const failing: FetchFn = async () => { throw new Error("connect ECONNREFUSED 127.0.0.1:11434"); };
    await assert.rejects(() => listModels(failing, BASE), /Failed to reach Ollama at http:\/\/127\.0\.0\.1:11434\/api\/tags: connect ECONNREFUSED/);
  });
  it("returns raw text when the upstream body is not JSON", async () => {
    const out = await pullModel(fake({}, "pulling...\nsuccess"), BASE, "m");
    assert.equal(out.text, "pulling...\nsuccess");
  });
});
