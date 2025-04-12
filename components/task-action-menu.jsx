"use client";

import { useEffect, useMemo, useState } from "react";
import { useTaskStore } from "@/app/stores/useTaskStore";
import dayjs from "dayjs";
import {
  deleteFutureOccurrencesAction,
  deleteSingleTaskOrOccurrenceAction,
  deleteTaskSeriesAction,
  toggleTaskOccurrenceCompletionAction,
} from "@/app/actions";
import { CheckCircle, Circle, Edit, Trash2, X, Clock } from "lucide-react";
import { ConfirmationModal } from "@/components/modals/confirmation-modal";
import { RecurrenceActionModal } from "@/components/modals/recurrence-action-modal";

import { Sheet, SheetContent } from "@/components/ui/sheet"; // Added shadcn sheet

/**
 * TaskActionMenu component (JSX Version - Responsive Refactor)
 * Displays a responsive slide-up menu with actions for a selected task.
 * Focus: Responsive layout adjustments while preserving original UI look.
 */
export default function TaskActionMenu() {
  const {
    closeTaskMenu,
    formatTimeRange,
    isTaskMenuOpen,
    openTaskFormForEdit,
    selectedInstance: selectedTask,
    tasks,
  } = useTaskStore();

  // State for scope modal (now only used for DELETE)
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [isRecurring, setIsRecurring] = useState(null);
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
  const [scopeActionType, setScopeActionType] = useState(null);

  // Find the parent task definition from the store's tasks array
  const parentTaskDefinition = useMemo(() => {
    if (!selectedTask?.task_id || !tasks) return null;
    return tasks.find((task) => task.id === selectedTask.task_id);
  }, [selectedTask, tasks]);

  // Determine if the series is recurring based on the parent task's rrule
  const isParentRecurring = !!parentTaskDefinition?.rrule;

  useEffect(() => {
    setIsRecurring(selectedTask?.tasks?.is_recurring || false);
  }, [selectedTask]);

  const handleCompleteToggle = async () => {
    if (
      !selectedTask ||
      !selectedTask.task_id ||
      !selectedTask.original_occurrence_time_utc
    ) {
      toast.error("Cannot toggle completion: Task details missing.");
      return;
    }

    const newCompletionState = !selectedTask.is_complete;

    try {
      await toggleTaskOccurrenceCompletionAction({
        taskId: selectedTask.task_id,
        originalOccurrenceTimeUTC: selectedTask.original_occurrence_time_utc,
        newCompletionState: newCompletionState,
        // Pass exception ID if available (from calculated instance)
        exceptionId: selectedTask.id.startsWith(selectedTask.task_id + "-")
          ? null
          : selectedTask.id,
      });
      // toast.success(
      //   `Task marked as ${newCompletionState ? "complete" : "incomplete"}.`
      // );
      closeTaskMenu();
    } catch (error) {
      console.error("Failed to toggle task completion:", error);
      // toast.error(error.message || "Failed to update task status.");
    }
  };

  // Step 1: User clicks the main delete button
  const handleDeleteRequest = () => {
    if (isParentRecurring) {
      setScopeActionType(null);
      setIsRecurrenceModalOpen(true);
    } else {
      setScopeActionType("single"); // Deleting single non-recurring task = deleting the 'series' (the task itself)
      setIsConfirmationModalOpen(true);
    }
  };

  // Step 2: User chooses scope in RecurrenceActionModal (for recurring tasks)
  const handleScopeActionTypeSelected = (scope) => {
    if (!scope) return; // Should not happen if modal requires selection
    setScopeActionType(scope);
    setIsRecurrenceModalOpen(false);
    setIsConfirmationModalOpen(true);
  };

  // Step 3: User confirms deletion in ConfirmationModal
  const handleFinalDeleteConfirmed = async () => {
    if (!selectedTask || !scopeActionType) return;

    setIsConfirmationModalOpen(false);
    const taskId = selectedTask.task_id; // ID of the parent task definition
    const originalTimeUTC = selectedTask.original_occurrence_time_utc;

    try {
      let successMessage = "Task deleted.";
      switch (scopeActionType) {
        case "single":
          console.log(
            `Action: Deleting single occurrence at ${originalTimeUTC}`
          );
          await deleteSingleTaskOrOccurrenceAction({
            taskId: taskId,
            originalOccurrenceTimeUTC: originalTimeUTC,
            isParentRecurring: isParentRecurring,
            // Pass exception ID if known, so action can potentially update instead of insert
            exceptionId: selectedTask.id.startsWith(taskId + "-")
              ? null
              : selectedTask.id,
          });
          successMessage = "Task occurrence deleted.";
          break;
        case "future":
          console.log(
            `Action: Deleting future occurrences from ${originalTimeUTC}`
          );
          await deleteFutureOccurrencesAction(taskId, originalTimeUTC);
          successMessage = "Future occurrences deleted.";
          break;
        case "all":
          console.log(`Action: Deleting entire task series ${taskId}`);
          await deleteTaskSeriesAction(taskId); // Use the new specific action
          successMessage = "Entire task series deleted.";
          break;
        default:
          throw new Error("Invalid delete scope selected.");
      }

      // toast.success(successMessage);
      closeTaskMenu(); // Close menu on success
    } catch (error) {
      console.error("Delete failed:", error);
      // toast.error(error.message || "Failed to delete task.");
    } finally {
      setScopeActionType(null);
    }
  };

  // --- EDIT FLOW ---
  const handleEditRequest = () => {
    if (!selectedTask) return;

    console.log(
      "Edit button clicked, calling openTaskFormForEdit with instance:",
      selectedTask
    );

    openTaskFormForEdit(selectedTask);

    setTimeout(closeTaskMenu, 50);
  };

  const dateFormatted = selectedTask
    ? dayjs(selectedTask.scheduled_date).format("M/D/YY")
    : "";

  const TaskIcon = () => {
    return (
      <div
        className={`w-10 h-10 rounded-full ${
          selectedTask?.color === "pink" ? "bg-pink-500" : "bg-blue-500"
        } flex items-center justify-center text-white flex-shrink-0`}
      >
        {selectedTask?.type === "alarm" && <div className="w-5 h-5">⏰</div>}
        {selectedTask?.type === "workout" && <div className="w-5 h-5">💪</div>}
        {selectedTask?.type === "night" && <div className="w-5 h-5">🌙</div>}
        {/* Add default or handle other types if necessary */}
        {!["alarm", "workout", "night"].includes(selectedTask?.type) && (
          <Clock size={20} />
        )}
      </div>
    );
  };

  return (
    <>
      <Sheet open={isTaskMenuOpen} onOpenChange={closeTaskMenu}>
        <SheetContent
          side="bottom"
          className={`w-full max-w-xl mx-auto bg-zinc-900 rounded-3xl shadow-lg overflow-hidden pointer-events-auto ${isTaskMenuOpen && "mb-20"}`}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {selectedTask && (
            <div className="relative p-4 sm:p-6">
              {/* Close Button */}
              <button
                onClick={closeTaskMenu}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/60 transition-colors focus:outline-none"
                aria-label="Close menu"
              >
                <X size={24} />
              </button>

              {/* Content - Same as before */}
              <div className="flex items-start gap-3 sm:gap-4 mb-4 pt-6 sm:pt-4">
                <TaskIcon />
                <div className="min-w-0">
                  <p className="mb-1 sm:mb-2 text-gray-400 text-sm">
                    {dateFormatted}, {formatTimeRange(selectedTask)}
                  </p>
                  <h2 className="text-2xl font-bold truncate">
                    {selectedTask?.override_title ??
                      selectedTask?.title ??
                      "Task"}
                  </h2>
                </div>
              </div>

              <div className="w-full my-4 sm:my-6 border-t border-gray-700" />

              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {/* Delete Button */}
                <button
                  onClick={handleDeleteRequest}
                  className="flex flex-col items-center justify-center bg-zinc-800 p-3 sm:p-4 rounded-xl hover:bg-zinc-700/80 transition-colors"
                >
                  <Trash2 size={28} className="text-pink-500 mb-1 sm:mb-2" />
                  <span className="text-xl">Delete</span>
                </button>

                {/* Complete Button */}
                <button
                  onClick={handleCompleteToggle}
                  className="flex flex-col items-center justify-center bg-zinc-800 p-3 sm:p-4 rounded-xl hover:bg-zinc-700/80 transition-colors"
                >
                  {selectedTask?.is_complete ? (
                    <Circle size={28} className="text-gray-400 mb-1 sm:mb-2" />
                  ) : (
                    <CheckCircle
                      size={28}
                      className="text-green-500 mb-1 sm:mb-2"
                    />
                  )}
                  <span className="text-xl">
                    {selectedTask?.is_complete ? "Uncheck" : "Complete"}
                  </span>
                </button>

                {/* Edit Button */}
                <button
                  onClick={handleEditRequest}
                  className="flex flex-col items-center justify-center bg-zinc-800 p-3 sm:p-4 rounded-xl hover:bg-zinc-700/80 transition-colors"
                >
                  <Edit size={28} className="text-blue-500 mb-1 sm:mb-2" />
                  <span className="text-xl">Edit</span>
                </button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <RecurrenceActionModal
        actionType="delete"
        isOpen={isRecurrenceModalOpen}
        onClose={() => setIsRecurrenceModalOpen(false)}
        onConfirm={handleScopeActionTypeSelected}
        selectedOption={scopeActionType}
        setSelectedOption={setScopeActionType}
      />

      <ConfirmationModal
        isOpen={isConfirmationModalOpen}
        onClose={() => {
          setIsConfirmationModalOpen(false);
          setScopeActionType(null);
        }}
        onConfirm={handleFinalDeleteConfirmed}
        title="Confirm Deletion"
        message={
          isRecurring && scopeActionType
            ? `Are you sure you want to delete ${
                scopeActionType === "single"
                  ? "this instance"
                  : scopeActionType === "future"
                    ? "this and all future instances"
                    : "all instances in this series"
              }? This cannot be undone.`
            : "Are you sure you want to delete this task? This action cannot be undone."
        }
        confirmText="Delete"
        cancelText="Cancel"
        destructive={true}
      />
    </>
  );
}
