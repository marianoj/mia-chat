"use client";

import { ChatStreamProvider } from "@/providers/ChatStream";
import { ChatThread } from "./thread";
import { ChatSettingsProvider } from "./chat-settings-context";
import { ChatHeader } from "./chat-header";
import { StickToBottom } from "use-stick-to-bottom";

function ChatContent() {
  return (
    <div className="flex h-full flex-col">
      {/* Chat header */}
      <ChatHeader />
      {/* Chat thread */}
      <div className="flex-1 overflow-hidden">
        <StickToBottom className="h-full">
          <ChatThread />
        </StickToBottom>
      </div>
    </div>
  );
}

export function AgentChat() {
  return (
    <ChatSettingsProvider>
      <ChatStreamProvider>
        <ChatContent />
      </ChatStreamProvider>
    </ChatSettingsProvider>
  );
}

export default AgentChat;
