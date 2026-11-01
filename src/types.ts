/**
 * localmodels types.
 *
 * Every tool talks to one locally running Ollama server over its HTTP
 * API. There is no credential: the server is addressed by base URL
 * only (OLLAMA_HOST, default http://127.0.0.1:11434). HTTP access is
 * described by a minimal surface so tests can inject a fake fetch.
 */

export interface ChatMessage {
  role: string;
  content: string;
}

export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;

export interface OllamaResult {
  /** Parsed upstream JSON when the body was JSON, otherwise raw text. */
  data: unknown;
  /** The result rendered as text for display. */
  text: string;
}
