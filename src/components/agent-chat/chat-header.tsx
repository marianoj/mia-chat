"use client";

import React from "react";
import { useChatStreamContext } from "@/providers/ChatStream";
import { useThreadsContext } from "@/components/agent-inbox/contexts/ThreadContext";
import { prettifyText, isDeployedUrl } from "@/components/agent-inbox/utils";
import { Thread } from "@langchain/langgraph-sdk";
import { LoaderCircle, MessageSquare, House, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

// Get thread title from thread data (same logic as sidebar)
function getThreadTitle(thread: Thread): string {
  if (thread.metadata?.title) {
    return thread.metadata.title as string;
  }

  const values = thread.values as Record<string, unknown> | undefined;
  if (values?.messages && Array.isArray(values.messages)) {
    const firstHumanMessage = values.messages.find(
      (m: { type?: string }) => m.type === "human"
    );
    if (firstHumanMessage) {
      const content = firstHumanMessage.content;
      if (typeof content === "string") {
        return content.slice(0, 50) + (content.length > 50 ? "..." : "");
      }
    }
  }

  return `Chat ${thread.thread_id.slice(0, 8)}...`;
}

// Format relative date
function formatRelativeDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ChatHeader() {
  const { messages, isLoading, threadId } = useChatStreamContext();
  const { agentInboxes, chatThreads } = useThreadsContext();

  // Get selected agent inbox
  const selectedInbox = agentInboxes.find((i) => i.selected);
  const agentName = selectedInbox?.name || (selectedInbox?.graphId ? prettifyText(selectedInbox.graphId) : "Agent");
  const isDeployed = selectedInbox?.deploymentUrl ? isDeployedUrl(selectedInbox.deploymentUrl) : false;

  // Get current thread
  const currentThread = chatThreads.find((t) => t.thread_id === threadId);
  const threadTitle = currentThread ? getThreadTitle(currentThread) : null;
  const threadCreatedAt = currentThread?.created_at;

  // Count visible messages (filter out system/internal messages)
  const visibleMessageCount = messages.filter(
    (m) => m.type === "human" || m.type === "ai"
  ).length;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
      {/* Left: Agent info and thread title */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Agent badge */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isDeployed ? (
            <UploadCloud className="w-4 h-4 text-blue-500" />
          ) : (
            <House className="w-4 h-4 text-green-500" />
          )}
          <span className="text-sm font-medium text-gray-700">{agentName}</span>
        </div>

        {/* Separator */}
        <span className="text-gray-300">/</span>

        {/* Thread title or "New Chat" */}
        <div className="flex items-center gap-2 min-w-0">
          {threadTitle ? (
            <span className="text-sm text-gray-900 truncate max-w-[300px]">
              {threadTitle}
            </span>
          ) : (
            <span className="text-sm text-gray-500 italic">New Chat</span>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <LoaderCircle className="w-4 h-4 animate-spin text-blue-500 flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Right: Metrics */}
      <div className="flex items-center gap-4 text-sm text-gray-500 flex-shrink-0">
        {/* Message count */}
        {visibleMessageCount > 0 && (
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4" />
            <span>{visibleMessageCount}</span>
          </div>
        )}

        {/* Thread date */}
        {threadCreatedAt && (
          <span className={cn("text-xs", isLoading && "opacity-50")}>
            {formatRelativeDate(threadCreatedAt)}
          </span>
        )}

        {/* Deployment badge */}
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            isDeployed
              ? "bg-blue-100 text-blue-700"
              : "bg-green-100 text-green-700"
          )}
        >
          {isDeployed ? "Deployed" : "Local"}
        </span>
      </div>
    </div>
  );
}
