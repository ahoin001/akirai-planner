"use client";

import { format, parseISO, isAfter, isSameDay } from "date-fns";

import {
  ChevronUp,
  ChevronDown,
  AlarmClock,
  Moon,
  Dumbbell,
} from "lucide-react";

import dayjs from "dayjs";
import useCalendarStore from "@/app/stores/useCalendarStore";
import React, { useRef, useEffect, useState, memo } from "react";
import { useTaskStore } from "@/app/stores/useTaskStore";

/**
 * Gets the appropriate icon for a task type
 * @param {string} type - The task type ('alarm', 'workout', or 'night')
 * @returns {JSX.Element} The icon component
 */
const getTaskIcon = (type) => {
  switch (type) {
    case "alarm":
      return <AlarmClock className="w-5 h-5" />;
    case "workout":
      return <Dumbbell className="w-5 h-5" />;
    case "night":
      return <Moon className="w-5 h-5" />;
    default:
      return null;
  }
};

/**
 * Individual task item in the drawer
 * Memoized to prevent unnecessary rerenders
 */
const TaskItem = memo(
  ({ task, isSelected, isInFuture, startTime, endTime, onClick, ref }) => {
    const isCompleted = task.is_complete;

    // Format time range
    const formatTimeRange = (task) => {
      const startTime = dayjs(`2000-01-01T${task.start_time}`);
      const endTime = startTime.add(task.duration_minutes, "minute");

      return `${startTime.format("h:mm A")} – ${endTime.format("h:mm A")}`;
    };

    return (
      <div
        ref={ref}
        className={`flex items-center space-x-4 cursor-pointer hover:bg-zinc-800 p-2 rounded-lg transition-colors
        ${isSelected ? "bg-zinc-800" : ""}`}
        onClick={onClick}
      >
        {/* Task icon */}
        <div
          className={`w-10 h-10 rounded-full ${
            isCompleted
              ? "bg-green-500"
              : isInFuture
                ? "bg-gray-700"
                : task.color === "pink"
                  ? "bg-pink-500"
                  : "bg-blue-500"
          } flex items-center justify-center`}
        >
          {getTaskIcon(task.type)}
        </div>

        {/* Task details */}
        <div className={isCompleted ? "opacity-60" : ""}>
          <div className="font-medium flex items-center">
            {task.tasks.title}
            {isCompleted && (
              <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                Completed
              </span>
            )}
          </div>
          <div className="text-sm text-gray-400">{formatTimeRange(task)}</div>
        </div>
      </div>
    );
  }
);

TaskItem.displayName = "TaskItem";

/**
 * TaskDrawer component
 *
 * Displays tasks for the selected day in a drawer at the bottom of the screen.
 * The drawer can be expanded or collapsed.
 *
 * @param {Object} props - Component props
 * @param {React.RefObject} props.drawerRef - Ref for the drawer element
 * @returns {JSX.Element} Rendered component
 */
const TaskDrawer = ({ drawerRef }) => {
  const handleTaskSelect = useTaskStore((state) => state.handleTaskSelect);
  const taskInstancesFromStore = useTaskStore((state) => state.taskInstances);

  const [taskInstances, setTaskInstances] = useState(taskInstancesFromStore);

  const {
    currentTime,
    selectedDay,
    drawerOpen,
    toggleDrawer,
    currentTasks,
    selectedTaskId,
  } = useCalendarStore();

  useEffect(() => {
    console.log("taskInstancesFromStore", taskInstancesFromStore);
    setTaskInstances(taskInstancesFromStore);
  }, [taskInstancesFromStore]);

  // Refs for task elements and task list
  const taskRefs = useRef({});
  const taskListRef = useRef(null);

  // State for animation
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevDay, setPrevDay] = useState(null);

  // Filter tasks for the selected day - memoize this computation
  const tasksForSelectedDay = React.useMemo(() => {
    if (!selectedDay) return [];

    // Convert provided date to YYYY-MM-DD format
    const formattedProvidedDate = dayjs(selectedDay).format("YYYY-MM-DD");

    return taskInstances.filter(
      (item) => item.scheduled_date === formattedProvidedDate
    );
    // return currentTasks.filter((task) => {
    //   const taskDate = parseISO(`${task.start_date}T${task.start_time}`);
    //   return isSameDay(taskDate, selectedDay);
    // });
  }, [selectedDay, taskInstances]);

  // Calculate minimum drawer height to show at least one task
  const minDrawerHeight = tasksForSelectedDay.length > 0 ? 220 : 200; // Higher if we have tasks

  // Scroll to selected task when it changes
  useEffect(() => {
    if (
      selectedTaskId &&
      taskRefs.current[selectedTaskId] &&
      taskListRef.current
    ) {
      const taskElement = taskRefs.current[selectedTaskId];
      const taskList = taskListRef.current;

      // Calculate scroll position to make the task visible
      const taskTop = taskElement.offsetTop;
      const taskHeight = taskElement.offsetHeight;
      const listHeight = taskList.offsetHeight;
      const scrollTop = taskList.scrollTop;

      // If task is not fully visible, scroll to it
      if (
        taskTop < scrollTop ||
        taskTop + taskHeight > scrollTop + listHeight
      ) {
        taskList.scrollTop = taskTop - listHeight / 2 + taskHeight / 2;
      }
    }
  }, [selectedTaskId, drawerOpen]);

  // Handle day change animation - fix the double fade issue
  useEffect(() => {
    // Only animate if we have a previous day and it's different from the current one
    if (prevDay && selectedDay && !isSameDay(prevDay, selectedDay)) {
      // Start animation
      setIsAnimating(true);

      // Reset animation after it completes
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 300);

      return () => clearTimeout(timer);
    }

    // Update the previous day reference
    setPrevDay(selectedDay);
  }, [selectedDay]);

  return (
    <div
      ref={drawerRef}
      className={`fixed left-0 right-0 bottom-0 bg-zinc-900 rounded-t-lg shadow-lg transition-all duration-300 ease-in-out`}
      style={{
        height: drawerOpen ? "66.67%" : `${minDrawerHeight}px`,
      }}
    >
      <div className="p-4">
        {/* Drawer header with title and toggle button */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            {selectedDay ? dayjs(selectedDay).format("dddd, MMMM D") : "Tasks"}
          </h2>
          <button
            onClick={toggleDrawer}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors duration-200 cursor-pointer"
            aria-label={drawerOpen ? "Collapse drawer" : "Expand drawer"}
          >
            {drawerOpen ? (
              <ChevronDown className="w-6 h-6" />
            ) : (
              <ChevronUp className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Task list with animation */}
        {selectedDay && (
          <div
            ref={taskListRef}
            className={`mt-4 space-y-4 overflow-y-auto transition-opacity duration-300 ${isAnimating ? "opacity-0" : "opacity-100"}`}
            style={{ maxHeight: "calc(100% - 60px)" }}
          >
            {tasksForSelectedDay.length === 0 ? (
              <div className="text-gray-400 text-center py-4">
                No tasks scheduled for this day.
              </div>
            ) : (
              tasksForSelectedDay.map((task) => {
                const startTime = dayjs(
                  `${task.start_date}T${task.start_time}`
                );
                const endTime = startTime.add(task.duration_minutes, "minute");
                const isInFuture = isAfter(startTime, currentTime);
                const isSelected = task.id === selectedTaskId;

                return (
                  <TaskItem
                    key={task.id}
                    ref={(el) => (taskRefs.current[task.id] = el)}
                    task={task}
                    isSelected={isSelected}
                    isInFuture={isInFuture}
                    startTime={startTime}
                    endTime={endTime}
                    onClick={() => handleTaskSelect(task)}
                  />
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(TaskDrawer);
