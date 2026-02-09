"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { type Message } from "@langchain/langgraph-sdk";
import { toast } from "@/hooks/use-toast";
import { useThreadsContext } from "@/components/agent-inbox/contexts/ThreadContext";
import { LANGCHAIN_API_KEY_LOCAL_STORAGE_KEY } from "@/components/agent-inbox/constants";
import { useLocalStorage } from "@/components/agent-inbox/hooks/use-local-storage";
import { ENV_API_KEY_CONFIGURED, getEnvApiKey } from "@/components/agent-inbox/hooks/use-inboxes";

export type ChatStateType = { messages: Message[] };

const useTypedStream = useStream<
  ChatStateType,
  {
    UpdateType: {
      messages?: Message[] | Message | string;
    };
  }
>;

type ChatStreamContextType = ReturnType<typeof useTypedStream> & {
  threadId: string | null;
  setThreadId: (id: string | null) => void;
};

const ChatStreamContext = createContext<ChatStreamContextType | undefined>(
  undefined
);

async function sleep(ms = 4000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkGraphStatus(
  apiUrl: string,
  apiKey: string | null
): Promise<boolean> {
  try {
    const res = await fetch(`${apiUrl}/info`, {
      ...(apiKey && {
        headers: {
          "X-Api-Key": apiKey,
        },
      }),
    });
    return res.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

interface ChatStreamSessionProps {
  children: ReactNode;
  apiKey: string | null;
  apiUrl: string;
  assistantId: string;
  initialThreadId: string | null;
  onThreadIdChange: (id: string | null) => void;
}

// Helper to get content as string for comparison
function getMessageContentString(content: Message['content']): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(c => (typeof c === 'string' ? c : (c as any).text || JSON.stringify(c)))
      .join('');
  }
  return '';
}

/**
 * Merge incoming messages with existing messages, preserving tool calls.
 * This implements add_messages-style merging: update existing by ID, append new.
 * Also handles optimistic updates (temp-* IDs) being replaced by real messages.
 */
function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  // First, filter out temp messages that have been replaced by real ones
  const filtered = existing.filter(m => {
    // Keep non-temp messages
    if (!m.id?.startsWith('temp-')) return true;

    // For temp messages, check if there's a matching real message in incoming
    const hasRealReplacement = incoming.some(inc =>
      inc.type === m.type &&
      !inc.id?.startsWith('temp-') &&
      // Match by content for human messages
      (m.type === 'human' && getMessageContentString(m.content) === getMessageContentString(inc.content))
    );

    // Remove temp message if it has a real replacement
    return !hasRealReplacement;
  });

  // Now merge incoming messages
  const result: Message[] = [...filtered];

  for (const newMsg of incoming) {
    const existingIdx = result.findIndex(m => m.id === newMsg.id);
    if (existingIdx >= 0) {
      // Update existing message, but preserve tool_calls if the new message lost them
      const existingMsg = result[existingIdx];
      const existingToolCalls = existingMsg.type === 'ai' && 'tool_calls' in existingMsg
        ? (existingMsg as any).tool_calls
        : undefined;
      const newToolCalls = newMsg.type === 'ai' && 'tool_calls' in newMsg
        ? (newMsg as any).tool_calls
        : undefined;

      // If existing had tool_calls but new doesn't, preserve them
      if (existingToolCalls?.length > 0 && (!newToolCalls || newToolCalls.length === 0)) {
        result[existingIdx] = {
          ...newMsg,
          tool_calls: existingToolCalls,
        } as Message;
      } else {
        result[existingIdx] = newMsg;
      }
    } else {
      // Append new message
      result.push(newMsg);
    }
  }

  return result;
}

const ChatStreamSession = ({
  children,
  apiKey,
  apiUrl,
  assistantId,
  initialThreadId,
  onThreadIdChange,
}: ChatStreamSessionProps) => {
  const [threadId, setThreadIdInternal] = useState<string | null>(initialThreadId);
  const { refreshChatThreads } = useThreadsContext();

  // Track if the change came from external (sidebar) vs internal (stream)
  const lastExternalThreadId = useRef<string | null>(initialThreadId);

  // Merged messages state - preserves tool calls across stream updates
  const [mergedMessages, setMergedMessages] = useState<Message[]>([]);
  const lastThreadIdForMessages = useRef<string | null>(null);

  // Only sync when external threadId actually changes (from sidebar click)
  useEffect(() => {
    if (initialThreadId !== lastExternalThreadId.current) {
      lastExternalThreadId.current = initialThreadId;
      setThreadIdInternal(initialThreadId);
    }
  }, [initialThreadId]);

  const setThreadId = useCallback((id: string | null) => {
    setThreadIdInternal(id);
    // Update the context but track that this is an internal change
    lastExternalThreadId.current = id;
    onThreadIdChange(id);
  }, [onThreadIdChange]);

  const streamValue = useTypedStream({
    apiUrl,
    apiKey: apiKey ?? undefined,
    assistantId,
    threadId: threadId ?? null,
    onThreadId: (id) => {
      // Only update if it's a new thread created by the stream
      if (id !== threadId) {
        setThreadId(id);
        // Refetch threads list when a new thread is created
        sleep().then(() => refreshChatThreads().catch(console.error));
      }
    },
  });

  // Clear messages when thread changes
  useEffect(() => {
    if (threadId !== lastThreadIdForMessages.current) {
      lastThreadIdForMessages.current = threadId;
      setMergedMessages([]);
    }
  }, [threadId]);

  // Merge incoming messages from stream with our local state
  useEffect(() => {
    if (streamValue.messages.length > 0) {
      setMergedMessages(prev => {
        // If empty (just switched threads), use fresh messages
        if (prev.length === 0) {
          return streamValue.messages;
        }
        // Otherwise merge to preserve tool calls
        return mergeMessages(prev, streamValue.messages);
      });
    }
  }, [streamValue.messages]);

  useEffect(() => {
    checkGraphStatus(apiUrl, apiKey).then((ok) => {
      if (!ok) {
        toast({
          title: "Connection failed",
          description: `Failed to connect to LangGraph server at ${apiUrl}. Please check your configuration.`,
          variant: "destructive",
          duration: 10000,
        });
      }
    });
  }, [apiKey, apiUrl]);

  // Override the messages from stream with our merged messages
  const contextValue: ChatStreamContextType = {
    ...streamValue,
    messages: mergedMessages,
    threadId,
    setThreadId,
  };

  return (
    <ChatStreamContext.Provider value={contextValue}>
      {children}
    </ChatStreamContext.Provider>
  );
};

interface ChatStreamProviderProps {
  children: ReactNode;
}

export const ChatStreamProvider: React.FC<ChatStreamProviderProps> = ({
  children,
}) => {
  const { agentInboxes, currentChatThreadId, setCurrentChatThreadId } = useThreadsContext();
  const { getItem } = useLocalStorage();

  // Get the selected inbox configuration
  const selectedInbox = agentInboxes.find((i) => i.selected);
  const apiUrl = selectedInbox?.deploymentUrl || "";
  const assistantId = selectedInbox?.graphId || "";
  const apiKey = ENV_API_KEY_CONFIGURED
    ? getEnvApiKey()
    : getItem(LANGCHAIN_API_KEY_LOCAL_STORAGE_KEY) || null;

  // If no inbox is selected, show a message
  if (!selectedInbox || !apiUrl || !assistantId) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">No Agent Inbox Selected</h2>
          <p className="text-muted-foreground">
            Please select an agent inbox from the sidebar to start chatting.
            You can add a new inbox using the settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ChatStreamSession
      apiKey={apiKey}
      apiUrl={apiUrl}
      assistantId={assistantId}
      initialThreadId={currentChatThreadId}
      onThreadIdChange={setCurrentChatThreadId}
    >
      {children}
    </ChatStreamSession>
  );
};

export const useChatStreamContext = (): ChatStreamContextType => {
  const context = useContext(ChatStreamContext);
  if (context === undefined) {
    throw new Error(
      "useChatStreamContext must be used within a ChatStreamProvider"
    );
  }
  return context;
};

export default ChatStreamContext;
