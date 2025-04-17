"use client";

import React, { useRef, useEffect, useState, memo, useMemo } from "react";
import { useTaskStore } from "@/app/stores/useTaskStore";

import { calculateInstancesForRange } from "@/lib/taskCalculator";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";

import { ChevronUp, ChevronDown } from "lucide-react";

import useCalendarStore from "@/app/stores/useCalendarStore";
import { getTaskIcon } from "@/lib/icons";
import TaskActionMenu from "./task-action-menu";

// Extend Dayjs with necessary plugins (Best practice: centralize this)
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

// instance is now a CalculatedInstance object
const DrawerTaskItem = memo(({ instance, isSelected, onClick }) => {
  const formatTimeRange = useTaskStore((state) => state.formatTimeRange);

  const isCompleted = instance.is_complete;

  // ****** Determine if instance start is in the future ******
  // Compare scheduled_time_utc with the current time (also in UTC)
  // Assume `currentTime` from useCalendarStore is a Date object or similar
  const currentTime = useCalendarStore((state) => state.currentTime); // Get current time
  const isInFuture = dayjs
    .utc(instance.scheduled_time_utc)
    .isAfter(dayjs(currentTime));

  // TODO: Need access to parent task color, similar to 'type'.
  // Assuming 'color' might be added to CalculatedInstance.
  const bgColor = isCompleted
    ? "bg-green-600/80" // Muted green for completed
    : isInFuture
      ? "bg-gray-700/50" // Gray for future
      : instance?.color === "pink"
        ? "bg-pink-500/80"
        : "bg-primary"; // Use instance color or default

  return (
    <div
      className={`flex items-start space-x-3 sm:space-x-4 cursor-pointer hover:bg-zinc-700/50 p-2 rounded-lg transition-colors duration-150 ${
        isSelected ? "bg-gray-600/30 ring-1 ring-gray-500" : "" // Highlight selection
      }`}
      onClick={onClick}
      id={`taskInstance-${instance.id}`} // Use the unique calculated instance ID
    >
      {/* Task icon container */}
      <div
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg ${bgColor} flex items-center justify-center text-white flex-shrink-0 mt-0.5`}
      >
        {getTaskIcon(instance.icon_name)}
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
  const { drawerOpen, selectedDay, toggleDrawer } = useCalendarStore();

  const tasks = useTaskStore((state) => state.tasks);
  const exceptions = useTaskStore((state) => state.exceptions);
  const selectedInstance = useTaskStore((state) => state.selectedInstance);
  const openTaskMenu = useTaskStore((state) => state.openTaskMenu);
  const isLoading = useTaskStore((state) => state.isLoading);

  const [isAnimating, setIsAnimating] = useState(false);
  const [prevDay, setPrevDay] = useState(null);

  const taskListRef = useRef(null);

  // ****** Might move to store: Calculate instances for the selected day ******
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
  const minDrawerHeight = tasksForSelectedDay.length > 0 ? 280 : 210; // Slightly smaller min height?
  const bottomNavHeight = 64; // Assuming h-16 is bottom nav height in px
  const expandedDrawerHeight = `calc(75vh - ${bottomNavHeight}px)`; // Use vh for expanded height

  useEffect(() => {
    if (selectedInstance && taskListRef.current) {
      const elementId = `taskInstance-${selectedInstance.id}`;
      const taskElement = document.getElementById(elementId);

      if (taskElement) {
        taskElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [selectedInstance, tasksForSelectedDay]);

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
      className="fixed bottom-0 left-0 right-0 w-[90%] mx-auto md:right-4 z-[1] bg-drawer border border-gray-700/50 rounded-t-2xl md:rounded-xl shadow-2xl transition-all duration-300 ease-out" // Responsive width/rounding
      style={{
        // Use max-height and dynamic height
        height: drawerOpen ? expandedDrawerHeight : `${minDrawerHeight}px`,
        // Max height prevents overlap with potential top nav
        maxHeight: `calc(90vh - ${bottomNavHeight}px)`,
      }}
    >
      <div className="flex flex-col h-full rounded-t-xl md:rounded-xl overflow-hidden">
        {/* Ensure overflow hidden */}
        {/* Drawer header */}
        <div className="p-3 sm:p-4 flex justify-between items-center flex-shrink-0 border-b border-gray-700/50 ">
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
          // ref={taskListRef}
          <div
            ref={taskListRef}
            className={`overflow-y-auto`}
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
              <div className="space-y-2 pb-12 sm:space-y-3">
                {" "}
                {tasksForSelectedDay.map((instance) => (
                  <div key={instance.id} id={`drawer-item-${instance.id}`}>
                    <TaskActionMenu>
                      <DrawerTaskItem
                        key={instance.id}
                        instance={instance}
                        isSelected={selectedInstance?.id === instance.id}
                        onClick={() => openTaskMenu(instance)}
                      />{" "}
                    </TaskActionMenu>
                  </div>
                ))}
              </div>
            )}
            {/* Extra space at bottom for scroll */}
            <div className="h-8"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(TaskDrawer);
