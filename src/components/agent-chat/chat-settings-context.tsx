"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const SHOW_TOOL_CALLS_KEY = "chat-show-tool-calls";

interface ChatSettingsContextValue {
  showToolCalls: boolean;
  setShowToolCalls: (value: boolean) => void;
}

const ChatSettingsContext = createContext<ChatSettingsContextValue | null>(null);

export function ChatSettingsProvider({ children }: { children: React.ReactNode }) {
  const [showToolCalls, setShowToolCallsState] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load setting from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(SHOW_TOOL_CALLS_KEY);
      if (stored !== null) {
        setShowToolCallsState(stored === "true");
      }
      setIsHydrated(true);
    }
  }, []);

  const setShowToolCalls = (value: boolean) => {
    setShowToolCallsState(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(SHOW_TOOL_CALLS_KEY, String(value));
    }
  };

  // Prevent hydration mismatch by not rendering until hydrated
  if (!isHydrated) {
    return <>{children}</>;
  }

  return (
    <ChatSettingsContext.Provider value={{ showToolCalls, setShowToolCalls }}>
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
