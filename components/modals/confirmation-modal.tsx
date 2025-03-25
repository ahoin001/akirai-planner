// components/confirmation-modal.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";

export const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  showControls = true,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
        <div className="absolute right-4 top-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-zinc-400 hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <DialogHeader>
          <DialogTitle className="text-zinc-100">{title}</DialogTitle>
          {typeof message === "string" ? (
            <DialogDescription className="text-zinc-300">
              {message}
            </DialogDescription>
          ) : (
            <div className="text-zinc-300 text-sm">{message}</div>
          )}
        </DialogHeader>

        {showControls && (
          <DialogFooter className="sm:justify-start gap-3">
            <Button
              onClick={onConfirm}
              variant={destructive ? "destructive" : "default"}
              className="w-full"
            >
              {confirmText}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="w-full text-zinc-100 border-zinc-700 hover:bg-zinc-800"
            >
              {cancelText}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
