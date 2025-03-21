"use client";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { X, Trash2, CheckCircle, Edit } from "lucide-react";
import useCalendarStore from "@/app/stores/useCalendarStore";
import { useTaskStore } from "@/app/stores/useTaskStore";

import ConfirmationModal from "./confirmation-modal";
import dayjs from "dayjs";
import { deleteTaskAction } from "@/app/actions";

/**
 * TaskActionMenu component
 *
 * Displays a slide-up menu with actions for a selected task
 *
 * @returns {JSX.Element} Rendered component
 */
export default function TaskActionMenu() {
  const { isTaskMenuOpen, selectedTask, closeTaskMenu } = useTaskStore();
  const {
    selectedTaskId,
    // isTaskMenuOpen,
    // closeTaskMenu,
    completeTask,
    // deleteTask,
    editTask,
  } = useCalendarStore();

  const [isMounted, setIsMounted] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Handle mounting animation and visibility
  useEffect(() => {
    if (isTaskMenuOpen) {
      // First make the component visible
      setIsVisible(true);
      // Then delay to allow the component to render before starting the animation
      const timer = setTimeout(() => setIsMounted(true), 10);
      return () => clearTimeout(timer);
    } else {
      // First animate down
      setIsMounted(false);
      // Then hide the component after animation completes
      const timer = setTimeout(() => setIsVisible(false), 500); // Match the duration of the animation
      return () => clearTimeout(timer);
    }
  }, [isTaskMenuOpen]);

  // Close the menu when clicking the backdrop
  const handleBackdropClick = () => {
    closeTaskMenu();
  };

  // Handle delete action
  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  // Handle actual deletion
  const confirmDelete = () => {
    if (selectedTask) {
      deleteTaskAction(selectedTask.id);

      closeTaskMenu();
    }
  };

  // Handle complete action
  const handleComplete = () => {
    if (selectedTaskId) {
      completeTask(selectedTaskId);
      closeTaskMenu();
    }
  };

  // Handle edit action
  const handleEdit = () => {
    if (selectedTaskId) {
      editTask(selectedTaskId);
    }
  };

  // Don't render anything if no task is selected or the menu should not be visible
  if (!selectedTask || !isVisible) return null;

  const startTime = dayjs(`2000-01-01 ${selectedTask.start_time}`);
  const endTime = startTime
    .add(selectedTask.duration_minutes, "minute")
    .format("h:mm A");

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleBackdropClick}
      />

      {/* Task Menu */}
      <div
        className={`fixed bottom-0 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-500 ease-in-out ${
          isMounted ? "transform -translate-y-10" : "transform translate-y-full"
        }`}
        onClick={(e) => e.stopPropagation()} // Prevent backdrop click from firing when clicking inside the menu
      >
        <div
          className="w-full max-w-md rounded-3xl overflow-hidden" // Control width here
          style={{ width: "90%", margin: "0 auto" }}
        >
          <div className="flex flex-col items-center bg-zinc-900 p-6 rounded-t-3xl relative">
            <div className="flex items-center justify-end w-full mb-4">
              <button onClick={handleBackdropClick} className="text-white">
                <X />
              </button>
            </div>

            <div className="w-full flex gap-4">
              <div>
                {/* Task icon - using the appropriate icon based on task type  */}
                <div
                  className={`w-10 h-10 rounded-full ${
                    selectedTask.color === "pink"
                      ? "bg-pink-500"
                      : "bg-blue-500"
                  } flex items-center justify-center text-white`}
                >
                  {selectedTask.type === "alarm" && (
                    <div className="w-5 h-5">⏰</div>
                  )}
                  {selectedTask.type === "workout" && (
                    <div className="w-5 h-5">💪</div>
                  )}
                  {selectedTask.type === "night" && (
                    <div className="w-5 h-5">🌙</div>
                  )}
                </div>
              </div>

              <div>
                <div>
                  <p className="mb-2 text-gray-400 text-sm">
                    {dayjs(selectedTask.scheduled_time).format("M/D/YY")},{" "}
                    {/* Hack to make time format change work. Come back to this later */}
                    {dayjs(`2000-01-01 ${selectedTask.start_time}`).format(
                      "h:mm A"
                    )}{" "}
                    - {endTime}
                  </p>
                  <h2 className="text-2xl font-bold">
                    {selectedTask.tasks.title}
                  </h2>
                </div>
              </div>
            </div>

            <div className="w-full mt-3 mb-6 border-t border-gray-700" />

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {/* Delete button */}
              <button
                onClick={handleDelete}
                className="flex flex-col items-center justify-center bg-zinc-800 p-4 rounded-xl"
              >
                <div className="text-pink-500 mb-2">
                  <Trash2 size={28} />
                </div>
                <span className="text-xl">Delete</span>
              </button>

              {/* Complete button */}
              <button
                onClick={handleComplete}
                className="flex flex-col items-center justify-center bg-zinc-800 p-4 rounded-xl"
              >
                <div className="text-green-500 mb-2">
                  <CheckCircle size={28} />
                </div>
                <span className="text-xl">Complete</span>
              </button>

              {/* Edit button */}
              <button
                className="flex flex-col items-center justify-center bg-zinc-800 p-4 rounded-xl"
                onClick={handleEdit}
              >
                <div className="text-blue-500 mb-2">
                  <Edit size={28} />
                </div>
                <span className="text-xl">Edit</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Delete */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        destructive={true}
      />
    </>
  );
}
