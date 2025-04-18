/**
 * VerticalGanttChart Component
 *
 * The main component that orchestrates the entire calendar view.
 * Manages layout, scrolling, and component coordination.
 *
 * @component
 */
"use client";

import { format, isSameDay } from "date-fns";
import useCalendarStore from "@/app/stores/useCalendarStore";
import { useTaskStore } from "@/app/stores/useTaskStore";
import { useRef, useState, useCallback, memo } from "react";

import { BottomNavigation } from "@/components/bottom-navigation";
import TaskActionMenu from "@/components/task-action-menu";
import TaskDrawer from "@/components/task-drawer";
import { TaskForm } from "@/components/task-form";
import WeekNavigation from "@/components/week-navigation";
import WeekView from "@/components/week-view";

/**
 * VerticalGanttChart component
 *
 * The main component that orchestrates the entire calendar view.
 * Manages layout, scrolling, and component coordination.
 *
 * @returns {JSX.Element} Rendered component
 */
const VerticalGanttChart = () => {
  const { openTaskForm } = useTaskStore();

  const {
    currentTime,
    currentWeekStart,
    drawerOpen,
    selectedDay,
    slideDirection,
    navigateToDate,
    getWeekDays,
    selectDay,
  } = useCalendarStore();

  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Refs for DOM elements
  const drawerRef = useRef(null);

  const weekDays = getWeekDays();

  const handleDateSelect = useCallback(
    (date) => {
      navigateToDate(date);
    },
    [navigateToDate]
  );

  const handleOpenTaskForm = useCallback(() => {
    openTaskForm(selectedDay);
  }, [selectedDay, openTaskForm]);

  return (
    <div className="w-full flex flex-col h-screen bg-background text-white py-4">
      <div className="flex-none">
        <DatePickerSheet
          onDateSelect={handleDateSelect}
          selectedDate={selectedDay}
        />

        <WeekNavigation />

        <div className="grid grid-rows-[auto,1fr] grid-cols-[12px_repeat(7,1fr)] gap-x-2 gap-y-2">
          <div className="contents">
            {" "}
            {/* Phantom element to maintain grid structure */}
            <div /> {/* Empty cell for time label column */}
            {weekDays.map((date, i) => (
              <DayHeader
                key={i}
                date={date}
                isSelected={isSameDay(date, selectedDay)}
                isToday={isSameDay(date, currentTime)}
                onSelect={selectDay}
              />
            ))}
          </div>
        </div>
      </div>

      <div
        className="flex-1 flex-1 overflow-y-auto relative "
        style={{
          paddingBottom: drawerOpen ? "calc(75vh - 64px)" : "270px",
        }}
      >
        <div
          className={`transition-transform duration-300 ease-in-out ${
            slideDirection === "left"
              ? "-translate-x-full"
              : slideDirection === "right"
                ? "translate-x-full"
                : ""
          }`}
        >
          <WeekView key={currentWeekStart.toISOString()} />
        </div>
      </div>

      <TaskDrawer drawerRef={drawerRef} />

      <TaskActionMenu />

      <BottomNavigation />

      <TaskForm selectedDate={selectedDay} />

      <FloatingActionButton onClick={handleOpenTaskForm} />
    </div>
  );
};

export default memo(VerticalGanttChart);

import { Plus } from "lucide-react";
import DatePickerSheet from "@/components/date-picker-sheet";

const FloatingActionButton = memo(({ onClick }) => (
  <button
    className="fixed right-3 bottom-10 z-[65] w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-primary/80 transition-colors"
    onClick={onClick}
    aria-label="Create new task"
  >
    <Plus className="w-8 h-8 text-white" />
  </button>
));

FloatingActionButton.displayName = "FloatingActionButton";

/**
 * Individual day header component
 * Memoized to prevent unnecessary rerenders
 */
const DayHeader = memo(({ date, isSelected, isToday, onSelect }) => {
  return (
    <div className="text-center relative group">
      {/* Day of week label */}
      <div className="text-gray-400 text-sm mb-2">{format(date, "EEE")}</div>

      {/* Day number with selection indicator */}
      <div
        className={`text-xl font-medium w-10 h-10 rounded-full flex items-center justify-center mx-auto cursor-pointer
            ${
              isSelected
                ? "bg-primary dark:bg-pink-500 text-white"
                : isToday
                  ? "ring-2 ring-primary text-white"
                  : "text-white"
            }`}
        onClick={() => onSelect(date)}
      >
        {format(date, "d")}
      </div>
    </div>
  );
});

DayHeader.displayName = "DayHeader";
