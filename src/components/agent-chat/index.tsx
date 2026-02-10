"use client";

import { ChatStreamProvider } from "@/providers/ChatStream";
import { ChatThread } from "./thread";
import { ChatSettingsProvider } from "./chat-settings-context";
import { StickToBottom } from "use-stick-to-bottom";
import { ChatHeader } from "./chat-header";

function ChatContent() {
  return (
    <div className="flex h-full flex-col">
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
