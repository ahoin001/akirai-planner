"use client";

import { useEffect, useState } from "react";
import { usePlannerStore } from "@/store/use-planner-store";
import dayjs from "dayjs";
import {
  X,
  Trash2,
  CheckCircle,
  Edit,
  Calendar,
  CalendarRange,
} from "lucide-react";
import {
  toggleTaskInstanceCompletion,
  deleteTask,
  getTasksFromWeekWithInstances,
} from "@/lib/supabase-client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function TaskActionMenu() {
  const {
    selectedTaskId,
    taskInstances,
    currentWeekStart,
    setTaskInstances,
    setSelectedTaskId,
    setIsTaskFormOpen,
    setEditingTask,
    setDeletingTaskId,
  } = usePlannerStore();

  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRecurringOptionsOpen, setIsRecurringOptionsOpen] = useState(false);
  const [recurringAction, setRecurringAction] = useState(null); // 'edit' or 'delete'

  // Find the selected task
  const selectedTask = selectedTaskId
    ? taskInstances.find((task) => task.id === selectedTaskId)
    : null;
  const isRecurring = selectedTask?.tasks?.is_recurring || false;

  // Handle mounting animation and visibility
  useEffect(() => {
    if (selectedTaskId) {
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
  }, [selectedTaskId]);

  const closeMenu = () => {
    setIsMounted(false);
    setTimeout(() => {
      setSelectedTaskId(null);
      setIsVisible(false);
    }, 500);
  };

  const handleDelete = () => {
    if (isRecurring) {
      setRecurringAction("delete");
      setIsRecurringOptionsOpen(true);
    } else {
      setIsDeleteDialogOpen(true);
    }
  };

  const confirmDeleteSingle = async () => {
    if (!selectedTaskId) return;

    try {
      // Set the deleting task ID to trigger fade-out animation
      setDeletingTaskId(selectedTaskId);

      // Wait for animation to complete before actual deletion
      setTimeout(async () => {
        await deleteTask(selectedTaskId, false); // false = delete only this instance

        // Refresh tasks to update UI in real-time
        const weekStart = dayjs(currentWeekStart);
        const updatedTasks = await getTasksFromWeekWithInstances(weekStart);
        setTaskInstances(updatedTasks);

        // Clear the deleting task ID
        setDeletingTaskId(null);
      }, 500);

      closeMenu();
      setIsDeleteDialogOpen(false);
      setIsRecurringOptionsOpen(false);
    } catch (error) {
      console.error("Error deleting task:", error);
      setDeletingTaskId(null);
    }
  };

  // Confirm task deletion (all instances)
  const confirmDeleteAll = async () => {
    if (!selectedTaskId) return;

    try {
      // Set the deleting task ID to trigger fade-out animation
      setDeletingTaskId(selectedTaskId);

      // Wait for animation to complete before actual deletion
      setTimeout(async () => {
        await deleteTask(selectedTaskId, true); // true = delete all instances

        // Refresh tasks to update UI in real-time
        const weekStart = dayjs(currentWeekStart);
        const updatedTasks = await getTasksFromWeekWithInstances(weekStart);
        setTaskInstances(updatedTasks);

        // Clear the deleting task ID
        setDeletingTaskId(null);
      }, 500);

      closeMenu();
      setIsDeleteDialogOpen(false);
      setIsRecurringOptionsOpen(false);
    } catch (error) {
      console.error("Error deleting task:", error);
      setDeletingTaskId(null);
    }
  };

  // Handle complete action with real-time UI update
  const handleComplete = async () => {
    if (!selectedTaskId) return;

    try {
      await toggleTaskInstanceCompletion(selectedTaskId);

      // Refresh tasks to update UI in real-time
      const weekStart = dayjs(currentWeekStart);
      const updatedTasks = await getTasksFromWeekWithInstances(weekStart);
      setTaskInstances(updatedTasks);

      closeMenu();
    } catch (error) {
      console.error("Error completing task:", error);
    }
  };

  // Handle edit action
  const handleEdit = () => {
    if (selectedTask) {
      if (isRecurring) {
        setRecurringAction("edit");
        setIsRecurringOptionsOpen(true);
      } else {
        setEditingTask(selectedTask);
        setIsTaskFormOpen(true);
        closeMenu();
      }
    }
  };

  // Handle edit single instance
  const handleEditSingle = () => {
    if (selectedTask) {
      // Set a flag to indicate we're only editing this instance
      const taskWithFlag = {
        ...selectedTask,
        editSingleInstance: true,
      };
      setEditingTask(taskWithFlag);
      setIsTaskFormOpen(true);
      closeMenu();
      setIsRecurringOptionsOpen(false);
    }
  };

  // Handle edit all future instances
  const handleEditAllFuture = () => {
    if (selectedTask) {
      // Set a flag to indicate we're editing all future instances
      const taskWithFlag = {
        ...selectedTask,
        editAllFuture: true,
      };
      setEditingTask(taskWithFlag);
      setIsTaskFormOpen(true);
      closeMenu();
      setIsRecurringOptionsOpen(false);
    }
  };

  // Don't render anything if no task is selected or the menu should not be visible
  if (!selectedTask || !isVisible) return null;

  // Get task color
  const getTaskColor = (task) => {
    // In a real app, you'd have a color field in your task data
    // For this example, we'll use a simple mapping based on task title
    const title = task.tasks?.title?.toLowerCase() || "";

    if (title.includes("alarm") || task.start_time.startsWith("08:")) {
      return "bg-rose-400";
    } else if (title.includes("coffee") || title.includes("breakfast")) {
      return "bg-green-500";
    } else if (
      title.includes("dog") ||
      title.includes("pet") ||
      title.includes("walk")
    ) {
      return "bg-blue-500";
    } else {
      return "bg-purple-500";
    }
  };

  // Get task icon
  const getTaskIcon = (task) => {
    const title = task.tasks?.title?.toLowerCase() || "";

    if (title.includes("alarm") || task.start_time.startsWith("08:")) {
      return "⏰";
    } else if (title.includes("coffee") || title.includes("breakfast")) {
      return "☕";
    } else if (
      title.includes("dog") ||
      title.includes("pet") ||
      title.includes("walk")
    ) {
      return "🐾";
    } else {
      return "✓";
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isMounted ? "opacity-100" : "opacity-0"
        }`}
        onClick={closeMenu}
      />
      {/* Task Menu */}
      <div
        className={`fixed bottom-0 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-500 ease-in-out ${
          isMounted ? "translate-y-0" : "translate-y-full"
        }`}
        onClick={(e) => e.stopPropagation()} // Prevent backdrop click from firing when clicking inside the menu
      >
        <div
          className="w-full max-w-md rounded-3xl overflow-hidden"
          style={{ width: "90%", margin: "0 auto" }}
        >
          <div className="flex flex-col items-center bg-zinc-900 p-6 rounded-t-3xl relative">
            <div className="flex items-center justify-end w-full mb-4">
              <button onClick={closeMenu} className="text-white">
                <X />
              </button>
            </div>

            <div className="w-full flex gap-4">
              <div>
                {/* Task icon */}
                <div
                  className={`w-10 h-10 rounded-full ${getTaskColor(
                    selectedTask
                  )} flex items-center justify-center text-white`}
                >
                  <div className="w-5 h-5">{getTaskIcon(selectedTask)}</div>
                </div>
              </div>

              <div>
                <div>
                  <p className="text-gray-400 text-sm">
                    {dayjs(selectedTask.scheduled_date).format("M/D/YY")},{" "}
                    {dayjs(`2000-01-01T${selectedTask.start_time}`).format(
                      "h:mm A"
                    )}
                  </p>
                  <h2 className="text-2xl font-bold">
                    {selectedTask.tasks?.title}
                  </h2>
                  {isRecurring && (
                    <div className="flex items-center mt-1 text-sm text-gray-400">
                      <CalendarRange className="w-4 h-4 mr-1" />
                      <span>Recurring task</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="w-full mt-3 mb-6 border-t border-gray-700" />

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {/* Delete button */}
              <button
                onClick={handleDelete}
                className="flex flex-col items-center justify-center bg-zinc-800 p-4 rounded-xl hover:bg-zinc-700 transition-colors"
              >
                <div className="text-rose-400 mb-2">
                  <Trash2 size={28} />
                </div>
                <span className="text-xl">Delete</span>
              </button>
              {/* Complete button */}
              <button
                onClick={handleComplete}
                className="flex flex-col items-center justify-center bg-zinc-800 p-4 rounded-xl hover:bg-zinc-700 transition-colors"
              >
                <div className="text-green-500 mb-2">
                  <CheckCircle size={28} />
                </div>
                <span className="text-xl">Complete</span>
              </button>
              <button
                className="flex flex-col items-center justify-center bg-zinc-800 p-4 rounded-xl hover:bg-zinc-700 transition-colors"
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
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteSingle}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recurring Task Options Dialog */}
      <Dialog
        open={isRecurringOptionsOpen}
        onOpenChange={setIsRecurringOptionsOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {recurringAction === "edit"
                ? "Edit Recurring Task"
                : "Delete Recurring Task"}
            </DialogTitle>
            <DialogDescription>
              {recurringAction === "edit"
                ? "Would you like to edit just this occurrence or this and all future occurrences?"
                : "Would you like to delete just this occurrence or all occurrences of this task?"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {recurringAction === "edit" ? (
              <>
                <Button
                  onClick={handleEditSingle}
                  className="flex items-center justify-start gap-2 bg-zinc-800 hover:bg-zinc-700 text-white"
                >
                  <Calendar className="w-5 h-5" />
                  <div className="text-left">
                    <div>Edit this occurrence</div>
                    <div className="text-xs text-gray-400">
                      Only change this specific instance
                    </div>
                  </div>
                </Button>

                <Button
                  onClick={handleEditAllFuture}
                  className="flex items-center justify-start gap-2 bg-zinc-800 hover:bg-zinc-700 text-white"
                >
                  <CalendarRange className="w-5 h-5" />
                  <div className="text-left">
                    <div>Edit this and all future occurrences</div>
                    <div className="text-xs text-gray-400">
                      Change the pattern for future tasks
                    </div>
                  </div>
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={confirmDeleteSingle}
                  className="flex items-center justify-start gap-2 bg-zinc-800 hover:bg-zinc-700 text-white"
                >
                  <Calendar className="w-5 h-5" />
                  <div className="text-left">
                    <div>Delete this occurrence</div>
                    <div className="text-xs text-gray-400">
                      Only remove this specific instance
                    </div>
                  </div>
                </Button>

                <Button
                  onClick={confirmDeleteAll}
                  className="flex items-center justify-start gap-2 bg-red-900 hover:bg-red-800 text-white"
                >
                  <CalendarRange className="w-5 h-5" />
                  <div className="text-left">
                    <div>Delete all occurrences</div>
                    <div className="text-xs text-gray-300">
                      Remove this and all related tasks
                    </div>
                  </div>
                </Button>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRecurringOptionsOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
