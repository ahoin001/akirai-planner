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

/**
 * TaskActionMenu component (JSX Version - Responsive Refactor)
 * Displays a responsive slide-up menu with actions for a selected task.
 * Focus: Responsive layout adjustments while preserving original UI look.
 */
export default function TaskActionMenu() {
  const {
    closeTaskMenu,
    isTaskMenuOpen,
    openTaskFormForEdit,
    selectedInstance: selectedTask,
    tasks,
  } = useTaskStore();

  // State for scope modal (now only used for DELETE)
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isRecurring, setIsRecurring] = useState(null);
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
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

  // Animation/Visibility Effect
  useEffect(() => {
    const animationDuration = 500;
    let mountTimer;
    let visibilityTimer;

    if (isTaskMenuOpen) {
      setIsVisible(true);
      mountTimer = setTimeout(() => setIsMounted(true), 10); // Render then animate
    } else {
      setIsMounted(false); // Animate out
      visibilityTimer = setTimeout(
        () => setIsVisible(false),
        animationDuration
      ); // Hide after animation
    }

    return () => {
      clearTimeout(mountTimer);
      clearTimeout(visibilityTimer);
    };
  }, [isTaskMenuOpen]);

  const handleBackdropClick = () => closeTaskMenu();

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
  // Step 1 (Edit): User clicks main edit button - ALWAYS opens the form
  const handleEditRequest = () => {
    if (!selectedTask) return;

    console.log(
      "Edit button clicked, calling openTaskFormForEdit with instance:",
      selectedTask
    );

    openTaskFormForEdit(selectedTask);

    setTimeout(closeTaskMenu, 50);
  };

  if (!isVisible || !selectedTask) return null;

  const startTimeFormatted = dayjs(
    `2000-01-01 ${selectedTask.start_time}`
  ).format("h:mm A");

  const endTimeFormatted = dayjs(`2000-01-01 ${selectedTask.start_time}`)
    .add(selectedTask.duration_minutes, "minute")
    .format("h:mm A");

  const dateFormatted = dayjs(selectedTask.scheduled_date).format("M/D/YY");

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
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ease-in-out ${
          isMounted ? "opacity-100" : "opacity-0" // Fade based on mount
        }`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Positioning Container: Centers the menu */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none"
        aria-live="assertive"
      >
        {/* Visual Panel: Width, background, shape, animation */}
        <div
          // Apply animation class directly
          className={`
            bg-zinc-900 text-white                   # Original background/text
            w-[90%]                                  # Original mobile width preference
            max-w-md                                 # Original max-width
            rounded-3xl                              # Original rounding
            shadow-lg overflow-hidden pointer-events-auto
            transition-transform duration-500 ease-in-out # Original duration/easing
            ${isMounted ? "translate-y-0" : "translate-y-full"} # Changed animation target to 0
          `}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-action-menu-title"
        >
          {/* Inner Content Padding: Make slightly responsive */}
          <div className="relative p-4 sm:p-6">
            {" "}
            {/* Use relative for close button positioning */}
            {/* Close Button: Positioned top-right relative to padding */}
            <button
              onClick={closeTaskMenu}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 focus-visible:ring-blue-500"
              aria-label="Close menu"
            >
              <X size={24} />{" "}
            </button>
            <div className="flex items-start gap-3 sm:gap-4 mb-4 pt-6 sm:pt-4">
              {" "}
              <TaskIcon />
              <div className="min-w-0">
                <p className="mb-1 sm:mb-2 text-gray-400 text-sm">
                  {dateFormatted}, {startTimeFormatted} - {endTimeFormatted}
                </p>
                <h2
                  id="task-action-menu-title"
                  className="text-2xl font-bold truncate"
                >
                  {" "}
                  {/* Added truncate */}
                  {selectedTask?.override_title ??
                    selectedTask?.title ??
                    "Task"}
                </h2>
              </div>
            </div>
            {/* Divider*/}
            <div className="w-full my-4 sm:my-6 border-t border-gray-700" />
            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
              {/* Delete Button */}
              <button
                onClick={handleDeleteRequest}
                className="flex flex-col items-center justify-center bg-zinc-800 p-3 sm:p-4 rounded-xl hover:bg-zinc-700/80 active:bg-zinc-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 focus-visible:ring-blue-500" // Added hover/focus, responsive padding
              >
                <div className="text-pink-500 mb-1 sm:mb-2">
                  <Trash2 size={28} />
                </div>
                <span className="text-xl">Delete</span>
              </button>

              {/* Complete/Uncheck Button */}
              <button
                onClick={handleCompleteToggle}
                className="flex flex-col items-center justify-center bg-zinc-800 p-3 sm:p-4 rounded-xl hover:bg-zinc-700/80 active:bg-zinc-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 focus-visible:ring-blue-500" // Added hover/focus, responsive padding
              >
                <div className="mb-1 sm:mb-2">
                  {selectedTask?.is_complete ? (
                    <Circle size={28} className="text-gray-400" />
                  ) : (
                    <CheckCircle size={28} className="text-green-500" />
                  )}
                </div>
                <span className="text-xl">
                  {selectedTask?.is_complete ? "Uncheck" : "Complete"}
                </span>
              </button>

              {/* Edit Button */}
              <button
                onClick={handleEditRequest}
                className="flex flex-col items-center justify-center bg-zinc-800 p-3 sm:p-4 rounded-xl hover:bg-zinc-700/80 active:bg-zinc-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 focus-visible:ring-blue-500" // Added hover/focus, responsive padding
              >
                {/* Keep original icon styling */}
                <div className="text-blue-500 mb-1 sm:mb-2">
                  <Edit size={28} />
                </div>
                <span className="text-xl">Edit</span>
              </button>
            </div>
            {/* Bottom Padding for Safe Area */}
            <div className="h-2 sm:h-4"></div>
          </div>
        </div>
      </div>

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
