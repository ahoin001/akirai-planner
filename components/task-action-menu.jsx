"use client";

// Keep existing imports
import { useEffect, useState } from "react";
import { useTaskStore } from "@/app/stores/useTaskStore"; // Assuming this store exists and works
import dayjs from "dayjs";
import {
  // Assuming these actions exist and work correctly
  deleteTaskAndAllInstances,
  deleteFutureRecurringInstances,
  deleteTaskSeriesByInstanceId,
  toggleTaskInstanceCompletionAction,
  deleteSingleTaskInstance,
  updateTask,
} from "@/app/actions"; // Make sure path is correct
import {
  CheckCircle,
  Circle,
  Edit,
  Trash2,
  X,
  Clock,
  Calendar,
} from "lucide-react"; // Add Clock/Calendar if needed
import { ConfirmationModal } from "@/components/modals/confirmation-modal"; // Assuming these modals exist
import { RecurrenceActionModal } from "@/components/modals/recurrence-action-modal";

/**
 * TaskActionMenu component (JSX Version - Responsive Refactor)
 * Displays a responsive slide-up menu with actions for a selected task.
 * Focus: Responsive layout adjustments while preserving original UI look.
 */
export default function TaskActionMenu() {
  // --- State and Store (Original logic) ---
  const {
    closeTaskMenu,
    openTaskFormInEditMode,
    isTaskMenuOpen,
    selectedTask,
  } = useTaskStore();

  // Component state - Original logic
  const [deleteScope, setDeleteScope] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isRecurring, setIsRecurring] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsRecurring(selectedTask?.tasks?.is_recurring || false);
  }, [selectedTask]);

  // Animation/Visibility Effect (Original logic, keep 500ms duration)
  useEffect(() => {
    const animationDuration = 500; // Keep original duration
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
    // Cleanup timers
    return () => {
      clearTimeout(mountTimer);
      clearTimeout(visibilityTimer);
    };
  }, [isTaskMenuOpen]);

  // --- Action Handlers (Original Logic - Renamed for clarity) ---
  const handleBackdropClick = () => closeTaskMenu();

  const handleCompleteToggle = async () => {
    // Renamed from handleComplete
    if (!selectedTask) return;
    try {
      await toggleTaskInstanceCompletionAction(selectedTask.id);
      closeTaskMenu();
    } catch (error) {
      console.error("Failed to toggle task completion:", error);
    }
  };

  const handleDeleteRequest = () => {
    // Renamed from onDelete
    if (isRecurring) {
      setDeleteScope(null);
      setIsRecurrenceModalOpen(true);
    } else {
      setIsDeleteModalOpen(true);
    }
  };

  const handleDeleteRecurringConfirmed = (scope) => {
    if (!selectedTask || !scope) return;
    setIsRecurrenceModalOpen(false);
    setDeleteScope(scope);
    setIsDeleteModalOpen(true);
  };

  const handleFinalDeleteConfirmed = async () => {
    // Renamed from handleDeleteConfirmation
    if (!selectedTask) return;
    setIsDeleteModalOpen(false);
    try {
      if (isRecurring && deleteScope) {
        switch (deleteScope) {
          case "single":
            await deleteSingleTaskInstance(selectedTask.id);
            break;
          case "future":
            if (selectedTask.tasks?.id && selectedTask.scheduled_date) {
              await deleteFutureRecurringInstances(
                selectedTask.tasks.id,
                selectedTask.scheduled_date
              );
            } else {
              throw new Error("Missing data for future delete.");
            }
            break;
          case "all":
            await deleteTaskSeriesByInstanceId(selectedTask.id);
            break;
        }
      } else if (!isRecurring) {
        await deleteSingleTaskInstance(selectedTask.id);
      } else {
        throw new Error("Invalid state for deletion.");
      }
      closeTaskMenu();
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setDeleteScope(null);
    }
  };

  const handleEdit = () => {
    // Renamed from onEdit
    if (selectedTask) {
      openTaskFormInEditMode(selectedTask.id);
      closeTaskMenu();
    }
  };

  // --- Render Logic ---
  if (!isVisible || !selectedTask) return null;

  // Format data for display (Original logic)
  const startTimeFormatted = dayjs(
    `2000-01-01 ${selectedTask.start_time}`
  ).format("h:mm A");
  const endTimeFormatted = dayjs(`2000-01-01 ${selectedTask.start_time}`)
    .add(selectedTask.duration_minutes, "minute")
    .format("h:mm A");
  const dateFormatted = dayjs(selectedTask.scheduled_date).format("M/D/YY"); // Keep original date format

  // Task Icon Component (Original logic)
  const TaskIcon = () => {
    return (
      <div
        className={`w-10 h-10 rounded-full ${
          // Keep original rounding/size
          selectedTask?.color === "pink" ? "bg-pink-500" : "bg-blue-500" // Keep original colors
        } flex items-center justify-center text-white flex-shrink-0`} // Add flex-shrink-0
      >
        {/* Keep original icon logic */}
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

  // --- Responsive JSX Refactor ---
  return (
    <>
      {/* Backdrop: Unchanged visually, added fade transition */}
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
              {/* Keep original icon size preference if desired */}
            </button>
            {/* Optional Drag Handle (can add if desired) */}
            {/* <div className="mx-auto w-12 h-1.5 bg-gray-600 rounded-full mb-4" /> */}
            {/* Header Section: Keep original structure, make gap responsive */}
            {/* Removed outer alignment div, use padding */}
            <div className="flex items-start gap-3 sm:gap-4 mb-4 pt-6 sm:pt-4">
              {" "}
              {/* Added top padding to account for absolute close btn */}
              <TaskIcon />
              {/* Text container */}
              <div className="min-w-0">
                {" "}
                {/* Add min-w-0 for truncation */}
                {/* Date/Time Info: Keep original format/style */}
                <p className="mb-1 sm:mb-2 text-gray-400 text-sm">
                  {" "}
                  {/* Slightly adjusted margin */}
                  {dateFormatted}, {startTimeFormatted} - {endTimeFormatted}
                </p>
                {/* Title: Keep original style */}
                <h2
                  id="task-action-menu-title"
                  className="text-2xl font-bold truncate"
                >
                  {" "}
                  {/* Added truncate */}
                  {selectedTask?.override_title ??
                    selectedTask?.tasks?.title ??
                    "Task"}
                </h2>
              </div>
            </div>
            {/* Divider: Keep original style, adjust margin */}
            <div className="w-full my-4 sm:my-6 border-t border-gray-700" />
            {/* Action Buttons Grid: Keep original styles, make gap responsive */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
              {" "}
              {/* Adjusted gap/margin */}
              {/* Delete Button */}
              <button
                onClick={handleDeleteRequest}
                className="flex flex-col items-center justify-center bg-zinc-800 p-3 sm:p-4 rounded-xl hover:bg-zinc-700/80 active:bg-zinc-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 focus-visible:ring-blue-500" // Added hover/focus, responsive padding
              >
                {/* Keep original icon styling */}
                <div className="text-pink-500 mb-1 sm:mb-2">
                  <Trash2 size={28} />
                </div>
                {/* Keep original text styling */}
                <span className="text-xl">Delete</span>
              </button>
              {/* Complete/Uncheck Button */}
              <button
                onClick={handleCompleteToggle}
                className="flex flex-col items-center justify-center bg-zinc-800 p-3 sm:p-4 rounded-xl hover:bg-zinc-700/80 active:bg-zinc-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 focus-visible:ring-blue-500" // Added hover/focus, responsive padding
              >
                {/* Keep original icon styling */}
                <div className="mb-1 sm:mb-2">
                  {selectedTask?.is_complete ? (
                    <Circle size={28} className="text-gray-400" />
                  ) : (
                    <CheckCircle size={28} className="text-green-500" />
                  )}
                </div>
                {/* Keep original text styling */}
                <span className="text-xl">
                  {selectedTask?.is_complete ? "Uncheck" : "Complete"}
                </span>
              </button>
              {/* Edit Button */}
              <button
                onClick={handleEdit}
                className="flex flex-col items-center justify-center bg-zinc-800 p-3 sm:p-4 rounded-xl hover:bg-zinc-700/80 active:bg-zinc-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 focus-visible:ring-blue-500" // Added hover/focus, responsive padding
              >
                {/* Keep original icon styling */}
                <div className="text-blue-500 mb-1 sm:mb-2">
                  <Edit size={28} />
                </div>
                {/* Keep original text styling */}
                <span className="text-xl">Edit</span>
              </button>
            </div>
            {/* Bottom Padding for Safe Area */}
            <div className="h-2 sm:h-4"></div>
          </div>
        </div>
      </div>

      {/* --- Modals (Original logic) --- */}
      <RecurrenceActionModal
        actionType="delete"
        isOpen={isRecurrenceModalOpen}
        onClose={() => setIsRecurrenceModalOpen(false)}
        onConfirm={handleDeleteRecurringConfirmed}
        // Pass original props if needed by your modal
        selectedOption={deleteScope}
        setSelectedOption={setDeleteScope}
      />

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteScope(null);
        }}
        onConfirm={handleFinalDeleteConfirmed}
        title="Confirm Deletion"
        message={
          /* Original message logic */
          isRecurring && deleteScope
            ? `Are you sure you want to delete ${
                deleteScope === "single"
                  ? "this instance"
                  : deleteScope === "future"
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
