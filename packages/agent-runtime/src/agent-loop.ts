/**
 * AgentLoop — The OODA cycle with AI SDK v6.
 *
 * OBSERVE: AgentFs reads .agent/ state
 * ORIENT:  buildSystemPrompt()
 * DECIDE:  streamText() via AI SDK
 * ACT:     tool execution through bridged tools
 * RECORD:  RunManager + AgentFs persistence
 */

import type { LanguageModel, ToolSet, StepResult } from "ai";
import { generateText, stepCountIs } from "ai";

import type {
  AppSchema,
  PolicyProfile,
  AgentEvent,
  ChatMessage,
  StreamState,
  StepRecord,
  UsageSnapshot,
  ToolInvocation,
} from "@agentio/protocol";
import {
  createRunEnvelope,
  createEvent,
  now,
  generateId,
  emptyUsage,
  idleStreamState,
} from "@agentio/protocol";

import { parseSchema, deriveToolContracts, describeSchema } from "@agentio/kernel-schema";
import { buildAgentState, buildSessionState } from "@agentio/kernel-state";
import { RunManager } from "@agentio/kernel-run";
import { ArtifactStore } from "@agentio/kernel-artifact";
import { evaluate, checkBudget } from "@agentio/kernel-policy";
import { AgentFs, FilesystemBackend } from "@agentio/driver-exec";

import { bridgeTools, createPolicyGate } from "./tool-bridge.js";
import type { ToolExecutor } from "./tool-bridge.js";
import { toUsageSnapshot, accumulateUsage, toBudgetUsage } from "./usage-bridge.js";
import { toAiSdkMessages, fromAiSdkAssistantContent, extractText } from "./message-bridge.js";
import { buildSystemPrompt } from "./prompt-builder.js";

import type { AgentState, SessionState } from "@agentio/protocol";

// ── Config ───────────────────────────────────────────────────────────────────

export interface AgentLoopConfig {
  /** The language model to use (e.g. anthropic("claude-sonnet-4-20250514")). */
  model: LanguageModel;
  /** Path containing .agent/ directory. */
  rootDir: string;
  /** Unique agent identifier. */
  agentId: string;
  /** Policy profile for budget and rule enforcement. */
  policyProfile: PolicyProfile;
  /** Max LLM roundtrips per tick. Default: 10. */
  maxStepsPerTick?: number;
  /** Additional instructions injected into system prompt. */
  customInstructions?: string;
  /** Callback when StreamState changes. */
  onStreamStateChange?: (state: StreamState) => void;
  /** Callback when a step completes. */
  onStepComplete?: (step: StepRecord) => void;
  /** Callback for all agent events. */
  onEvent?: (event: AgentEvent) => void;
  /** Override default capability executor. */
  toolExecutor?: ToolExecutor;
}

// ── AgentLoop ────────────────────────────────────────────────────────────────

export class AgentLoop {
  private config: AgentLoopConfig;
  private fs: AgentFs;
  private runManager: RunManager;
  private artifactStore: ArtifactStore;
  private schema: AppSchema | null = null;
  private tools: ToolSet = {};
  private session: SessionState | null = null;
  private agentState: AgentState;
  private history: ChatMessage[] = [];
  private streamState: StreamState;
  private stepRecords: StepRecord[] = [];
  private activeRunId: string | null = null;
  private bootedAt: number | null = null;

  constructor(config: AgentLoopConfig) {
    this.config = config;
    this.fs = new AgentFs(config.rootDir);
    this.runManager = new RunManager();
    this.artifactStore = new ArtifactStore(new FilesystemBackend(config.rootDir));
    this.agentState = buildAgentState();
    this.streamState = idleStreamState();
  }

  /** Initialize: load schema, derive tools, create session. */
  async boot(): Promise<void> {
    await this.fs.ensureStructure();

    // Load schema
    try {
      const raw = await this.fs.readSchema();
      this.schema = parseSchema(raw);
    } catch {
      // No schema file — use a minimal default
      this.schema = null;
    }

    // Derive tools from schema capabilities
    const contracts = this.schema ? deriveToolContracts(this.schema) : [];

    // Build tool executor
    const executor: ToolExecutor = this.config.toolExecutor ?? this.defaultToolExecutor.bind(this);
    const policyGate = createPolicyGate(this.config.policyProfile);

    this.tools = bridgeTools(contracts, { executor, policyGate });

    // Create session
    this.session = buildSessionState({
      agentId: this.config.agentId,
      interfaceType: "cli",
    });

    // Load agent state if it exists
    try {
      const rawState = await this.fs.readState("agent") as AgentState;
      this.agentState = rawState;
    } catch {
      this.agentState = buildAgentState();
    }

    this.bootedAt = Date.now();
    await this.fs.writeState("agent", this.agentState);
  }

  /**
   * Process a user message through the OODA cycle.
   * Returns an AsyncGenerator yielding StreamState updates.
   */
  async *tick(
    userMessage: string,
    interfaceType?: "cli" | "chat" | "web" | "api",
  ): AsyncGenerator<StreamState> {
    const maxSteps = this.config.maxStepsPerTick ?? 10;

    // Update interface if provided
    if (interfaceType && this.session) {
      this.session.interface = interfaceType;
    }

    // ── OBSERVE: update agent state ─────────────────────────────────
    this.agentState = {
      ...this.agentState,
      mode: "executing",
      current_objective: userMessage,
    };
    await this.fs.writeState("agent", this.agentState);

    // Create a run for this tick
    const envelope = createRunEnvelope({
      agent_id: this.config.agentId,
      objective: userMessage,
      policy_profile: this.config.policyProfile.name,
      budgets: this.config.policyProfile.budgets,
    });
    const runState = this.runManager.create(envelope);
    this.runManager.start(envelope.run_id);
    this.activeRunId = envelope.run_id;

    // Add user message to history
    this.history.push({ role: "user", content: userMessage });

    // Update stream state
    this.streamState = {
      ...idleStreamState(),
      phase: "connecting",
    };
    yield this.streamState;

    try {
      // ── ORIENT: build system prompt ─────────────────────────────────
      const systemPrompt = this.schema
        ? buildSystemPrompt({
            schema: this.schema,
            agentState: this.agentState,
            policyProfile: this.config.policyProfile,
            customInstructions: this.config.customInstructions,
          })
        : `You are an autonomous agent (${this.config.agentId}). ${this.config.customInstructions ?? ""}`;

      // ── DECIDE + ACT: generateText with tools ──────────────────────
      this.streamState = { ...this.streamState, phase: "streaming" };
      yield this.streamState;

      const result = await generateText({
        model: this.config.model,
        system: systemPrompt,
        messages: toAiSdkMessages(this.history),
        tools: this.tools,
        stopWhen: stepCountIs(maxSteps),
        onStepFinish: (step: StepResult<ToolSet>) => {
          const usage = toUsageSnapshot(step.usage);
          const toolInvocations: ToolInvocation[] = step.toolResults.map((tr: any) => ({
            tool_call_id: tr.toolCallId ?? generateId(),
            tool_name: tr.toolName,
            args: tr.input ?? tr.args ?? {},
            result: tr.output ?? tr.result ?? null,
            is_error: false,
            duration_ms: 0,
            step_index: step.stepNumber,
          }));

          const stepRecord: StepRecord = {
            step_index: step.stepNumber,
            messages_in: [...this.history],
            message_out: {
              role: "assistant",
              content: step.text || "Tool calls executed.",
            },
            tool_invocations: toolInvocations,
            usage,
            finish_reason: step.finishReason as StepRecord["finish_reason"],
            duration_ms: 0,
          };

          this.stepRecords.push(stepRecord);

          // Update stream state
          this.streamState = {
            ...this.streamState,
            step_index: step.stepNumber,
            partial_text: this.streamState.partial_text + step.text,
            completed_invocations: [
              ...this.streamState.completed_invocations,
              ...toolInvocations,
            ],
            cumulative_usage: accumulateUsage([
              this.streamState.cumulative_usage,
              usage,
            ]),
            phase: step.finishReason === "tool-calls" ? "tool-calling" : "streaming",
          };

          // Emit events
          if (this.config.onStepComplete) {
            this.config.onStepComplete(stepRecord);
          }

          // Emit LLM step event
          this.emitEvent({
            ...createEvent(
              envelope.run_id,
              this.config.agentId,
              step.stepNumber,
              "llm.step_completed",
            ),
            step_index: step.stepNumber,
            finish_reason: step.finishReason,
            tool_calls: toolInvocations.length,
            usage,
            duration_ms: 0,
          } as AgentEvent);
        },
      });

      // ── RECORD: finalize ────────────────────────────────────────────
      const finalText = result.text;
      const totalUsage = toUsageSnapshot(result.usage);

      // Add assistant response to history
      if (finalText) {
        this.history.push({ role: "assistant", content: finalText });
      }

      // Complete stream state
      this.streamState = {
        ...this.streamState,
        phase: "complete",
        partial_text: finalText,
        cumulative_usage: totalUsage,
      };
      yield this.streamState;

      // Complete the run
      this.runManager.complete(envelope.run_id);

      // Emit usage event
      this.emitEvent({
        ...createEvent(
          envelope.run_id,
          this.config.agentId,
          this.stepRecords.length,
          "llm.usage",
        ),
        cumulative: totalUsage,
        step_count: result.steps.length,
      } as AgentEvent);

      // Update agent state
      const elapsed = this.bootedAt ? Date.now() - this.bootedAt : 0;
      this.agentState = {
        ...this.agentState,
        mode: "idle",
        cumulative_budget: {
          elapsed_ms: elapsed,
          tokens_used: this.agentState.cumulative_budget.tokens_used + totalUsage.total_tokens,
          tool_calls:
            this.agentState.cumulative_budget.tool_calls +
            this.streamState.completed_invocations.length,
          artifacts_mb: this.agentState.cumulative_budget.artifacts_mb,
        },
      };
      await this.fs.writeState("agent", this.agentState);

      this.activeRunId = null;
    } catch (error) {
      // Error handling
      const errMsg = error instanceof Error ? error.message : String(error);
      this.streamState = {
        ...this.streamState,
        phase: "error",
        error: errMsg,
      };
      yield this.streamState;

      // Fail the run
      this.runManager.fail(envelope.run_id, {
        code: "AGENT_LOOP_ERROR",
        message: errMsg,
        recoverable: true,
      });

      this.agentState = { ...this.agentState, mode: "error" };
      await this.fs.writeState("agent", this.agentState);
      this.activeRunId = null;
    }
  }

  /** Shut down the agent, finalize any active runs. */
  async shutdown(): Promise<void> {
    if (this.activeRunId) {
      try {
        this.runManager.complete(this.activeRunId);
      } catch {
        // Already completed or failed
      }
    }
    this.agentState = { ...this.agentState, mode: "idle" };
    await this.fs.writeState("agent", this.agentState);
  }

  /** Get the full conversation history. */
  getHistory(): ChatMessage[] {
    return [...this.history];
  }

  /** Get the current stream state. */
  getStreamState(): StreamState {
    return { ...this.streamState };
  }

  /** Get completed step records. */
  getStepRecords(): StepRecord[] {
    return [...this.stepRecords];
  }

  /** Get the loaded schema (null if no schema file). */
  getSchema(): AppSchema | null {
    return this.schema;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /** Default tool executor routes to built-in capabilities. */
  private async defaultToolExecutor(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case "query_state": {
        const key = args.key as string;
        try {
          return await this.fs.readState(key);
        } catch {
          return { error: `State key "${key}" not found` };
        }
      }
      case "store_artifact": {
        const content = args.content as string;
        const mime = (args.mime as string) ?? "text/plain";
        const handle = await this.artifactStore.storeString(
          content,
          mime,
          this.activeRunId ?? "unknown",
        );
        return { handle, stored: true };
      }
      case "evaluate_policy": {
        const action = args.action as string;
        const scope = args.scope as string;
        return evaluate(this.config.policyProfile, action, scope);
      }
      case "update_memory": {
        const key = args.key as string;
        const data = args.data;
        await this.fs.writeMemory(key, data);
        return { updated: true };
      }
      case "search_memory": {
        const keys = await this.fs.listMemoryKeys();
        return { keys };
      }
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  private emitEvent(event: AgentEvent): void {
    if (this.config.onEvent) {
      this.config.onEvent(event);
    }
  }
}
