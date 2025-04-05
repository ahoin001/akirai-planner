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
import { useRef, useState, useCallback, memo, useMemo } from "react";

import { BottomNavigation } from "@/components/bottom-navigation";
import TaskActionMenu from "@/components/task-action-menu";
import TaskDrawer from "@/components/task-drawer";
import { TaskForm } from "@/components/task-form";
import WeekHeader from "@/components/week-header";
import WeekNavigation from "@/components/week-navigation";
import WeekTimeline from "@/components/week-timeline";

/**
 * VerticalGanttChart component
 *
 * The main component that orchestrates the entire calendar view.
 * Manages layout, scrolling, and component coordination.
 *
 * @returns {JSX.Element} Rendered component
 */
const VerticalGanttChart = () => {
  const {
    closeTaskForm,
    isEditingTask,
    isTaskFormOpen,
    openTaskForm,
    setTaskForm,
    taskFormValues,
    taskInstances,
  } = useTaskStore();

  const {
    currentWeekStart,
    getWeekDays,
    selectedDay,
    slideDirection,
    navigateToDate,
  } = useCalendarStore();

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerFor, setDatePickerFor] = useState(null);

  // Refs for DOM elements
  const timelineRef = useRef(null);
  const containerRef = useRef(null);
  const drawerRef = useRef(null);

  const weekDays = useMemo(() => getWeekDays(), [getWeekDays]);

  const handleHeaderClick = useCallback((date) => {
    setDatePickerFor(date);
    setDatePickerOpen(true);
  }, []);

  const handleCloseDatePicker = useCallback(() => {
    setDatePickerOpen(false);
  }, []);

  const handleDateSelect = useCallback(
    (date) => {
      navigateToDate(date);
      setDatePickerOpen(false);
    },
    [navigateToDate]
  );

  return (
    <div className="w-full flex flex-col h-screen bg-background text-white p-4">
      <div className="flex-none">
        <span
          className="text-4xl font-bold mb-6 hover:cursor-pointer"
          onClick={handleHeaderClick}
        >
          {format(currentWeekStart, "MMMM")}{" "}
          <span className="text-pink-500">
            {format(currentWeekStart, "yyyy")}
          </span>
        </span>

        <WeekNavigation />

        <div className="relative overflow-hidden">
          <WeekHeader weekDays={weekDays} />
        </div>
      </div>
      {/* Scrollable timeline container */}
      <div ref={containerRef} className="flex-grow overflow-hidden pb-[260px]">
        <div
          ref={timelineRef}
          className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
        >
          <div className="relative">
            {/* Current week timeline */}
            <div
              className={`transition-transform duration-300 ease-in-out transform ${
                slideDirection === "left"
                  ? "-translate-x-full"
                  : slideDirection === "right"
                    ? "translate-x-full"
                    : ""
              }`}
            >
              <WeekTimeline
                weekStart={currentWeekStart}
                tasks={taskInstances}
                days={weekDays}
              />
            </div>
          </div>
        </div>
      </div>

      <TaskDrawer drawerRef={drawerRef} />

      <TaskActionMenu />

      <BottomNavigation />

      <TaskForm
        isEditing={isEditingTask}
        initialValues={taskFormValues}
        isOpen={isTaskFormOpen}
        onClose={closeTaskForm}
        onOpenChange={setTaskForm}
        selectedDate={selectedDay}
      />

      <FloatingActionButton onClick={openTaskForm} />

      <DatePicker
        isOpen={datePickerOpen}
        onClose={handleCloseDatePicker}
        onSelect={handleDateSelect}
        selectedDate={datePickerFor}
      />
    </div>
  );
};

export default memo(VerticalGanttChart);

import { Plus } from "lucide-react";
import DatePicker from "./date-picker";

const FloatingActionButton = memo(({ onClick }) => (
  <button
    className="fixed right-6 bottom-20 z-50 w-14 h-14 bg-pink-500 rounded-full flex items-center justify-center shadow-lg hover:bg-pink-600 transition-colors"
    onClick={onClick}
    aria-label="Create new task"
  >
    <Plus className="w-8 h-8 text-white" />
  </button>
));

FloatingActionButton.displayName = "FloatingActionButton";
