import { cn } from "@/lib/utils";
import { InterruptedThreadData } from "../types";
import React from "react";
import { InboxItemStatuses } from "./statuses";
import { format } from "date-fns";
import { useQueryParams } from "../hooks/use-query-params";
import { IMPROPER_SCHEMA, VIEW_STATE_THREAD_QUERY_PARAM } from "../constants";
import { ThreadIdCopyable } from "./thread-id";

interface InterruptedInboxItem<
  ThreadValues extends Record<string, any> = Record<string, any>,
> {
  threadData: InterruptedThreadData<ThreadValues>;
  isLast: boolean;
  onThreadClick: (id: string) => void;
}

export const InterruptedInboxItem = <ThreadValues extends Record<string, any>>({
  threadData,
  isLast,
  onThreadClick,
}: InterruptedInboxItem<ThreadValues>) => {
  const { updateQueryParams } = useQueryParams();
  const firstInterrupt = threadData.interrupts?.[0];

  const descriptionPreview = firstInterrupt?.description?.slice(0, 65);
  const descriptionTruncated =
    firstInterrupt?.description && firstInterrupt.description.length > 65;

  const action = firstInterrupt?.action_request?.action;
  const title = !action || action === IMPROPER_SCHEMA ? "Interrupt" : action;
  const hasNoDescription =
    !firstInterrupt ||
    (!firstInterrupt.description && !threadData.invalidSchema);

  const updatedAtDateString = format(
    new Date(threadData.thread.updated_at),
    "MM/dd h:mm a"
  );

  const handleThreadClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent default click behavior

    // Call the onThreadClick callback first to save scroll position
    if (onThreadClick) {
      onThreadClick(threadData.thread.thread_id);
    }

    // Navigate immediately using the NextJS router approach
    // The scroll option is set to false in updateQueryParams to prevent auto-scrolling
    updateQueryParams(
      VIEW_STATE_THREAD_QUERY_PARAM,
      threadData.thread.thread_id
    );
  };

  const hasDescriptionValue =
    descriptionPreview ||
    descriptionTruncated ||
    (!firstInterrupt && threadData.invalidSchema);

  return (
    <div
      key={threadData.thread.thread_id}
      onClick={handleThreadClick}
      className={cn(
        "flex flex-col sm:grid sm:grid-cols-12 w-full p-3 sm:p-4 gap-2 sm:gap-0 sm:items-center cursor-pointer hover:bg-gray-50/90 transition-colors ease-in-out min-h-[71px]",
        !isLast && "border-b border-gray-200"
      )}
    >
      {/* Mobile: Title row with dot, Desktop: Column 1 - Dot */}
      <div className="hidden sm:flex col-span-1 justify-center">
        <div className="w-[6px] h-[6px] rounded-full bg-blue-400" />
      </div>

      {/* Title and Description */}
      <div className="sm:col-span-8 overflow-hidden">
        <div className="flex items-center gap-2">
          <div className="w-[6px] h-[6px] rounded-full bg-blue-400 flex-shrink-0 sm:hidden" />
          <span className="text-sm font-semibold text-black truncate">
            {title}
          </span>

          {threadData.invalidSchema && (
            <div className="flex-shrink-0">
              <ThreadIdCopyable
                showUUID
                threadId={threadData.thread.thread_id}
              />
            </div>
          )}
        </div>
        {hasDescriptionValue && (
          <div className="text-sm text-muted-foreground truncate h-[18px] pl-[14px] sm:pl-0">
            {descriptionPreview}
            {descriptionTruncated && "..."}
            {!firstInterrupt && threadData.invalidSchema && (
              <i>Invalid interrupt data - cannot display details.</i>
            )}
            {hasNoDescription && <span>&nbsp;</span>}
          </div>
        )}
      </div>

      {/* Mobile: Bottom row with status and timestamp */}
      <div className="flex items-center justify-between pl-[14px] sm:pl-0 sm:contents">
        {/* Statuses */}
        <div className="sm:col-span-1">
          {firstInterrupt?.config && (
            <InboxItemStatuses config={firstInterrupt.config} />
          )}
        </div>

        {/* Timestamp */}
        <p className="sm:col-span-2 text-right text-xs sm:text-sm text-gray-600 font-light">
          {updatedAtDateString}
        </p>
      </div>
    </div>
  );
};
