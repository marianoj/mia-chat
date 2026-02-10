"use client";

import { Message, AIMessage as AIMessageType } from "@langchain/langgraph-sdk";
import { MarkdownText } from "../markdown-text";
import { getContentString } from "../utils";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Wrench, CheckCircle2, Copy, Check, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { useChatSettings } from "../chat-settings-context";
import { TrackedToolCall, TrackedToolResult } from "../use-tool-call-tracker";

interface AIMessageProps {
  message: Message;
  cachedToolCalls?: TrackedToolCall[];
  getToolResult?: (toolCallId: string) => TrackedToolResult | undefined;
  isStreaming?: boolean;
}

interface ToolCallDisplayProps {
  toolCalls: TrackedToolCall[];
  getToolResult?: (toolCallId: string) => TrackedToolResult | undefined;
  isStreaming?: boolean;
}

export function ToolCallDisplay({ toolCalls, getToolResult, isStreaming = false }: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(true); // Default to expanded so they persist visually
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!toolCalls.length) return null;

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Format arguments for display - show key details inline
  const formatArgsPreview = (args: Record<string, unknown>): string => {
    const entries = Object.entries(args);
    if (entries.length === 0) return "";
    // Show first 2-3 key-value pairs as preview
    return entries
      .slice(0, 3)
      .map(([k, v]) => {
        const valueStr = typeof v === 'string' ? v : JSON.stringify(v);
        const truncated = valueStr.length > 30 ? valueStr.slice(0, 30) + '...' : valueStr;
        return `${k}: ${truncated}`;
      })
      .join(', ');
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-gray-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <Wrench className="h-4 w-4" />
        <span className="font-medium">
          {toolCalls.length} tool call{toolCalls.length > 1 ? "s" : ""}
        </span>
        {!expanded && (
          <span className="text-gray-400 truncate ml-1">
            {toolCalls.map(tc => tc.name).join(", ")}
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t divide-y">
          {toolCalls.map((tc, idx) => {
            const argsJson = tc.args && Object.keys(tc.args).length > 0
              ? JSON.stringify(tc.args, null, 2)
              : null;
            const argsPreview = tc.args ? formatArgsPreview(tc.args) : null;
            const copyId = tc.id || `tool-${idx}`;
            const result = getToolResult?.(tc.id);
            // Consider completed if we have a result OR if streaming has stopped
            const isCompleted = result || !isStreaming;

            return (
              <div key={tc.id || idx} className="px-3 py-3">
                {/* Tool Call Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-gray-800 bg-gray-200 px-2 py-0.5 rounded">
                      {tc.name}
                    </span>
                    {isCompleted ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        completed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        running
                      </span>
                    )}
                  </div>
                  {argsJson && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(argsJson, copyId);
                      }}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
                      title="Copy arguments"
                    >
                      {copiedId === copyId ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>

                {/* Arguments Preview (always shown if available) */}
                {argsPreview && (
                  <div className="text-xs text-gray-500 mb-2 font-mono bg-gray-100 px-2 py-1 rounded">
                    {argsPreview}
                  </div>
                )}

                {/* Full Arguments (collapsible) */}
                {argsJson && Object.keys(tc.args).length > 3 && (
                  <details className="mb-2">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      Show full arguments
                    </summary>
                    <pre className="text-xs bg-gray-100 rounded p-3 overflow-x-auto font-mono text-gray-700 max-h-48 overflow-y-auto mt-1">
                      {argsJson}
                    </pre>
                  </details>
                )}

                {/* Tool Result (inline) */}
                {result && (
                  <ToolResultInline result={result} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ToolResultInlineProps {
  result: TrackedToolResult;
}

function ToolResultInline({ result }: ToolResultInlineProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (result.content) {
      await navigator.clipboard.writeText(result.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isLongContent = result.content && result.content.length > 500;
  const displayContent = expanded || !isLongContent
    ? result.content
    : result.content?.slice(0, 500);

  return (
    <div className="mt-2 border-l-2 border-green-300 pl-3">
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-green-700 hover:text-green-800"
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <span className="font-medium">Result</span>
          <span className="text-green-600">({result.content.length} chars)</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          className="text-green-600 hover:text-green-700 p-1 rounded hover:bg-green-50 transition-colors flex items-center gap-1 text-xs"
          title="Copy result"
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
      {expanded && (
        <pre className="text-xs bg-green-50 rounded p-2 overflow-x-auto whitespace-pre-wrap font-mono text-green-800 max-h-64 overflow-y-auto">
          {displayContent}
          {!expanded && isLongContent && (
            <span className="text-green-500">...</span>
          )}
        </pre>
      )}
    </div>
  );
}

interface ToolResultProps {
  message: Message;
}

function ToolResult({ message }: ToolResultProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const content = getContentString(message.content);
  const toolName = (message as { name?: string }).name || "Tool";

  const handleCopy = async () => {
    if (content) {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isLongContent = content && content.length > 500;
  const displayContent = expanded || !isLongContent ? content : content?.slice(0, 500);

  return (
    <div className="border rounded-lg overflow-hidden bg-green-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-green-700 hover:bg-green-100 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <CheckCircle2 className="h-4 w-4" />
        <span className="font-medium font-mono">{toolName}</span>
        <span className="text-green-600 text-xs">completed</span>
        {content && (
          <span className="text-green-500 text-xs ml-auto">
            {content.length} chars
          </span>
        )}
      </button>

      {expanded && content && (
        <div className="border-t px-3 py-3">
          <div className="flex justify-end mb-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className="text-green-600 hover:text-green-700 p-1 rounded hover:bg-green-100 transition-colors flex items-center gap-1 text-xs"
              title="Copy result"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <pre className="text-xs bg-green-100 rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono text-green-800 max-h-96 overflow-y-auto">
            {displayContent}
            {!expanded && isLongContent && (
              <span className="text-green-500">...</span>
            )}
          </pre>
          {isLongContent && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-2 text-xs text-green-600 hover:text-green-700 hover:underline"
            >
              Show full content ({content.length} characters)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function AIMessage({ message, cachedToolCalls, getToolResult, isStreaming = false }: AIMessageProps) {
  const { showToolCalls } = useChatSettings();
  const contentString = getContentString(message.content);
  const isToolResult = message.type === "tool";

  // Use a ref to persist tool calls - prevents flickering during streaming updates
  const persistedToolCallsRef = useRef<TrackedToolCall[]>([]);

  // Get tool calls from either the message or the cache
  const messageToolCalls = message.type === "ai" &&
    "tool_calls" in message &&
    message.tool_calls &&
    message.tool_calls.length > 0
    ? (message as AIMessageType).tool_calls!.map((tc) => ({
        id: tc.id || "",
        name: tc.name,
        args: tc.args || {},
        aiMessageId: message.id || "",
      }))
    : [];

  // Determine current tool calls from cache or message
  const currentToolCalls = cachedToolCalls && cachedToolCalls.length > 0
    ? cachedToolCalls
    : messageToolCalls;

  // Update persisted tool calls if we have new/more tool calls
  // This ensures once we've seen tool calls, they persist even if temporarily missing
  if (currentToolCalls.length > persistedToolCallsRef.current.length) {
    persistedToolCallsRef.current = currentToolCalls;
  }

  // Use persisted tool calls if current is empty but we had some before
  const toolCalls = currentToolCalls.length > 0
    ? currentToolCalls
    : persistedToolCallsRef.current;

  const hasToolCalls = toolCalls.length > 0;

  // Don't render tool result messages separately - they're shown inline with tool calls
  if (isToolResult) {
    // Check if this tool result is already shown inline with a tool call
    const toolCallId = (message as { tool_call_id?: string }).tool_call_id;
    if (toolCallId && getToolResult?.(toolCallId)) {
      // Already shown inline, skip rendering separately
      return null;
    }

    if (!showToolCalls) return null;

    return (
      <div className="flex justify-start">
        <div className="w-full">
          <ToolResult message={message} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start w-full">
      <div className={cn("flex flex-col gap-2 w-full")}>
        {contentString && (
          <div className="w-full">
            <MarkdownText>{contentString}</MarkdownText>
          </div>
        )}

        {hasToolCalls && showToolCalls && (
          <ToolCallDisplay
            toolCalls={toolCalls}
            getToolResult={getToolResult}
            isStreaming={isStreaming}
          />
        )}
      </div>
    </div>
  );
}

export function AIMessageLoading() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
}
