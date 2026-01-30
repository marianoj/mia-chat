"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { type Message, type Thread } from "@langchain/langgraph-sdk";
import { validate } from "uuid";
import { toast } from "@/hooks/use-toast";
import { createClient } from "@/lib/client";
import { useThreadsContext } from "@/components/agent-inbox/contexts/ThreadContext";
import { LANGCHAIN_API_KEY_LOCAL_STORAGE_KEY } from "@/components/agent-inbox/constants";
import { useLocalStorage } from "@/components/agent-inbox/hooks/use-local-storage";

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
  chatThreads: Thread[];
  chatThreadsLoading: boolean;
  refreshChatThreads: () => Promise<void>;
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

function getThreadSearchMetadata(
  assistantId: string
): { graph_id: string } | { assistant_id: string } {
  if (validate(assistantId)) {
    return { assistant_id: assistantId };
  } else {
    return { graph_id: assistantId };
  }
}

interface ChatStreamSessionProps {
  children: ReactNode;
  apiKey: string | null;
  apiUrl: string;
  assistantId: string;
}

const ChatStreamSession = ({
  children,
  apiKey,
  apiUrl,
  assistantId,
}: ChatStreamSessionProps) => {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [chatThreads, setChatThreads] = useState<Thread[]>([]);
  const [chatThreadsLoading, setChatThreadsLoading] = useState(false);

  const getChatThreads = useCallback(async (): Promise<Thread[]> => {
    if (!apiUrl || !assistantId) return [];
    const client = createClient({
      deploymentUrl: apiUrl,
      langchainApiKey: apiKey ?? undefined,
    });

    const threads = await client.threads.search({
      metadata: {
        ...getThreadSearchMetadata(assistantId),
      },
      limit: 100,
    });

    return threads;
  }, [apiUrl, assistantId, apiKey]);

  const refreshChatThreads = useCallback(async () => {
    setChatThreadsLoading(true);
    try {
      const threads = await getChatThreads();
      setChatThreads(threads);
    } catch (e) {
      console.error("Failed to fetch chat threads:", e);
    } finally {
      setChatThreadsLoading(false);
    }
  }, [getChatThreads]);

  // Initial load of threads
  useEffect(() => {
    refreshChatThreads();
  }, [refreshChatThreads]);

  const streamValue = useTypedStream({
    apiUrl,
    apiKey: apiKey ?? undefined,
    assistantId,
    threadId: threadId ?? null,
    onThreadId: (id) => {
      setThreadId(id);
      // Refetch threads list when thread ID changes.
      // Wait for some seconds before fetching so we're able to get the new thread that was created.
      sleep().then(() => refreshChatThreads().catch(console.error));
    },
  });

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

  const contextValue: ChatStreamContextType = {
    ...streamValue,
    threadId,
    setThreadId,
    chatThreads,
    chatThreadsLoading,
    refreshChatThreads,
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
  const { agentInboxes } = useThreadsContext();
  const { getItem } = useLocalStorage();

  // Get the selected inbox configuration
  const selectedInbox = agentInboxes.find((i) => i.selected);
  const apiUrl = selectedInbox?.deploymentUrl || "";
  const assistantId = selectedInbox?.graphId || "";
  const apiKey = getItem(LANGCHAIN_API_KEY_LOCAL_STORAGE_KEY) || null;

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
