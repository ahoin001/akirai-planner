// components/recurrence-action-modal.tsx
"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle, ChevronRight, Trash2 } from "lucide-react";
import { ConfirmationModal } from "./confirmation-modal";

const OPTIONS = {
  delete: {
    icon: <Trash2 className="w-5 h-5" />,
    title: "Delete Recurring Task",
    actions: [
      {
        value: "single",
        title: "Delete this instance only",
        description: "Remove only this occurrence",
      },
      {
        value: "future",
        title: "Delete this and future instances",
        description: "Remove this occurrence and all following ones",
      },
      {
        value: "all",
        title: "Delete all instances",
        description: "Remove entire series completely",
      },
    ],
  },
  modify: {
    icon: <CheckCircle className="w-5 h-5" />,
    title: "Modify Recurring Task",
    actions: [
      {
        value: "single",
        title: "Update this instance only",
        description: "Change only this occurrence",
      },
      {
        value: "future",
        title: "Update this and future instances",
        description: "Apply changes to this and following ones",
      },
      {
        value: "all",
        title: "Update all instances",
        description: "Modify entire series completely",
      },
    ],
  },
};

export const RecurrenceActionModal = ({
  actionType = "delete",
  isOpen,
  onClose,
  onConfirm,
  selectedOption,
  setSelectedOption,
}) => {
  const config = OPTIONS[actionType];

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() => onConfirm(selectedOption)}
      title={config.title}
      message={
        <div className="space-y-4">
          {config.actions.map((action) => (
            <Button
              key={action.value}
              variant="ghost"
              onClick={() => setSelectedOption(action.value)}
              className={`w-full h-auto p-3 justify-start text-left hover:bg-zinc-800 ${
                selectedOption === action.value
                  ? "bg-zinc-800 border border-pink-500"
                  : "bg-zinc-900"
              }`}
            >
              <span className="text-pink-500 mr-3">{config.icon}</span>
              <div className="flex-1">
                <div className="font-medium text-zinc-100">{action.title}</div>
                <div className="text-sm text-zinc-400">
                  {action.description}
                </div>
              </div>
              <ChevronRight className="ml-2 text-zinc-400" />
            </Button>
          ))}
        </div>
      }
      confirmText={
        config.actions.find((a) => a.value === selectedOption)?.title
      }
      cancelText="Cancel"
      destructive={actionType === "delete"}
      showControls={!!selectedOption}
    />
  );
};
