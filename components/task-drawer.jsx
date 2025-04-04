"use client";

import React, { useRef, useEffect, useState, memo, useMemo } from "react"; // Added useMemo
import { useTaskStore } from "@/app/stores/useTaskStore"; // Use the *new* store

import { calculateInstancesForRange } from "@/lib/taskCalculator"; // Adjust path

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore"; // For isInFuture check
import isSameOrAfter from "dayjs/plugin/isSameOrAfter"; // For isInFuture check (or just use isAfter if preferred)

import { shallow } from "zustand/shallow";

// ****** OPTIONAL: Import icons from lucide-react ******
import {
  ChevronUp,
  ChevronDown,
  AlarmClock, // Assuming Clock might be used as default later
  Moon,
  Dumbbell,
  Clock, // Default icon maybe?
  Check, // For completed status visually?
} from "lucide-react";

// ****** CHANGE: Assumed useCalendarStore provides these ******
// You might want to consolidate date/time state into useTaskStore eventually
import useCalendarStore from "@/app/stores/useCalendarStore";

// Extend Dayjs with necessary plugins (Best practice: centralize this)
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

// ****** CHANGE: Task Icon based on *parent* task type if available ******
// This function might need adjustment based on where 'type' is stored (parent task vs. exception)
const getTaskIcon = (instance) => {
  // TODO: Need access to parent task type. This might require modifying
  // calculateInstancesForRange to include the parent task's type/color,
  // or fetching the parent task definition based on instance.task_id.
  // For now, using a placeholder or assuming 'type' is added to CalculatedInstance.
  const type = instance?.type || "default"; // Assuming 'type' might be on the instance
  const sizeClass = "w-5 h-5"; // Consistent size

  switch (type) {
    case "alarm":
      return <AlarmClock className={sizeClass} />;
    case "workout":
      return <Dumbbell className={sizeClass} />;
    case "night":
      return <Moon className={sizeClass} />;
    default:
      return <Clock className={sizeClass} />; // Default icon
  }
};

// ****** CHANGE: Refactored DrawerTaskItem for CalculatedInstance ******
const DrawerTaskItem = memo(({ instance, isSelected, onClick }) => {
  // instance is now a CalculatedInstance object

  // Check completion status directly from the calculated instance
  const isCompleted = instance.is_complete;

  // ****** CHANGE: Format time range using scheduled_time_utc and duration ******
  const formatTimeRange = (inst) => {
    if (
      !inst?.scheduled_time_utc ||
      !inst?.duration_minutes ||
      !inst?.timezone
    ) {
      return "Time N/A"; // Handle missing data
    }
    // Convert UTC scheduled time to the task's original timezone for display
    const startTimeLocal = dayjs.utc(inst.scheduled_time_utc).tz(inst.timezone);
    const endTimeLocal = startTimeLocal.add(inst.duration_minutes, "minute");

    // Check if conversion was successful
    if (!startTimeLocal.isValid() || !endTimeLocal.isValid()) {
      return "Invalid Time";
    }

    return `${startTimeLocal.format("h:mm A")} – ${endTimeLocal.format("h:mm A")}`;
  };

  // ****** CHANGE: Determine if instance start is in the future ******
  // Compare scheduled_time_utc with the current time (also in UTC)
  // Assume `currentTime` from useCalendarStore is a Date object or similar
  const currentTime = useCalendarStore((state) => state.currentTime); // Get current time
  const isInFuture = dayjs
    .utc(instance.scheduled_time_utc)
    .isAfter(dayjs(currentTime));

  // ****** CHANGE: Determine background color ******
  // TODO: Need access to parent task color, similar to 'type'.
  // Assuming 'color' might be added to CalculatedInstance.
  const bgColor = isCompleted
    ? "bg-green-600/30" // Muted green for completed
    : isInFuture
      ? "bg-gray-700/50" // Gray for future
      : instance?.color === "pink"
        ? "bg-pink-500/80"
        : "bg-blue-500/80"; // Use instance color or default

  return (
    <div
      className={`flex items-start space-x-3 sm:space-x-4 cursor-pointer hover:bg-zinc-700/50 p-2 rounded-lg transition-colors duration-150 ${
        isSelected ? "bg-indigo-600/30 ring-1 ring-indigo-500" : "" // Highlight selection
      }`}
      onClick={onClick}
      id={`taskInstance-${instance.id}`} // Use the unique calculated instance ID
    >
      {/* Task icon container */}
      <div
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg ${bgColor} flex items-center justify-center text-white flex-shrink-0 mt-0.5`}
      >
        {getTaskIcon(instance)}
      </div>

      {/* Task details */}
      <div className={`flex-grow min-w-0 ${isCompleted ? "opacity-60" : ""}`}>
        <div className="font-medium text-sm sm:text-base text-gray-100 flex items-center">
          {/* Use title from calculated instance (could be overridden) */}
          <span className="truncate pr-2">{instance.title}</span>
          {/* Use isCompleted from instance */}
          {isCompleted && (
            <span className="ml-auto text-xs bg-green-500/80 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">
              Done
            </span>
          )}
        </div>
        <div className="text-xs sm:text-sm text-gray-400 mt-0.5">
          {formatTimeRange(instance)}
        </div>
      </div>
    </div>
  );
});
DrawerTaskItem.displayName = "DrawerTaskItem"; // Keep display name

/**
 * TaskDrawer component (Refactored for new store/schema)
 */
const TaskDrawer = ({ drawerRef }) => {
  // Get UI state from Calendar store (assuming it still manages these)
  const { currentTime, drawerOpen, selectedDay, toggleDrawer } =
    useCalendarStore();

  const tasks = useTaskStore((state) => state.tasks);
  const exceptions = useTaskStore((state) => state.exceptions);
  const selectedDate = useTaskStore((state) => state.selectedDate);
  const selectedInstance = useTaskStore((state) => state.selectedInstance);
  const openTaskMenu = useTaskStore((state) => state.openTaskMenu);
  const isLoading = useTaskStore((state) => state.isLoading);
  // ****** REMOVED: selectedTaskId, taskInstances ******

  const [isAnimating, setIsAnimating] = useState(false);
  const [prevDay, setPrevDay] = useState(null);
  const taskListRef = useRef(null); // Keep ref for scrolling

  // ****** CHANGE: Calculate instances for the selected day ******
  const tasksForSelectedDay = useMemo(() => {
    if (!selectedDay || !tasks) return [];
    const dayStart = dayjs(selectedDay).startOf("day").toISOString();
    const dayEnd = dayjs(selectedDay).endOf("day").toISOString();
    try {
      return calculateInstancesForRange(tasks, exceptions, dayStart, dayEnd);
    } catch (error) {
      console.error("TaskDrawer: Error calculating instances:", error);
      return [];
    }
  }, [selectedDay, tasks, exceptions]); // Dependencies

  // Determine drawer height (keep original logic, maybe adjust numbers)
  const minDrawerHeight = tasksForSelectedDay.length > 0 ? 180 : 160; // Slightly smaller min height?
  const bottomNavHeight = 64; // Assuming h-16 is bottom nav height in px
  const expandedDrawerHeight = `calc(75vh - ${bottomNavHeight}px)`; // Use vh for expanded height

  // ****** CHANGE: Scroll logic needs update ******
  useEffect(() => {
    // Scroll to the *selectedInstance* when the drawer opens or instance changes
    if (selectedInstance && drawerOpen && taskListRef.current) {
      // ID is now potentially taskId-timestamp or exceptionId
      const targetElementId = `taskInstance-${selectedInstance.id}`;
      // Use setTimeout to allow DOM updates after selection/open
      setTimeout(() => {
        const taskElement = document.getElementById(targetElementId);
        if (taskElement && taskListRef.current) {
          // Calculate desired scroll position (element top - some offset)
          const listTop = taskListRef.current.offsetTop; // Or bounding rect top
          const elementTop = taskElement.offsetTop;
          const desiredScrollTop = elementTop - listTop - 10; // Adjust offset as needed

          taskListRef.current.scrollTo({
            top: Math.max(0, desiredScrollTop), // Ensure not scrolling negative
            behavior: "smooth",
          });
          console.log(
            `Scrolling to ${targetElementId} at top: ${desiredScrollTop}`
          );
        } else {
          console.log(`Scroll target not found: #${targetElementId}`);
        }
      }, 150); // Delay allows rendering and state updates
    }
    // Note: Scrolling based on day *change* animation might conflict.
    // Consider if scrolling is needed on day change or only on selection.
  }, [selectedInstance, drawerOpen]); // Trigger scroll on selection or drawer opening

  // Handle day change animation (keep original logic)
  useEffect(() => {
    if (prevDay && selectedDay && !dayjs(prevDay).isSame(selectedDay, "day")) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 300); // Animation duration
      return () => clearTimeout(timer);
    }
    setPrevDay(selectedDay);
  }, [selectedDay, prevDay]); // Keep prevDay dependency

  return (
    <div
      ref={drawerRef}
      // ****** CHANGE: Simpler positioning, relies on parent context potentially ******
      // If this is directly in body, fixed positioning is fine. Adjust if nested.
      // Using Tailwind for positioning and sizing.
      className="fixed bottom-0 left-0 right-0 w-full md:left-auto md:right-4 z-30 bg-zinc-900 border border-gray-700/50 rounded-t-2xl md:rounded-xl shadow-2xl transition-all duration-300 ease-out" // Responsive width/rounding
      style={{
        // Use max-height and dynamic height
        height: drawerOpen ? expandedDrawerHeight : `${minDrawerHeight}px`,
        // Max height prevents overlap with potential top nav
        maxHeight: `calc(90vh - ${bottomNavHeight}px)`,
        // Apply transform for animation if needed, but height transition might suffice
        // transform: drawerOpen ? 'translateY(0)' : `translateY(calc(100% - ${minDrawerHeight}px - ${bottomNavHeight}px))`, // Alternative animation
      }}
    >
      <div className="flex flex-col h-full rounded-t-xl md:rounded-xl overflow-hidden">
        {" "}
        {/* Ensure overflow hidden */}
        {/* Drawer header */}
        <div className="p-3 sm:p-4 flex justify-between items-center flex-shrink-0 border-b border-gray-700/50 bg-zinc-900/80 backdrop-blur-sm">
          {" "}
          {/* Sticky header style */}
          <h2 className="text-base sm:text-lg font-semibold text-gray-100">
            {selectedDay ? dayjs(selectedDay).format("ddd, MMM D") : "Tasks"}
          </h2>
          <button
            onClick={toggleDrawer}
            className="p-1.5 hover:bg-zinc-700/60 rounded-full transition-colors text-gray-400 hover:text-white"
            aria-label={drawerOpen ? "Collapse drawer" : "Expand drawer"}
          >
            {drawerOpen ? (
              <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </button>
        </div>
        {/* Task list */}
        {selectedDay && (
          //  className={`overflow-y-auto flex-grow transition-opacity duration-300 ${
          //   isAnimating ? "opacity-0" : "opacity-100"
          // }`}
          <div
            ref={taskListRef}
            className={`overflow-y-auto flex-grow`}
            // Add padding inside the scrollable area
            style={{ padding: "8px 16px 16px 16px" }} // p-4 equivalent but avoids header padding
          >
            {/* Display loading state */}
            {isLoading && tasksForSelectedDay.length === 0 && (
              <div className="text-gray-500 text-center py-6 text-sm">
                Loading tasks...
              </div>
            )}
            {/* Display no tasks message */}
            {!isLoading && tasksForSelectedDay.length === 0 && (
              <div className="text-gray-500 text-center py-6 text-sm">
                No tasks scheduled for this day.
              </div>
            )}
            {/* Render Task Items */}
            {tasksForSelectedDay.length > 0 && (
              <div className="space-y-2 sm:space-y-3">
                {" "}
                {/* Add spacing between items */}
                {tasksForSelectedDay.map((instance) => (
                  <DrawerTaskItem
                    key={instance.id} // Use calculated instance unique ID
                    instance={instance} // Pass the calculated instance
                    isSelected={selectedInstance?.id === instance.id} // Compare selected instance ID
                    onClick={() => openTaskMenu(instance)} // Pass calculated instance
                  />
                ))}
              </div>
            )}
            {/* Extra space at bottom for scroll */}
            <div className="h-8"></div>
          </div>
        )}
      </div>
      {/* Action Menu is likely triggered elsewhere now, or positioned differently */}
      {/* <TaskActionMenu /> */}
    </div>
  );
};

// Use memo if performance requires it, but ensure props are stable
export default memo(TaskDrawer);
