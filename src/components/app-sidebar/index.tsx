"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  UploadCloud,
  House,
  LoaderCircle,
  Plus,
  MessageSquare,
} from "lucide-react";
import { agentInboxSvg } from "../agent-inbox/components/agent-inbox-logo";
import { SettingsPopover } from "../agent-inbox/components/settings-popover";
import React from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "../ui/button";
import { useThreadsContext } from "../agent-inbox/contexts/ThreadContext";
import { prettifyText, isDeployedUrl } from "../agent-inbox/utils";
import { cn } from "@/lib/utils";
import { LANGCHAIN_API_KEY_LOCAL_STORAGE_KEY } from "../agent-inbox/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { AddAgentInboxDialog } from "../agent-inbox/components/add-agent-inbox-dialog";
import { useLocalStorage } from "../agent-inbox/hooks/use-local-storage";
import { ENV_INBOXES_CONFIGURED } from "../agent-inbox/hooks/use-inboxes";
import { DropdownDialogMenu } from "../agent-inbox/components/dropdown-and-dialog";
import { Thread } from "@langchain/langgraph-sdk";
import { ThreadActionsMenu } from "./thread-actions-menu";

// Date formatting for thread grouping
function formatDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" }).toUpperCase();
}

// Get thread title from thread data
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
        return content.slice(0, 40) + (content.length > 40 ? "..." : "");
      }
    }
  }

  return `Chat ${thread.thread_id.slice(0, 8)}...`;
}

export function AppSidebar() {
  const router = useRouter();
  const {
    agentInboxes,
    changeAgentInbox,
    deleteAgentInbox,
    chatThreads,
    chatThreadsLoading,
    currentChatThreadId,
    setCurrentChatThreadId,
    renameThread,
    deleteChatThread,
  } = useThreadsContext();
  const [langchainApiKey, setLangchainApiKey] = React.useState("");
  const { getItem, setItem } = useLocalStorage();
  const { open, isMobile, setOpenMobile } = useSidebar();

  React.useEffect(() => {
    try {
      if (typeof window === "undefined" || langchainApiKey) {
        return;
      }

      const langchainApiKeyLS = getItem(LANGCHAIN_API_KEY_LOCAL_STORAGE_KEY);
      if (langchainApiKeyLS) {
        setLangchainApiKey(langchainApiKeyLS);
      }
    } catch (e) {
      console.error("Error getting/setting LangSmith API key", e);
    }
  }, [langchainApiKey]);

  const handleChangeLangChainApiKey = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setLangchainApiKey(e.target.value);
    setItem(LANGCHAIN_API_KEY_LOCAL_STORAGE_KEY, e.target.value);
  };

  const handleNewChat = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
    setCurrentChatThreadId(null);
    router.push("/chat");  // No thread param = new chat
  };

  const handleSelectThread = (threadId: string) => {
    if (isMobile) {
      setOpenMobile(false);
    }
    setCurrentChatThreadId(threadId);
    router.push(`/chat?thread=${threadId}`);
  };

  // Group threads by date
  const groupedThreads = React.useMemo(() => {
    return chatThreads.reduce(
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
  }, [chatThreads]);

  return (
    <Sidebar collapsible="icon" className="border-r-[0px] bg-[#F9FAFB]">
      <SidebarContent className="flex flex-col h-screen pb-4 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between px-4">
          <NextLink href="/" className="flex-shrink-0">
            {agentInboxSvg}
          </NextLink>
          <AppSidebarTrigger isOutside={false} className="mt-1" />
        </div>

        {/* Agent Inboxes Section */}
        <SidebarGroup className="pt-4 px-2">
          <div className="flex items-center justify-between px-2 mb-2">
            <p
              className={cn(
                "text-xs font-semibold text-gray-500 uppercase tracking-wide",
                !open && "sr-only"
              )}
            >
              Agent Inboxes
            </p>
            {!ENV_INBOXES_CONFIGURED && (
              <AddAgentInboxDialog
                hideTrigger={false}
                langchainApiKey={langchainApiKey}
                handleChangeLangChainApiKey={handleChangeLangChainApiKey}
                customTrigger={
                  <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                    <Plus className="h-4 w-4 text-gray-500" />
                  </button>
                }
              />
            )}
          </div>
          <SidebarGroupContent>
            <SidebarMenu className="flex flex-col gap-1">
              {agentInboxes.map((item, idx) => {
                const label = item.name || prettifyText(item.graphId);
                const isDeployed = isDeployedUrl(item.deploymentUrl);
                return (
                  <SidebarMenuItem
                    key={`graph-id-${item.graphId}-${idx}`}
                    className={cn(
                      "flex items-center w-full",
                      item.selected ? "bg-gray-100 rounded-md" : ""
                    )}
                  >
                    <TooltipProvider>
                      <Tooltip delayDuration={200}>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            onClick={() => changeAgentInbox(item.id, true)}
                          >
                            {isDeployed ? (
                              <UploadCloud className="w-4 h-4 text-blue-500" />
                            ) : (
                              <House className="w-4 h-4 text-green-500" />
                            )}
                            {open && (
                              <span
                                className={cn(
                                  "truncate min-w-0 text-sm",
                                  item.selected ? "text-black font-medium" : "text-gray-600"
                                )}
                              >
                                {label}
                              </span>
                            )}
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent>
                          {label} - {isDeployed ? "Deployed" : "Local"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {!ENV_INBOXES_CONFIGURED && (
                      <DropdownDialogMenu
                        item={item}
                        deleteAgentInbox={deleteAgentInbox}
                      />
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Threads Section */}
        <SidebarGroup className="flex-1 pt-4 px-2 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-2 mb-2">
            <p
              className={cn(
                "text-xs font-semibold text-gray-500 uppercase tracking-wide",
                !open && "sr-only"
              )}
            >
              Threads
            </p>
            <button
              onClick={handleNewChat}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              <Plus className="h-4 w-4 text-gray-500" />
            </button>
          </div>
          <SidebarGroupContent className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {chatThreadsLoading ? (
              <div className="flex items-center justify-center py-6 text-gray-400">
                <LoaderCircle className="w-4 h-4 animate-spin mr-2" />
                <p className="text-xs">Loading...</p>
              </div>
            ) : chatThreads.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-gray-500">
                No conversations yet
              </div>
            ) : open ? (
              <div className="space-y-3">
                {Object.entries(groupedThreads).map(([date, dateThreads]) => (
                  <div key={date}>
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                      {date}
                    </div>
                    <div className="space-y-1">
                      {dateThreads.map((thread) => {
                        const title = getThreadTitle(thread);
                        return (
                          <div
                            key={thread.thread_id}
                            className={cn(
                              "group flex items-center rounded-lg transition-colors",
                              "hover:bg-gray-100",
                              currentChatThreadId === thread.thread_id &&
                                "bg-gray-100"
                            )}
                          >
                              <button
                                onClick={() => handleSelectThread(thread.thread_id)}
                                className={cn(
                                "flex-1 text-left px-3 py-2 text-sm flex items-center gap-2 min-w-0",
                                currentChatThreadId === thread.thread_id &&
                                  "font-medium"
                              )}
                              >
                                <MessageSquare className="h-4 w-4 text-gray-500 shrink-0" />
                                <span className="truncate">{title}</span>
                              </button>
                            <div className="pr-2">
                              <ThreadActionsMenu
                                thread={thread}
                                currentTitle={title}
                                onRename={renameThread}
                                onDelete={deleteChatThread}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <SidebarMenu className="flex flex-col gap-1">
                {chatThreads.map((thread) => {
                  const title = getThreadTitle(thread);
                  const isSelected = currentChatThreadId === thread.thread_id;

                  return (
                    <SidebarMenuItem key={thread.thread_id}>
                      <SidebarMenuButton
                        tooltip={title}
                        onClick={() => handleSelectThread(thread.thread_id)}
                        className={cn(isSelected && "bg-gray-100")}
                      >
                        <MessageSquare className="h-4 w-4 text-gray-500" />
                        <span>{title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Bottom Actions */}
        <div className="flex gap-2 px-4 pt-2 border-t border-gray-200">
          <SettingsPopover />
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

const sidebarTriggerSVG = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6 2V14M5.2 2H10.8C11.9201 2 12.4802 2 12.908 2.21799C13.2843 2.40973 13.5903 2.71569 13.782 3.09202C14 3.51984 14 4.0799 14 5.2V10.8C14 11.9201 14 12.4802 13.782 12.908C13.5903 13.2843 13.2843 13.5903 12.908 13.782C12.4802 14 11.9201 14 10.8 14H5.2C4.07989 14 3.51984 14 3.09202 13.782C2.71569 13.5903 2.40973 13.2843 2.21799 12.908C2 12.4802 2 11.9201 2 10.8V5.2C2 4.07989 2 3.51984 2.21799 3.09202C2.40973 2.71569 2.71569 2.40973 3.09202 2.21799C3.51984 2 4.0799 2 5.2 2Z"
      stroke="#3F3F46"
      strokeWidth="1.66667"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function AppSidebarTrigger({
  isOutside,
  className,
}: {
  isOutside: boolean;
  className?: string;
}) {
  const { toggleSidebar, open, isMobile, openMobile } = useSidebar();

  // On mobile, always show the trigger when sidebar sheet is closed
  // On desktop, hide the outside trigger when sidebar is open
  if (isOutside) {
    if (isMobile) {
      // On mobile, hide trigger when sheet is open
      if (openMobile) {
        return null;
      }
    } else {
      // On desktop, hide trigger when sidebar is open
      if (open) {
        return null;
      }
    }
  }

  return (
    <Button
      onClick={toggleSidebar}
      className={cn("size-8 sm:size-6 p-1.5 sm:p-1", className)}
      variant="ghost"
      size="icon"
      aria-label="Toggle sidebar"
    >
      {sidebarTriggerSVG}
    </Button>
  );
}
