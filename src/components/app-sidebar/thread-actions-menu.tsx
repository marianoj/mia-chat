"use client";

import { Trash2, MoreVertical, Pencil } from "lucide-react";
import React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Thread } from "@langchain/langgraph-sdk";

interface ThreadActionsMenuProps {
  thread: Thread;
  currentTitle: string;
  onRename: (threadId: string, title: string) => Promise<void>;
  onDelete: (threadId: string) => Promise<void>;
}

export function ThreadActionsMenu({
  thread,
  currentTitle,
  onRename,
  onDelete,
}: ThreadActionsMenuProps) {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState(currentTitle);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleRename = async () => {
    if (!newTitle.trim()) return;
    setIsLoading(true);
    try {
      await onRename(thread.thread_id, newTitle.trim());
      setRenameDialogOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await onDelete(thread.thread_id);
      setDeleteDialogOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="w-4 h-4 text-gray-500" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            className="cursor-pointer flex items-center gap-2"
            onClick={(e) => {
              e.stopPropagation();
              setNewTitle(currentTitle);
              setRenameDialogOpen(true);
              setDropdownOpen(false);
            }}
          >
            <Pencil className="w-4 h-4" />
            <span>Rename</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-red-500 focus:text-red-500 flex items-center gap-2"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteDialogOpen(true);
              setDropdownOpen(false);
            }}
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rename Thread</DialogTitle>
            <DialogDescription>
              Enter a new name for this conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Thread name"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading) {
                  handleRename();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={isLoading || !newTitle.trim()}>
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Thread</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this conversation? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
            >
              {isLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
