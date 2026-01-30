"use client";

import { Thread } from "@langchain/langgraph-sdk";
import { cn } from "@/lib/utils";
import { formatDate } from "./utils";
import { MessageSquare, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatHistoryProps {
  threads: Thread[];
  currentThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNewChat: () => void;
  isLoading?: boolean;
}

export function ChatHistory({
  threads,
  currentThreadId,
  onSelectThread,
  onNewChat,
  isLoading,
}: ChatHistoryProps) {
  // Group threads by date
  const groupedThreads = threads.reduce(
    (acc, thread) => {
      const dateKey = formatDate(thread.created_at);
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(thread);
      return acc;
    },
    {} as Record<string, Thread[]>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : threads.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No conversations yet
          </div>
        ) : (
          <div className="p-2 space-y-4">
            {Object.entries(groupedThreads).map(([date, dateThreads]) => (
              <div key={date}>
                <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase">
                  {date}
                </div>
                <div className="space-y-1">
                  {dateThreads.map((thread) => (
                    <button
                      key={thread.thread_id}
                      onClick={() => onSelectThread(thread.thread_id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                        "hover:bg-gray-100 flex items-center gap-2",
                        currentThreadId === thread.thread_id &&
                          "bg-gray-100 font-medium"
                      )}
                    >
                      <MessageSquare className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      <span className="truncate">
                        {getThreadTitle(thread)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getThreadTitle(thread: Thread): string {
  // Try to get a title from metadata
  if (thread.metadata?.title) {
    return thread.metadata.title as string;
  }

  // Try to get from values if available
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

  // Fallback to thread ID
  return `Chat ${thread.thread_id.slice(0, 8)}...`;
}
