"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronRight, House, UploadCloud, MessageSquare } from "lucide-react";
import { useQueryParams } from "../hooks/use-query-params";
import {
  AGENT_INBOX_PARAM,
  IMPROPER_SCHEMA,
  INBOX_PARAM,
  VIEW_STATE_THREAD_QUERY_PARAM,
  STUDIO_NOT_WORKING_TROUBLESHOOTING_URL,
} from "../constants";
import { HumanInterrupt, ThreadStatusWithAll } from "../types";
import { prettifyText, isDeployedUrl, constructOpenInStudioURL } from "../utils";
import { useThreadsContext } from "../contexts/ThreadContext";
import React from "react";
import { logger } from "../utils/logger";
import { useToast } from "@/hooks/use-toast";
import { Thread } from "@langchain/langgraph-sdk";

// Get thread title from thread data (same logic as sidebar/chat-header)
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

// Get message count from thread data
function getMessageCount(thread: Thread): number {
  const values = thread.values as Record<string, unknown> | undefined;
  if (values?.messages && Array.isArray(values.messages)) {
    return values.messages.filter(
      (m: { type?: string }) => m.type === "human" || m.type === "ai"
    ).length;
  }
  return 0;
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

// Chat header component for the breadcrumb area on /chat page
function ChatBreadcrumbHeader({ className }: { className?: string }) {
  const { agentInboxes, chatThreads, currentChatThreadId } = useThreadsContext();
  const { toast } = useToast();

  const selectedInbox = agentInboxes.find((i) => i.selected);
  const agentName = selectedInbox?.name || (selectedInbox?.graphId ? prettifyText(selectedInbox.graphId) : "Agent");
  const isDeployed = selectedInbox?.deploymentUrl ? isDeployedUrl(selectedInbox.deploymentUrl) : false;

  const currentThread = chatThreads.find((t) => t.thread_id === currentChatThreadId);
  const threadTitle = currentThread ? getThreadTitle(currentThread) : null;
  const messageCount = currentThread ? getMessageCount(currentThread) : 0;
  const threadCreatedAt = currentThread?.created_at;

  const handleOpenInStudio = () => {
    if (!selectedInbox) {
      toast({
        title: "Error",
        description: "No agent inbox selected.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    const studioUrl = constructOpenInStudioURL(
      selectedInbox,
      currentChatThreadId || undefined
    );

    if (studioUrl === "#") {
      toast({
        title: "Error",
        description: (
          <>
            <p>
              Could not construct Studio URL. Check if inbox has necessary
              details (Project ID, Tenant ID).
            </p>
            <p>
              If the issue persists, see the{" "}
              <a
                href={STUDIO_NOT_WORKING_TROUBLESHOOTING_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                troubleshooting section
              </a>
            </p>
          </>
        ),
        variant: "destructive",
        duration: 10000,
      });
    } else {
      window.open(studioUrl, "_blank");
    }
  };

  return (
    <div className={cn("flex items-center justify-between w-full pr-4", className)}>
      {/* Left: Agent info and thread title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {/* Agent badge */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isDeployed ? (
            <UploadCloud className="w-4 h-4 text-blue-500" />
          ) : (
            <House className="w-4 h-4 text-green-500" />
          )}
          <span className="text-xs sm:text-sm font-medium text-gray-700 hidden sm:inline">{agentName}</span>
        </div>

        {/* Separator - hidden on mobile */}
        <span className="text-gray-300 hidden sm:inline">/</span>

        {/* Thread title or "New Chat" */}
        <div className="flex items-center gap-2 min-w-0">
          {threadTitle ? (
            <span className="text-xs sm:text-sm text-gray-900 truncate max-w-[150px] sm:max-w-[300px]">
              {threadTitle}
            </span>
          ) : (
            <span className="text-xs sm:text-sm text-gray-500 italic">New Chat</span>
          )}
        </div>
      </div>

      {/* Right: Metrics, Studio button, and deployment badge */}
      <div className="flex items-center gap-2 sm:gap-4 text-sm text-gray-500 flex-shrink-0">
        {/* Message count - hidden on small screens */}
        {messageCount > 0 && (
          <div className="hidden sm:flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4" />
            <span>{messageCount}</span>
          </div>
        )}

        {/* Thread date - hidden on small screens */}
        {threadCreatedAt && (
          <span className="text-xs hidden sm:inline">
            {formatRelativeDate(threadCreatedAt)}
          </span>
        )}

        {/* Studio button - only show when there's a thread */}
        {currentChatThreadId && selectedInbox?.deploymentUrl && (
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-1 bg-white h-7 text-xs"
            onClick={handleOpenInStudio}
          >
            Studio
          </Button>
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

export function BreadCrumb({ className }: { className?: string }) {
  const pathname = usePathname();
  const { searchParams } = useQueryParams();
  const { threadData, agentInboxes } = useThreadsContext();
  const [agentInboxLabel, setAgentInboxLabel] = React.useState<string>();
  const [selectedInboxLabel, setSelectedInboxLabel] = React.useState<string>();
  const [selectedThreadActionLabel, setSelectedThreadActionLabel] =
    React.useState<string>();

  const isChatPage = pathname === "/chat";

  React.useEffect(() => {
    // Skip effect on chat page since breadcrumb is hidden
    if (isChatPage) return;

    try {
      const selectedAgentInbox = agentInboxes.find((a) => a.selected);
      if (selectedAgentInbox) {
        const selectedAgentInboxLabel =
          selectedAgentInbox.name || prettifyText(selectedAgentInbox.graphId);
        setAgentInboxLabel(selectedAgentInboxLabel);
      } else {
        setAgentInboxLabel(undefined);
      }

      const selectedInboxParam = searchParams.get(INBOX_PARAM) as
        | ThreadStatusWithAll
        | undefined;
      if (selectedInboxParam) {
        setSelectedInboxLabel(prettifyText(selectedInboxParam));
      } else {
        setSelectedInboxLabel(undefined);
      }

      const selectedThreadIdParam = searchParams.get(
        VIEW_STATE_THREAD_QUERY_PARAM
      );
      const selectedThread = threadData.find(
        (t) => t.thread.thread_id === selectedThreadIdParam
      );
      const selectedThreadAction = (
        selectedThread?.interrupts as HumanInterrupt[] | undefined
      )?.[0]?.action_request?.action;
      if (selectedThreadAction) {
        if (selectedThreadAction === IMPROPER_SCHEMA) {
          setSelectedThreadActionLabel("Interrupt");
        } else {
          setSelectedThreadActionLabel(prettifyText(selectedThreadAction));
        }
      } else {
        setSelectedThreadActionLabel(undefined);
      }
    } catch (e) {
      logger.error("Error while updating breadcrumb", e);
    }
  }, [searchParams, agentInboxes, threadData, isChatPage]);

  // Show chat header on /chat page instead of breadcrumb
  if (isChatPage) {
    return <ChatBreadcrumbHeader className={className} />;
  }

  const constructBaseUrl = () => {
    const selectedAgentInbox = agentInboxes.find((a) => a.selected);
    if (!selectedAgentInbox) {
      return "/";
    }
    return `/?${AGENT_INBOX_PARAM}=${selectedAgentInbox.id}`;
  };

  const constructInboxLink = () => {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete(VIEW_STATE_THREAD_QUERY_PARAM);
    return `${currentUrl.pathname}${currentUrl.search}`;
  };

  if (!agentInboxLabel) {
    return (
      <div
        className={cn(
          "flex items-center justify-start gap-2 text-gray-500 text-sm h-[34px]",
          className
        )}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-start gap-1 sm:gap-2 text-gray-500 text-xs sm:text-sm overflow-x-auto scrollbar-none whitespace-nowrap",
        className
      )}
    >
      <NextLink href={constructBaseUrl()}>
        <Button size="sm" className="text-gray-500" variant="link">
          {agentInboxLabel}
        </Button>
      </NextLink>

      {selectedInboxLabel && (
        <>
          <ChevronRight className="h-[14px] w-[14px]" />
          <NextLink href={constructInboxLink()}>
            <Button size="sm" className="text-gray-500" variant="link">
              {selectedInboxLabel}
            </Button>
          </NextLink>
        </>
      )}
      {selectedThreadActionLabel && (
        <>
          <ChevronRight className="h-[14px] w-[14px]" />
          <NextLink href={window.location.pathname + window.location.search}>
            <Button size="sm" className="text-gray-500" variant="link">
              {selectedThreadActionLabel}
            </Button>
          </NextLink>
        </>
      )}
    </div>
  );
}
