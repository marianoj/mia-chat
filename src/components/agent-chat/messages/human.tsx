"use client";

import { Message } from "@langchain/langgraph-sdk";
import { cn } from "@/lib/utils";
import { getContentString } from "../utils";
import { isBase64ContentBlock, MultimodalBlock } from "@/lib/multimodal-utils";
import { FileIcon, ImageIcon } from "lucide-react";

interface HumanMessageProps {
  message: Message;
}

function MultimodalPreview({ block }: { block: MultimodalBlock }) {
  if (block.type === "image" && block.mimeType.startsWith("image/")) {
    return (
      <img
        src={`data:${block.mimeType};base64,${block.data}`}
        alt={(block.metadata?.name as string) || "Uploaded image"}
        className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
      />
    );
  }

  if (block.mimeType === "application/pdf") {
    return (
      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
        <FileIcon className="h-4 w-4" />
        <span className="text-sm truncate max-w-[150px]">
          {(block.metadata?.filename as string) || "PDF file"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
      <ImageIcon className="h-4 w-4" />
      <span className="text-sm">File</span>
    </div>
  );
}

export function HumanMessage({ message }: HumanMessageProps) {
  const contentString = getContentString(message.content);
  const hasMultimodal =
    Array.isArray(message.content) &&
    message.content.some((block) => isBase64ContentBlock(block));

  return (
    <div className="flex justify-end">
      <div className="flex flex-col gap-2 max-w-[80%]">
        {/* Render images and files */}
        {hasMultimodal && Array.isArray(message.content) && (
          <div className="flex flex-wrap items-end justify-end gap-2">
            {message.content.map((block, idx) => {
              if (isBase64ContentBlock(block)) {
                return (
                  <MultimodalPreview
                    key={idx}
                    block={block as unknown as MultimodalBlock}
                  />
                );
              }
              return null;
            })}
          </div>
        )}

        {/* Render text */}
        {contentString && (
          <div
            className={cn(
              "bg-blue-500 text-white rounded-2xl px-4 py-2 ml-auto",
              "whitespace-pre-wrap break-words"
            )}
          >
            {contentString}
          </div>
        )}
      </div>
    </div>
  );
}
