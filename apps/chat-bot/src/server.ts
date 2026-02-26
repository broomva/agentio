/**
 * @agentio/chat-bot — Bun HTTP server with AgentLoop
 *
 * POST /api/chat — receives { messages }, returns SSE stream
 * GET  /health   — health check
 */

import { AgentLoop } from "@agentio/agent-runtime";
import type { ChatMessage, StreamState } from "@agentio/protocol";

const DEFAULT_MODEL_ID = "claude-sonnet-4-20250514";
const PORT = parseInt(process.env.PORT ?? "3001", 10);

async function createModel() {
  const { anthropic } = await import("@ai-sdk/anthropic");
  const modelId = process.env.AGENTIO_MODEL ?? DEFAULT_MODEL_ID;
  return anthropic(modelId);
}

// ── Shared AgentLoop ─────────────────────────────────────────────────────────

let loop: AgentLoop | null = null;

async function getLoop(): Promise<AgentLoop> {
  if (loop) return loop;

  const model = await createModel();
  const rootDir = process.env.AGENTIO_ROOT ?? process.cwd();

  loop = new AgentLoop({
    model,
    rootDir,
    agentId: "chat-bot@0.1.0",
    policyProfile: {
      name: "chat_interactive",
      rules: [
        { action: "tool.execute", scope: "*", decision: "ALLOW" },
      ],
      budgets: {
        max_time_ms: 3_600_000,
        max_tokens: 500_000,
        max_tool_calls: 100,
      },
    },
    customInstructions: "You are a chat assistant. Be helpful and conversational.",
  });

  await loop.boot();
  return loop;
}

// ── Request Handler ──────────────────────────────────────────────────────────

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Health check
  if (url.pathname === "/health" && req.method === "GET") {
    return Response.json(
      { status: "ok", agent: "chat-bot@0.1.0" },
      { headers: corsHeaders },
    );
  }

  // Chat endpoint
  if (url.pathname === "/api/chat" && req.method === "POST") {
    try {
      const body = (await req.json()) as { messages?: ChatMessage[] };
      const messages = body.messages ?? [];

      if (messages.length === 0) {
        return Response.json(
          { error: "No messages provided" },
          { status: 400, headers: corsHeaders },
        );
      }

      // Get the last user message
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      if (!lastUserMsg) {
        return Response.json(
          { error: "No user message found" },
          { status: 400, headers: corsHeaders },
        );
      }

      const userText = typeof lastUserMsg.content === "string"
        ? lastUserMsg.content
        : "[complex content]";

      const agentLoop = await getLoop();

      // Create a readable stream that yields SSE events
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();

          try {
            for await (const state of agentLoop.tick(userText, "chat")) {
              // Emit SSE event for each state update
              const event = formatSSEEvent(state);
              controller.enqueue(encoder.encode(event));

              if (state.phase === "complete" || state.phase === "error") {
                // Send final event
                controller.enqueue(
                  encoder.encode(`data: [DONE]\n\n`),
                );
                break;
              }
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", error: errMsg })}\n\n`,
              ),
            );
          }

          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "x-vercel-ai-ui-message-stream": "v1",
        },
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return Response.json(
        { error: errMsg },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  return Response.json(
    { error: "Not found" },
    { status: 404, headers: corsHeaders },
  );
}

// ── SSE Formatting ───────────────────────────────────────────────────────────

function formatSSEEvent(state: StreamState): string {
  switch (state.phase) {
    case "streaming":
    case "complete":
      return `data: ${JSON.stringify({
        type: "text-delta",
        text: state.partial_text,
        phase: state.phase,
        usage: state.cumulative_usage,
      })}\n\n`;

    case "tool-calling":
      return `data: ${JSON.stringify({
        type: "tool-calling",
        invocations: state.completed_invocations,
        pending: state.pending_tool_calls,
      })}\n\n`;

    case "error":
      return `data: ${JSON.stringify({
        type: "error",
        error: state.error,
      })}\n\n`;

    default:
      return `data: ${JSON.stringify({
        type: "status",
        phase: state.phase,
      })}\n\n`;
  }
}

// ── Server Start ─────────────────────────────────────────────────────────────

export function startServer(port: number = PORT) {
  // Use globalThis.Bun for Bun runtime, with type assertion
  const BunRuntime = (globalThis as any).Bun;
  if (!BunRuntime?.serve) {
    throw new Error("This server requires the Bun runtime. Run with: bun run src/index.ts");
  }

  const server = BunRuntime.serve({
    port,
    fetch: handleRequest,
  });

  console.log(`agentio chat-bot v0.1.0 listening on http://localhost:${server.port}`);
  return server;
}

export { handleRequest };
