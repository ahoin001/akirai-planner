/**
 * VerticalGanttChart Component
 *
 * The main component that orchestrates the entire calendar view.
 * Manages layout, scrolling, and component coordination.
 *
 * @component
 */
"use client";

import { format } from "date-fns";
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
    currentWeekStart,
    drawerOpen,
    selectedDay,
    slideDirection,
    navigateToDate,
  } = useCalendarStore();

  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Refs for DOM elements
  const drawerRef = useRef(null);

  const handleDateSelect = useCallback(
    (date) => {
      navigateToDate(date);
    },
    [navigateToDate]
  );

  const handleHeaderClick = useCallback((date) => {
    setDatePickerOpen(true);
  }, []);

  const handleOpenTaskForm = useCallback(() => {
    openTaskForm(selectedDay);
  }, [selectedDay, openTaskForm]);

  return (
    <div className="w-full flex flex-col h-screen bg-background text-white py-4">
      <div className="flex-none">
        <span
          className="text-4xl font-bold mb-6 hover:cursor-pointer"
          onClick={handleHeaderClick}
        >
          {format(currentWeekStart, "MMMM")}{" "}
          <span className="text-primary">
            {format(currentWeekStart, "yyyy")}
          </span>
        </span>

        <WeekNavigation />
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

      {/* <DatePicker
        isOpen={datePickerOpen}
        onClose={handleCloseDatePicker}
        onSelect={handleDateSelect}
        selectedDate={datePickerFor}
      /> */}

      <DatePickerSheet
        open={datePickerOpen}
        onOpenChange={setDatePickerOpen}
        onDateSelect={handleDateSelect}
        selectedDate={selectedDay}
      />
    </div>
  );
};

export default memo(VerticalGanttChart);

import { Plus } from "lucide-react";
import DatePicker from "./date-picker";
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
