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
      <DialogContent className="max-w-md bg-zinc-900 border-zinc-800 rounded-lg z-[900]">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">{title}</DialogTitle>
          {typeof message === "string" ? (
            <DialogDescription className="max-w-sm text-zinc-300">
              {message}
            </DialogDescription>
          ) : (
            <div className="text-zinc-300 text-sm">{message}</div>
          )}
        </DialogHeader>

        {showControls && (
          <DialogFooter className="sm:justify-start gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="w-full text-zinc-100 border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              {cancelText}
            </Button>
            <Button
              onClick={onConfirm}
              variant={destructive ? "destructive" : "default"}
              className="w-full"
            >
              {confirmText}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
