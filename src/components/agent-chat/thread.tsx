"use client";

import React, { FormEvent, useState } from "react";
import { useChatStreamContext } from "@/providers/ChatStream";
import { HumanMessage, AIMessage, AIMessageLoading, ToolCallDisplay } from "./messages";
import { DO_NOT_RENDER_ID_PREFIX } from "@/lib/ensure-tool-responses";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { cn } from "@/lib/utils";
import { X, FileIcon, ImageIcon, Plus, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useFileUpload, SUPPORTED_FILE_TYPES } from "@/hooks/use-file-upload";
import { MultimodalBlock } from "@/lib/multimodal-utils";
import { useChatSettings } from "./chat-settings-context";
import { useToolCallTracker } from "./use-tool-call-tracker";

function ContentBlockPreview({
  block,
  onRemove,
}: {
  block: MultimodalBlock;
  onRemove: () => void;
}) {
  const isImage = block.type === "image";
  const isPdf = block.mimeType === "application/pdf";

  return (
    <div className="relative group">
      {isImage ? (
        <img
          src={`data:${block.mimeType};base64,${block.data}`}
          alt={(block.metadata?.name as string) || "Preview"}
          className="h-16 w-16 object-cover rounded-lg border"
        />
      ) : isPdf ? (
        <div className="h-16 w-16 flex items-center justify-center bg-gray-100 rounded-lg border">
          <FileIcon className="h-6 w-6 text-gray-500" />
        </div>
      ) : (
        <div className="h-16 w-16 flex items-center justify-center bg-gray-100 rounded-lg border">
          <ImageIcon className="h-6 w-6 text-gray-500" />
        </div>
      )}
      <button
        onClick={onRemove}
        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function ChatThread() {
  const stream = useChatStreamContext();
  const {
    messages,
    isLoading,
    submit,
    stop,
    error,
  } = stream;

  const { showToolCalls, setShowToolCalls } = useChatSettings();
  const toolCallTracker = useToolCallTracker(messages);
  const [inputValue, setInputValue] = useState("");

  const {
    contentBlocks,
    handleFileUpload,
    dropRef,
    removeBlock,
    resetBlocks,
    dragOver,
    handlePaste,
  } = useFileUpload();

  const { scrollRef, contentRef } = useStickToBottomContext();

  // Filter out "do not render" messages
  const filteredMessages = messages.filter(
    (msg) => !msg.id?.startsWith(DO_NOT_RENDER_ID_PREFIX)
  );

  // Find orphaned tool calls - cached tool calls whose parent message is no longer in the array
  const messageIdsInArray = new Set(filteredMessages.map(m => m.id));
  const orphanedToolCalls = Array.from(toolCallTracker.toolCallsByMessage.entries())
    .filter(([msgId]) => !messageIdsInArray.has(msgId))
    .flatMap(([, calls]) => calls);


  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() && contentBlocks.length === 0) return;

    // Build message content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let content: any = inputValue.trim();

    if (contentBlocks.length > 0) {
      content = [
        ...contentBlocks,
        ...(inputValue.trim()
          ? [{ type: "text", text: inputValue.trim() }]
          : []),
      ];
    }

    submit(
      { messages: [{ type: "human", content }] },
      {
        // Let the SDK use its default streaming behavior
        // The useStream hook's `messages` property handles message updates automatically
        optimisticValues: (prev) => ({
          ...prev,
          messages: [
            ...(prev?.messages ?? []),
            { type: "human", content, id: `temp-${Date.now()}` },
          ],
        }),
      }
    );

    setInputValue("");
    resetBlocks();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.metaKey &&
      !e.nativeEvent.isComposing
    ) {
      e.preventDefault();
      const form = e.currentTarget.closest("form");
      form?.requestSubmit();
    }
  };

  return (
    <div
      ref={dropRef}
      className={cn(
        "flex flex-col h-full relative",
        dragOver && "ring-2 ring-blue-500 ring-inset"
      )}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-blue-50/80 z-10 flex items-center justify-center pointer-events-none">
          <div className="text-blue-600 font-medium">Drop files here</div>
        </div>
      )}


      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
      >
        <div ref={contentRef} className="p-4 space-y-4 max-w-3xl mx-auto">
          {filteredMessages.length === 0 && !isLoading ? (
            <div className="text-center text-gray-500 py-12">
              <p className="text-lg font-medium mb-2">Start a conversation</p>
              <p className="text-sm">
                Send a message to begin chatting with your agent.
              </p>
            </div>
          ) : (
            <>
              {filteredMessages.map((message) => {
                if (message.type === "human") {
                  return <HumanMessage key={message.id} message={message} />;
                }
                return (
                  <AIMessage
                    key={message.id}
                    message={message}
                    cachedToolCalls={toolCallTracker.getToolCallsForMessage(message.id || "")}
                    getToolResult={toolCallTracker.getToolResult}
                    isStreaming={isLoading}
                  />
                );
              })}

              {/* Show orphaned tool calls - cached tool calls whose parent message was removed */}
              {showToolCalls && orphanedToolCalls.length > 0 && (
                <div className="flex justify-start">
                  <div className="max-w-[80%]">
                    <ToolCallDisplay
                      toolCalls={orphanedToolCalls}
                      getToolResult={toolCallTracker.getToolResult}
                      isStreaming={isLoading}
                    />
                  </div>
                </div>
              )}

              {/* Show loading indicator */}
              {isLoading && <AIMessageLoading />}

              {/* Show error if any */}
              {error && (
                <div className="bg-red-50 text-red-600 rounded-lg p-3 text-sm">
                  Error: {(error as Error)?.message || "Something went wrong"}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="bg-white p-4">
        <div
          className={cn(
            "bg-muted relative z-10 mx-auto w-full max-w-3xl rounded-2xl shadow-xs transition-all",
            dragOver
              ? "border-primary border-2 border-dotted"
              : "border border-solid"
          )}
        >
          <form
            onSubmit={handleSubmit}
            className="mx-auto grid max-w-3xl grid-rows-[1fr_auto] gap-2"
          >
            {/* Content blocks preview */}
            {contentBlocks.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 pb-0">
                {contentBlocks.map((block, idx) => (
                  <ContentBlockPreview
                    key={idx}
                    block={block}
                    onRemove={() => removeBlock(idx)}
                  />
                ))}
              </div>
            )}

            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Type your message..."
              className="field-sizing-content resize-none border-none bg-transparent p-3.5 pb-0 shadow-none ring-0 outline-none focus:ring-0 focus:outline-none"
            />

            <div className="flex flex-col gap-3 p-2 pt-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex items-center justify-between gap-4 sm:gap-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="hide-tool-calls"
                    checked={!showToolCalls}
                    onCheckedChange={(checked) => setShowToolCalls(!checked)}
                  />
                  <Label
                    htmlFor="hide-tool-calls"
                    className="text-sm text-gray-600 whitespace-nowrap"
                  >
                    Hide Tool Calls
                  </Label>
                </div>

                <Label
                  htmlFor="file-input"
                  className="flex cursor-pointer items-center gap-2"
                >
                  <Plus className="size-5 text-gray-600" />
                  <span className="text-sm text-gray-600 hidden sm:inline">
                    Upload PDF or Image
                  </span>
                  <span className="text-sm text-gray-600 sm:hidden">
                    Upload
                  </span>
                </Label>
                <input
                  id="file-input"
                  type="file"
                  onChange={handleFileUpload}
                  multiple
                  accept={SUPPORTED_FILE_TYPES.join(",")}
                  className="hidden"
                />
              </div>

              {isLoading ? (
                <Button
                  key="stop"
                  onClick={() => stop()}
                  className="w-full sm:w-auto sm:ml-auto"
                >
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Cancel
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="w-full sm:w-auto sm:ml-auto shadow-md transition-all"
                  disabled={!inputValue.trim() && contentBlocks.length === 0}
                >
                  Send
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
