"use client";

import { isAfter, isSameDay } from "date-fns";

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
const DrawerTaskItem = memo(({ task, isSelected, isInFuture, onClick }) => {
  const isCompleted = task.is_complete;

  // Format time range
  const formatTimeRange = (task) => {
    const startTime = dayjs(`2000-01-01T${task.start_time}`);
    const endTime = startTime.add(task.duration_minutes, "minute");

    return `${startTime.format("h:mm A")} – ${endTime.format("h:mm A")}`;
  };

  return (
    <div
      className={`flex items-center space-x-4 cursor-pointer hover:bg-zinc-800 p-2 rounded-lg transition-colors
      ${isSelected ? "bg-gray-700" : ""}`}
      onClick={onClick}
      id={`task-${task.id}`} // Add id for easier reference
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
});

DrawerTaskItem.displayName = "DrawerTaskItem";

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
  const { currentTime, drawerOpen, selectedDay, toggleDrawer } =
    useCalendarStore();

  const { handleTaskSelect, selectedTaskId, taskInstances } = useTaskStore();

  const [isAnimating, setIsAnimating] = useState(false);
  const [prevDay, setPrevDay] = useState(null);

  // Ref for task list
  const taskListRef = useRef(null);

  const tasksForSelectedDay = React.useMemo(() => {
    if (!selectedDay) return [];

    const formattedProvidedDate = dayjs(selectedDay).format("YYYY-MM-DD");

    return taskInstances.filter(
      (item) => item.scheduled_date === formattedProvidedDate
    );
  }, [selectedDay, taskInstances]);

  // Determine drawer height to show at least one task of space
  const minDrawerHeight = tasksForSelectedDay.length > 0 ? 220 : 200;

  // Account for bottom nav height (h-16 = 64px)
  const bottomNavHeight = 1;

  // Calculate expanded drawer height (account for bottom nav)
  const expandedDrawerHeight = `calc(66.67% - ${bottomNavHeight}px)`;

  // Scroll to selected task when it changes
  useEffect(() => {
    if (selectedTaskId && taskListRef.current) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        const taskElement = document.getElementById(`task-${selectedTaskId}`);

        if (taskElement && taskListRef.current) {
          // Scroll the task into view with padding
          taskElement.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });

          // Add additional offset if needed
          const currentScroll = taskListRef.current.scrollTop;
          const elementPosition = taskElement.offsetTop;
          const scrollPosition = elementPosition - 105; // Add some padding

          taskListRef.current.scrollTo({
            top: scrollPosition,
            behavior: "smooth",
          });
        }
      }, 100);
    }
  }, [selectedTaskId, drawerOpen]);

  // Handle day change animation
  useEffect(() => {
    if (prevDay && selectedDay && !isSameDay(prevDay, selectedDay)) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
    setPrevDay(selectedDay);
  }, [selectedDay]);

  return (
    <div
      ref={drawerRef}
      className="fixed left-1/2 transform -translate-x-1/2 bottom-5 bg-drawer rounded-t-3xl shadow-lg transition-all duration-300 ease-in-out"
      style={{
        width: "85vw",
        height: drawerOpen ? expandedDrawerHeight : `${minDrawerHeight}px`,
        maxHeight: `calc(100vh - ${bottomNavHeight}px)`,
      }}
    >
      <div className="flex flex-col h-full rounded-t-xl">
        {/* Drawer header with title and toggle button */}
        <div className="p-4 flex justify-between items-center sticky top-0 bg-drawer rounded-[80px]  z-10">
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
            className={`px-4 space-y-4 overflow-y-auto transition-opacity duration-300 flex-grow ${
              isAnimating ? "opacity-0" : "opacity-100"
            }`}
            style={{
              overflowY: "auto",
              WebkitOverflowScrolling: "touch", // Better scrolling on iOS
              paddingBottom: "20px", // Add extra padding at bottom
            }}
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
                const isInFuture = isAfter(startTime.toDate(), currentTime);
                const isSelected = task.id === selectedTaskId;

                return (
                  <DrawerTaskItem
                    key={task.id}
                    task={task}
                    isSelected={isSelected}
                    isInFuture={isInFuture}
                    onClick={() => handleTaskSelect(task)}
                  />
                );
              })
            )}

            {/* Add extra space at bottom for better scrolling */}
            <div className="h-8"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(TaskDrawer);
