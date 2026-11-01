/**
 * localmodels MCP server. Tools: list_models, show_model, pull_model,
 * delete_model, copy_model, generate_completion, chat_completion,
 * create_embedding, list_running_models, get_version.
 *
 * Low-level Server API with explicit inputSchema literals (the
 * McpServer+zod path injects $schema/additionalProperties and breaks
 * parity). Zod still validates call args.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
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

const ModelArgs = z.object({ model: z.string() });
const CopyArgs = z.object({ source: z.string(), destination: z.string() });
const GenerateArgs = z.object({ model: z.string(), prompt: z.string(), system: z.string().optional() });
const ChatArgs = z.object({
  model: z.string(),
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
});
const EmbedArgs = z.object({ model: z.string(), input: z.string() });
const NoArgs = z.object({});

const TOOLS = [
  {
    name: "list_models",
    description: "List the models available on the local Ollama server.",
    inputSchema: { type: "object" as const, properties: {}, required: [] as string[] },
  },
  {
    name: "show_model",
    description: "Show information about a model on the local Ollama server.",
    inputSchema: {
      type: "object" as const,
      properties: { model: { type: "string", description: "The name of the model to show information for (e.g. 'llama3.2')." } },
      required: ["model"],
    },
  },
  {
    name: "pull_model",
    description: "Pull a model from the registry onto the local Ollama server.",
    inputSchema: {
      type: "object" as const,
      properties: { model: { type: "string", description: "The name of the model to pull from the registry (e.g. 'llama3.2')." } },
      required: ["model"],
    },
  },
  {
    name: "delete_model",
    description: "Delete a model from the local Ollama server.",
    inputSchema: {
      type: "object" as const,
      properties: { model: { type: "string", description: "The name of the model to delete from the local Ollama server." } },
      required: ["model"],
    },
  },
  {
    name: "copy_model",
    description: "Copy a model on the local Ollama server under a new name.",
    inputSchema: {
      type: "object" as const,
      properties: { source: { type: "string", description: "The name of the existing model to copy from." }, destination: { type: "string", description: "The new model name to copy the source model to." } },
      required: ["source", "destination"],
    },
  },
  {
    name: "generate_completion",
    description: "Generate a completion for a prompt using a local model.",
    inputSchema: {
      type: "object" as const,
      properties: {
        model: { type: "string", description: "The name of the local model to generate the completion with." },
        prompt: { type: "string", description: "The prompt text to generate a completion for." },
        system: { type: "string", description: "Optional system prompt sent with the generation request when non-empty." },
      },
      required: ["model", "prompt"],
    },
  },
  {
    name: "chat_completion",
    description: "Generate a chat response for a list of messages using a local model.",
    inputSchema: {
      type: "object" as const,
      properties: {
        model: { type: "string", description: "The name of the local model to generate the chat response with." },
        messages: {
          type: "array",
          description: "The non-empty list of chat messages (each with a role and content) to send to the model.",
          items: {
            type: "object",
            properties: { role: { type: "string", description: "The role of this chat message (e.g. 'user', 'assistant', or 'system')." }, content: { type: "string", description: "The text content of this chat message." } },
            required: ["role", "content"],
          },
        },
      },
      required: ["model", "messages"],
    },
  },
  {
    name: "create_embedding",
    description: "Create embeddings for input text using a local model.",
    inputSchema: {
      type: "object" as const,
      properties: { model: { type: "string", description: "The name of the local embedding model to use." }, input: { type: "string", description: "The input text to create embeddings for." } },
      required: ["model", "input"],
    },
  },
  {
    name: "list_running_models",
    description: "List the models currently running on the local Ollama server.",
    inputSchema: { type: "object" as const, properties: {}, required: [] as string[] },
  },
  {
    name: "get_version",
    description: "Get the version of the local Ollama server.",
    inputSchema: { type: "object" as const, properties: {}, required: [] as string[] },
  },
];

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}
function errorResult(err: unknown) {
  return { content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
}

const server = new Server({ name: "localmodels", version: VERSION }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const base = baseUrlFromEnv();
  try {
    switch (name) {
      case "list_models": NoArgs.parse(args ?? {}); return textResult((await listModels(fetchFn, base)).text);
      case "show_model": { const p = ModelArgs.parse(args ?? {}); return textResult((await showModel(fetchFn, base, p.model)).text); }
      case "pull_model": { const p = ModelArgs.parse(args ?? {}); return textResult((await pullModel(fetchFn, base, p.model)).text); }
      case "delete_model": { const p = ModelArgs.parse(args ?? {}); return textResult((await deleteModel(fetchFn, base, p.model)).text); }
      case "copy_model": { const p = CopyArgs.parse(args ?? {}); return textResult((await copyModel(fetchFn, base, p.source, p.destination)).text); }
      case "generate_completion": { const p = GenerateArgs.parse(args ?? {}); return textResult((await generateCompletion(fetchFn, base, p.model, p.prompt, p.system)).text); }
      case "chat_completion": { const p = ChatArgs.parse(args ?? {}); return textResult((await chatCompletion(fetchFn, base, p.model, p.messages)).text); }
      case "create_embedding": { const p = EmbedArgs.parse(args ?? {}); return textResult((await createEmbedding(fetchFn, base, p.model, p.input)).text); }
      case "list_running_models": NoArgs.parse(args ?? {}); return textResult((await listRunningModels(fetchFn, base)).text);
      case "get_version": NoArgs.parse(args ?? {}); return textResult((await getVersion(fetchFn, base)).text);
    }
  } catch (err) {
    return errorResult(err);
  }
  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}
void main();
