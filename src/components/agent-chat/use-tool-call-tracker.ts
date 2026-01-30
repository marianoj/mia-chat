"use client";

import { useMemo, useRef } from "react";
import { Message, AIMessage as AIMessageType } from "@langchain/langgraph-sdk";

export interface TrackedToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  aiMessageId: string;
}

export interface TrackedToolResult {
  toolCallId: string;
  name: string;
  content: string;
  messageId: string;
}

export interface ToolCallTracker {
  // Map of AI message ID to tool calls that were made
  toolCallsByMessage: Map<string, TrackedToolCall[]>;
  // Map of tool call ID to its result
  toolResults: Map<string, TrackedToolResult>;
  // Get tool calls for a specific AI message (includes cached ones)
  getToolCallsForMessage: (messageId: string) => TrackedToolCall[];
  // Get tool result for a specific tool call ID
  getToolResult: (toolCallId: string) => TrackedToolResult | undefined;
  // All tracked tool results as messages (for rendering)
  allToolResults: TrackedToolResult[];
}

/**
 * Processes a single message and updates the cache refs.
 * This is extracted to keep the main hook clean.
 */
function processMessage(
  message: Message,
  toolCallsCacheRef: React.MutableRefObject<Map<string, TrackedToolCall[]>>,
  toolResultsCacheRef: React.MutableRefObject<Map<string, TrackedToolResult>>
): void {
  // Track tool calls from AI messages
  if (
    message.type === "ai" &&
    "tool_calls" in message &&
    message.tool_calls &&
    message.tool_calls.length > 0
  ) {
    const aiMessage = message as AIMessageType;
    const messageId = message.id || "";

    if (messageId && aiMessage.tool_calls) {
      const trackedCalls: TrackedToolCall[] = aiMessage.tool_calls.map((tc) => ({
        id: tc.id || "",
        name: tc.name,
        args: tc.args || {},
        aiMessageId: messageId,
      }));

      // Only update if we have new tool calls or different ones
      const existing = toolCallsCacheRef.current.get(messageId);
      if (!existing || existing.length < trackedCalls.length) {
        toolCallsCacheRef.current.set(messageId, trackedCalls);
      }
    }
  }

  // Track tool results
  if (message.type === "tool") {
    const toolMessage = message as Message & {
      tool_call_id?: string;
      name?: string;
    };
    const toolCallId = toolMessage.tool_call_id || "";
    const messageId = message.id || "";

    if (toolCallId && messageId) {
      // Get content as string
      let content = "";
      if (typeof message.content === "string") {
        content = message.content;
      } else if (Array.isArray(message.content)) {
        content = message.content
          .map((c) => (typeof c === "string" ? c : JSON.stringify(c)))
          .join("\n");
      }

      toolResultsCacheRef.current.set(toolCallId, {
        toolCallId,
        name: toolMessage.name || "Tool",
        content,
        messageId,
      });
    }
  }
}

/**
 * Hook that tracks tool calls and their results throughout the conversation.
 * This ensures tool calls persist even when the streaming state updates.
 *
 * IMPORTANT: We process messages synchronously during render (not in useEffect)
 * because useEffect runs AFTER render, which would cause the memoized return
 * value to use stale cache data. This pattern is safe because ref mutations
 * don't cause side effects visible to React.
 */
export function useToolCallTracker(messages: Message[]): ToolCallTracker {
  // Use refs to persist tool calls across re-renders and state updates
  const toolCallsCacheRef = useRef<Map<string, TrackedToolCall[]>>(new Map());
  const toolResultsCacheRef = useRef<Map<string, TrackedToolResult>>(new Map());

  // Process messages synchronously during render to ensure cache is up-to-date
  // before we create the memoized return value. This is necessary because
  // useEffect runs AFTER render, which would cause a timing issue.
  // Ref mutations are side-effect free and safe to do during render.
  return useMemo(() => {
    // Update caches with any new messages
    messages.forEach((message) => {
      processMessage(message, toolCallsCacheRef, toolResultsCacheRef);
    });

    // Create snapshot of current cache state for stable references
    const toolCallsByMessage = new Map(toolCallsCacheRef.current);
    const toolResults = new Map(toolResultsCacheRef.current);

    return {
      toolCallsByMessage,
      toolResults,
      getToolCallsForMessage: (messageId: string) => {
        return toolCallsByMessage.get(messageId) || [];
      },
      getToolResult: (toolCallId: string) => {
        return toolResults.get(toolCallId);
      },
      allToolResults: Array.from(toolResults.values()),
    };
  }, [messages]);
}
