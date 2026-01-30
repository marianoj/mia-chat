"use client";

import { useState } from "react";
import { ChatStreamProvider, useChatStreamContext } from "@/providers/ChatStream";
import { ChatThread } from "./thread";
import { ChatHistory } from "./history";
import { StickToBottom } from "use-stick-to-bottom";
import { cn } from "@/lib/utils";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";

function ChatContent() {
  const {
    threadId,
    setThreadId,
    chatThreads,
    chatThreadsLoading,
  } = useChatStreamContext();

  const [historyOpen, setHistoryOpen] = useState(true);
  const isMobile = useMediaQuery("(max-width: 768px)");

  // On mobile, close history by default
  const showHistory = isMobile ? historyOpen : historyOpen;

  const handleNewChat = () => {
    setThreadId(null);
    if (isMobile) {
      setHistoryOpen(false);
    }
  };

  const handleSelectThread = (id: string) => {
    setThreadId(id);
    if (isMobile) {
      setHistoryOpen(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* History sidebar */}
      <div
        className={cn(
          "border-r bg-gray-50 transition-all duration-200 flex-shrink-0",
          showHistory ? "w-64" : "w-0",
          isMobile && showHistory && "absolute inset-y-0 left-0 z-20 w-64"
        )}
      >
        {showHistory && (
          <ChatHistory
            threads={chatThreads}
            currentThreadId={threadId}
            onSelectThread={handleSelectThread}
            onNewChat={handleNewChat}
            isLoading={chatThreadsLoading}
          />
        )}
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with toggle */}
        <div className="border-b px-4 py-2 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHistoryOpen(!historyOpen)}
            className="flex-shrink-0"
          >
            {historyOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeft className="h-5 w-5" />
            )}
          </Button>
          <h1 className="font-semibold truncate">
            {threadId ? "Chat" : "New Chat"}
          </h1>
        </div>

        {/* Chat thread */}
        <div className="flex-1 overflow-hidden">
          <StickToBottom className="h-full">
            <ChatThread />
          </StickToBottom>
        </div>
      </div>

      {/* Mobile overlay */}
      {isMobile && showHistory && (
        <div
          className="fixed inset-0 bg-black/20 z-10"
          onClick={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}

export function AgentChat() {
  return (
    <ChatStreamProvider>
      <ChatContent />
    </ChatStreamProvider>
  );
}

export default AgentChat;
