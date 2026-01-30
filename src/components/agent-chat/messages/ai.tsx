"use client";

import { Message, AIMessage as AIMessageType } from "@langchain/langgraph-sdk";
import { MarkdownText } from "../markdown-text";
import { getContentString } from "../utils";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { useState } from "react";

interface AIMessageProps {
  message: Message;
}

interface ToolCallDisplayProps {
  toolCalls: NonNullable<AIMessageType["tool_calls"]>;
}

function ToolCallDisplay({ toolCalls }: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  if (!toolCalls.length) return null;

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
        <span>
          {toolCalls.length} tool call{toolCalls.length > 1 ? "s" : ""}
        </span>
      </button>

      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          {toolCalls.map((tc, idx) => (
            <div key={tc.id || idx} className="text-sm">
              <div className="font-medium text-gray-700">{tc.name}</div>
              {tc.args && Object.keys(tc.args).length > 0 && (
                <pre className="mt-1 text-xs bg-gray-100 rounded p-2 overflow-x-auto">
                  {JSON.stringify(tc.args, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ToolResultProps {
  message: Message;
}

function ToolResult({ message }: ToolResultProps) {
  const [expanded, setExpanded] = useState(false);
  const content = getContentString(message.content);
  const toolName = (message as { name?: string }).name || "Tool";

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
        <span className="font-medium">{toolName}</span>
        <span className="text-green-600">completed</span>
      </button>

      {expanded && content && (
        <div className="border-t px-3 py-2">
          <pre className="text-xs bg-green-100 rounded p-2 overflow-x-auto whitespace-pre-wrap">
            {content.length > 500 ? content.slice(0, 500) + "..." : content}
          </pre>
        </div>
      )}
    </div>
  );
}

export function AIMessage({ message }: AIMessageProps) {
  const contentString = getContentString(message.content);
  const isToolResult = message.type === "tool";

  const hasToolCalls =
    message.type === "ai" &&
    "tool_calls" in message &&
    message.tool_calls &&
    message.tool_calls.length > 0;

  if (isToolResult) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%]">
          <ToolResult message={message} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className={cn("flex flex-col gap-2 max-w-[80%]")}>
        {contentString && (
          <div className="bg-gray-100 rounded-2xl px-4 py-2">
            <MarkdownText>{contentString}</MarkdownText>
          </div>
        )}

        {hasToolCalls && (
          <ToolCallDisplay
            toolCalls={(message as AIMessageType).tool_calls!}
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
