import { cn } from "@/lib/utils";
import { Thread } from "@langchain/langgraph-sdk";
import { ThreadIdCopyable } from "./thread-id";
import { InboxItemStatuses } from "./statuses";
import { format } from "date-fns";
import { useQueryParams } from "../hooks/use-query-params";
import {
  STUDIO_NOT_WORKING_TROUBLESHOOTING_URL,
  VIEW_STATE_THREAD_QUERY_PARAM,
} from "../constants";
import { GenericThreadData } from "../types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useThreadsContext } from "../contexts/ThreadContext";

import { constructOpenInStudioURL } from "../utils";

interface GenericInboxItemProps<
  ThreadValues extends Record<string, any> = Record<string, any>,
> {
  threadData:
    | GenericThreadData<ThreadValues>
    | {
        thread: Thread<ThreadValues>;
        status: "interrupted";
        interrupts?: undefined;
      };
  isLast: boolean;
}

export function GenericInboxItem<
  ThreadValues extends Record<string, any> = Record<string, any>,
>({ threadData, isLast }: GenericInboxItemProps<ThreadValues>) {
  const { updateQueryParams } = useQueryParams();
  const { toast } = useToast();
  const { agentInboxes } = useThreadsContext();

  const selectedInbox = agentInboxes.find((i) => i.selected);

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
      threadData.thread.thread_id
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

  const updatedAtDateString = format(
    new Date(threadData.thread.updated_at),
    "MM/dd h:mm a"
  );

  return (
    <div
      onClick={() =>
        updateQueryParams(
          VIEW_STATE_THREAD_QUERY_PARAM,
          threadData.thread.thread_id
        )
      }
      className={cn(
        "flex flex-col sm:grid sm:grid-cols-12 w-full p-3 sm:p-4 gap-2 sm:gap-0 cursor-pointer hover:bg-gray-50/90 transition-colors ease-in-out min-h-[71px]",
        !isLast && "border-b-[1px] border-gray-200"
      )}
    >
      {/* Desktop spacer */}
      <div className="hidden sm:flex col-span-1 justify-center items-center">
        {/* Empty space for alignment with interrupted items */}
      </div>

      {/* Thread ID row */}
      <div
        className={cn(
          "sm:col-span-6 flex items-center justify-start gap-2 flex-wrap",
          !selectedInbox && "sm:col-span-9"
        )}
      >
        <p className="text-sm font-semibold text-black">Thread ID:</p>
        <ThreadIdCopyable showUUID threadId={threadData.thread.thread_id} />
      </div>

      {/* Mobile: Bottom row with Studio button, status, and timestamp */}
      <div className="flex items-center justify-between gap-2 sm:contents">
        {selectedInbox && (
          <div className="sm:col-span-2 flex items-center">
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-1 bg-white text-xs sm:text-sm"
              onClick={handleOpenInStudio}
            >
              Studio
            </Button>
          </div>
        )}

        <div
          className={cn(
            "sm:col-span-2 flex items-center",
            !selectedInbox && "sm:col-start-10"
          )}
        >
          <InboxItemStatuses status={threadData.status} />
        </div>

        <p className="sm:col-span-1 text-right text-xs sm:text-sm text-gray-600 font-light sm:pt-2">
          {updatedAtDateString}
        </p>
      </div>
    </div>
  );
}
