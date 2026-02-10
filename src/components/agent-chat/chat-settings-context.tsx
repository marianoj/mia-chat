"use client";

import React, { createContext, useContext } from "react";

interface ChatSettingsContextValue {
  showToolCalls: boolean;
  setShowToolCalls: (value: boolean) => void;
}

const ChatSettingsContext = createContext<ChatSettingsContextValue | null>(null);

export function ChatSettingsProvider({ children }: { children: React.ReactNode }) {
  const setShowToolCalls = () => {};

  return (
    <ChatSettingsContext.Provider value={{ showToolCalls: true, setShowToolCalls }}>
      {children}
    </ChatSettingsContext.Provider>
  );
}

export function useChatSettings() {
  const context = useContext(ChatSettingsContext);
  if (!context) {
    // Return default values if not wrapped in provider
    return { showToolCalls: true, setShowToolCalls: () => {} };
  }
  return context;
}
