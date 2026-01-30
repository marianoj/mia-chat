"use client";

import React, { useRef, useEffect, FormEvent, useState } from "react";
import { useChatStreamContext } from "@/providers/ChatStream";
import { HumanMessage, AIMessage, AIMessageLoading } from "./messages";
import { DO_NOT_RENDER_ID_PREFIX } from "@/lib/ensure-tool-responses";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { cn } from "@/lib/utils";
import { Send, Paperclip, Square, X, FileIcon, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFileUpload, SUPPORTED_FILE_TYPES } from "@/hooks/use-file-upload";
import { MultimodalBlock } from "@/lib/multimodal-utils";

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

  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

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
        streamMode: ["values"],
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
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
                return <AIMessage key={message.id} message={message} />;
              })}

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
      <div className="border-t bg-white p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          {/* Content blocks preview */}
          {contentBlocks.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {contentBlocks.map((block, idx) => (
                <ContentBlockPreview
                  key={idx}
                  block={block}
                  onRemove={() => removeBlock(idx)}
                />
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* File upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept={SUPPORTED_FILE_TYPES.join(",")}
              onChange={handleFileUpload}
              multiple
              className="hidden"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0"
            >
              <Paperclip className="h-5 w-5" />
            </Button>

            {/* Text input */}
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Type a message..."
                className="resize-none min-h-[44px] max-h-[200px] pr-12"
                rows={1}
              />
            </div>

            {/* Send/Stop button */}
            {isLoading ? (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={() => stop()}
                className="flex-shrink-0"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!inputValue.trim() && contentBlocks.length === 0}
                className="flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
}
