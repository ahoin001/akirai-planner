"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
}: ConfirmationModalProps) => {
  const [isMounted, setIsMounted] = useState(false);

  // Trigger the mount effect to apply transition after the component is rendered
  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
    } else {
      setIsMounted(false);
    }
  }, [isOpen]);

  // Handle backdrop click to close the modal
  const handleBackdropClick = () => {
    setIsMounted(false);
    setTimeout(() => {
      onClose();
    }, 300); // Adjust timeout to match the transition duration
  };

  // Handle confirm action
  const handleConfirm = () => {
    setIsMounted(false);
    setTimeout(() => {
      onConfirm();
      onClose();
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 ${isMounted ? "fade-in" : "fade-out"}`}
        onClick={handleBackdropClick}
      />

      {/* Modal container */}
      <div
        className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-drawer rounded-2xl p-6 z-50 w-[90%] max-w-md shadow-xl ${
          isMounted ? "scale-100 opacity-100" : "scale-95 opacity-0"
        } transition-all duration-300`}
        onClick={(e) => e.stopPropagation()} // Prevent backdrop click from firing when clicking inside the modal
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">{title}</h3>
          <button
            onClick={handleBackdropClick}
            className="rounded-full p-2 hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-300 mb-6">{message}</p>

        <div className="flex gap-4 justify-end">
          <Button
            variant="outline"
            onClick={handleBackdropClick}
            className="border-gray-700 hover:bg-gray-800 hover:text-white"
          >
            {cancelText}
          </Button>

          <Button
            onClick={handleConfirm}
            className={`${
              destructive
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-accent hover:bg-accent/90 text-white"
            }`}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </>
  );
};

export default ConfirmationModal;
