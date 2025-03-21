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
import { useTaskStore } from "@/app/stores/useTaskStore";
import useCalendarStore from "@/app/stores/useCalendarStore";
import { useEffect, useRef, useState, useCallback, memo, use } from "react";

import TaskActionMenu from "@/components/task-action-menu";
import TaskDrawer from "@/components/task-drawer";
import TaskForm from "@/components/task-form";
import WeekHeader from "@/components/week-header";
import WeekNavigation from "@/components/week-navigation";

// Constants for timeline configuration
const dayStart = 8; // 8 AM
const dayEnd = 23; // 11 PM
const hourHeight = 60; // Height of one hour in pixels
const drawerMinHeight = 200; // Minimum height of the drawer when collapsed

/**
 * VerticalGanttChart component
 *
 * The main component that orchestrates the entire calendar view.
 * Manages layout, scrolling, and component coordination.
 *
 * @returns {JSX.Element} Rendered component
 */
const VerticalGanttChart = () => {
  const { isModalActive, closeModal } = useTaskStore();

  const {
    currentWeekStart,
    handleOpenTaskForm,
    handleCloseTaskForm,
    nextWeekStart,
    getWeekDays,
    getNextWeekDays,
    isEditingTask,
    isTaskFormOpen,
    taskFormValues,
  } = useCalendarStore();

  const { selectedTask, taskInstances } = useTaskStore();

  // Refs for DOM elements
  const timelineRef = useRef(null);
  const containerRef = useRef(null);
  const drawerRef = useRef(null);

  // Memoize the week days to prevent unnecessary recalculations , move to util functions
  const weekDays = useCallback(getWeekDays, [currentWeekStart])();
  const nextWeekDays = useCallback(getNextWeekDays, [nextWeekStart])();

  return (
    <div className="w-full flex flex-col h-screen bg-black text-white p-4">
      {/* Header section */}
      <div className="flex-none">
        {/* Month and year heading */}
        <h1 className="text-4xl font-bold mb-6">
          {format(currentWeekStart, "MMMM")}{" "}
          <span className="text-pink-500">
            {format(currentWeekStart, "yyyy")}
          </span>
        </h1>

        {/* Week navigation controls */}
        <WeekNavigation />

        {/* Days of week - Current Week */}
        <div className="relative overflow-hidden">
          <WeekHeader weekDays={weekDays} />

          {/* TODO May not need? */}
          {/* Next Week Header (only during transition) */}
          {/* {isTransitioning && nextWeekStart && (
            <div className="absolute top-0 left-0 right-0">
              <WeekHeader weekDays={nextWeekDays} isNext={true} />
            </div>
          )} */}
        </div>
      </div>
      {/* Scrollable timeline container */}
      <div ref={containerRef} className="flex-grow overflow-hidden">
        <div
          ref={timelineRef}
          className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
        >
          <div className="relative">
            {/* Current week timeline */}
            {/* <div
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
            </div> */}

            {/* Next week timeline */}
            {/* {isTransitioning && nextWeekStart && (
              <div
                className={`transition-transform duration-300 ease-in-out transform absolute top-0 left-0 right-0`}
                style={{
                  transform:
                    slideDirection === "left"
                      ? "translateX(100%)"
                      : "translateX(-100%)",
                }}
              >
                <WeekTimeline
                  weekStart={nextWeekStart}
                  tasks={nextTasks}
                  days={nextWeekDays}
                  isNext={true}
                />
              </div>
            )} */}
          </div>
        </div>
      </div>

      {/* Task Drawer */}
      <TaskDrawer drawerRef={drawerRef} />

      {/* Task Action Menu */}
      <TaskActionMenu />

      {/* {isModalActive("taskMenu") && selectedTask && (
        <TaskMenu
          task={selectedTask}
          onClose={closeModal}
          onEdit={handleEditTask}
        />
      )} */}

      {/* Bottom Navigation */}
      {/* <BottomNavigation /> */}

      {/* Task Form */}
      <TaskForm
        isOpen={isTaskFormOpen}
        onClose={handleCloseTaskForm}
        initialValues={taskFormValues}
        isEditing={isEditingTask}
      />

      {/* Floating Action Button */}
      <FloatingActionButton onClick={handleOpenTaskForm} />
    </div>
  );
};

export default memo(VerticalGanttChart);

/**
 * Floating action button component
 * Memoized to prevent unnecessary rerenders
 */
import { Plus } from "lucide-react";

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
