/**
 * Calendar Store using Zustand
 *
 * This store manages all state related to the calendar, including:
 * - Current time and date tracking
 * - Week navigation and transitions
 * - Task management and filtering
 * - UI state (drawer, animations, etc.)
 *
 * The store provides actions for interacting with the calendar and computed
 * values for derived state.
 */
import dayjs from "dayjs";

import { create } from "zustand";
import {
  format,
  parseISO,
  differenceInMinutes,
  isBefore,
  isAfter,
  isSameDay,
  addDays,
  startOfWeek,
  addWeeks,
  getWeek,
  setHours,
  setMinutes,
  getDay,
} from "date-fns";

/**
 * Generates tasks for a given week
 *
 * @param {Date} baseDate - The start date of the week
 * @returns {Array} Array of task objects
 */
const generateTasks = (baseDate) => {
  const weekNumber = getWeek(baseDate);
  const isEvenWeek = weekNumber % 2 === 0;

  return [
    // Morning tasks
    ...Array.from({ length: isEvenWeek ? 3 : 4 }, (_, i) => {
      const taskDate = addDays(baseDate, i);
      return {
        id: weekNumber * 100 + i,
        title: "Rise and Shine",
        start_date: format(taskDate, "yyyy-MM-dd"),
        start_time: "08:00",
        duration_minutes: 30, // 30 minutes
        type: "alarm",
        color: "pink",
        is_complete: false,
      };
    }),
    // Workout tasks
    ...Array.from({ length: isEvenWeek ? 4 : 3 }, (_, i) => {
      const taskDate = addDays(baseDate, i + 2);
      return {
        id: weekNumber * 100 + 10 + i,
        title: "Daily Workout",
        start_date: format(taskDate, "yyyy-MM-dd"),
        start_time: "16:00",
        duration_minutes: 60, // 60 minutes
        type: "workout",
        color: "pink",
        is_complete: false,
      };
    }),
    // Add some random tasks with varying durations
    ...Array.from({ length: 3 }, (_, i) => {
      const dayOffset = Math.floor(Math.random() * 7);
      const taskDate = addDays(baseDate, dayOffset);
      const hour = 10 + Math.floor(Math.random() * 6); // Random hour between 10 AM and 3 PM
      const minutes = Math.floor(Math.random() * 4) * 15; // Random minutes: 0, 15, 30, or 45
      const duration = 10 + Math.floor(Math.random() * 12) * 10; // Random duration between 10 and 120 minutes

      return {
        id: weekNumber * 100 + 20 + i,
        title: `Task ${i + 1}`,
        start_date: format(taskDate, "yyyy-MM-dd"),
        start_time: `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`,
        duration_minutes: duration,
        type: i % 2 === 0 ? "alarm" : "workout",
        color: "pink",
        is_complete: false,
      };
    }),
  ];
};

/**
 * Calendar store with Zustand
 * Manages all state and actions for the calendar application
 */
const useCalendarStore = create((set, get) => ({
  // Time and date state
  currentTime: new Date(),
  currentWeekStart: startOfWeek(new Date()),
  nextWeekStart: null,

  // Tasks state
  currentTasks: [],
  nextTasks: [],
  selectedTaskId: null,
  taskInstances: [],

  // UI state
  drawerOpen: false,
  isLoading: false,
  isTransitioning: false,
  isTaskMenuOpen: false,
  selectedDay: new Date(),
  slideDirection: null,

  // Task form state
  isTaskFormOpen: false,
  isEditingTask: false,
  taskFormValues: {},

  /**
   * Updates the current time (called every second)
   */
  updateCurrentTime: () => set({ currentTime: new Date() }),

  /**
   * Selects a day and sets the selected task ID to null
   * @param {Date} day - The day to select
   */
  selectDay: (day) =>
    set({
      selectedDay: day,
      selectedTaskId: null,
    }),

  /**
   * Sets the selected task ID
   * @param {number} taskId - The ID of the selected task
   */
  setSelectedTaskId: (taskId) =>
    set({
      selectedTaskId: taskId,
      isTaskMenuOpen: true,
    }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setTaskInstances: (tasks) => set({ taskInstances: tasks }),

  /**
   * Opens the task action menu
   */
  openTaskMenu: () => set({ isTaskMenuOpen: true }),

  /**
   * Closes the task action menu
   */
  closeTaskMenu: () => set({ isTaskMenuOpen: false }),

  /**
   * Toggles the drawer open/closed state
   */
  toggleDrawer: () =>
    set((state) => ({
      drawerOpen: !state.drawerOpen,
    })),

  /**
   * Changes the current week
   * @param {string} direction - Direction to change ('prev' or 'next')
   */
  changeWeek: (direction) => {
    const { currentWeekStart, isTransitioning, selectedDay } = get();

    if (isTransitioning) return;

    // Get the day of week of the currently selected day (0 = Sunday, 6 = Saturday)
    const selectedDayOfWeek = getDay(selectedDay);

    // Calculate the new week start
    const newWeekStart = addWeeks(
      currentWeekStart,
      direction === "prev" ? -1 : 1
    );

    // Calculate the same day of week in the new week
    const newSelectedDay = addDays(newWeekStart, selectedDayOfWeek);

    const newTasks = generateTasks(newWeekStart);

    set({
      nextWeekStart: newWeekStart,
      nextTasks: newTasks,
      slideDirection: direction === "prev" ? "right" : "left",
      isTransitioning: true,
    });

    // Complete the transition after animation
    setTimeout(() => {
      set({
        currentWeekStart: newWeekStart,
        currentTasks: newTasks,
        nextWeekStart: null,
        nextTasks: [],
        slideDirection: null,
        isTransitioning: false,
        selectedDay: newSelectedDay, // Set the same day of week in the new week
      });
    }, 300);
  },

  /**
   * Navigates to a specific date by setting the current week to the week containing that date
   * @param {Date} date - The date to navigate to
   */
  navigateToDate: (date) => {
    const { currentWeekStart, isTransitioning } = get();

    if (isTransitioning) return;

    // Get the start of the week containing the selected date
    const targetWeekStart = startOfWeek(date);

    // If we're already on this week, just select the day
    if (isSameDay(targetWeekStart, currentWeekStart)) {
      set({ selectedDay: date });
      return;
    }

    // Determine if we're going forward or backward
    const isForward = targetWeekStart > currentWeekStart;
    const newTasks = generateTasks(targetWeekStart);

    set({
      nextWeekStart: targetWeekStart,
      nextTasks: newTasks,
      slideDirection: isForward ? "left" : "right",
      isTransitioning: true,
      selectedDay: date,
    });

    // Complete the transition after animation
    setTimeout(() => {
      set({
        currentWeekStart: targetWeekStart,
        currentTasks: newTasks,
        nextWeekStart: null,
        nextTasks: [],
        slideDirection: null,
        isTransitioning: false,
      });
    }, 300);
  },

  /**
   * Marks a task as complete
   * @param {number} taskId - The ID of the task to complete
   */
  completeTask: (taskId) => {
    set((state) => ({
      currentTasks: state.currentTasks.map((task) =>
        task.id === taskId ? { ...task, is_complete: true } : task
      ),
    }));
  },

  /**
   * Deletes a task
   * @param {number} taskId - The ID of the task to delete
   */
  deleteTask: (taskId) => {
    set((state) => ({
      currentTasks: state.currentTasks.filter((task) => task.id !== taskId),
      selectedTaskId: null,
    }));
  },

  /**
   * Gets the days of the current week
   * @returns {Array} Array of Date objects for each day of the current week
   */
  getWeekDays: () => {
    const { currentWeekStart } = get();
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  },

  /**
   * Gets the days of the next week (during transition)
   * @returns {Array} Array of Date objects for each day of the next week
   */
  getNextWeekDays: () => {
    const { nextWeekStart } = get();
    if (!nextWeekStart) return [];
    return Array.from({ length: 7 }, (_, i) => addDays(nextWeekStart, i));
  },

  /**
   * Gets tasks for a specific day
   * @param {Date} date - The day to get tasks for
   * @returns {Array} Array of tasks for the specified day
   */
  // getTasksForDay: (date) => {
  //   const { currentTasks } = get();
  //   return currentTasks.filter((task) => {
  //     const taskDate = parseISO(`${task.start_date}T${task.start_time}`);
  //     return isSameDay(taskDate, date);
  //   });
  // },

  /**
   * Compares dates in MM-DD-YYYY format to return tasks for the specific day
   * @param {Date | string} date - The date to compare against
   * @returns {Array} Filtered tasks for the given day
   */
  getTasksForFormattedDay: (date) => {
    const { taskInstances } = get();

    // Format the passed-in date to MM-DD-YYYY
    const formattedDate = dayjs(date).format("MM-DD-YYYY");

    // Filter tasks based on scheduled_date, comparing formatted dates
    return taskInstances.filter((task) => {
      const formattedTaskDate = dayjs(task.scheduled_date).format("MM-DD-YYYY");
      return formattedTaskDate === formattedDate;
    });
  },

  /**
   * Calculates the progress percentage of a task
   * @param {Object} task - The task object
   * @returns {number} Progress percentage (0-100)
   */
  getTaskProgress: (task) => {
    const { currentTime } = get();
    const startTime = parseISO(`${task.start_date}T${task.start_time}`);
    const endTime = new Date(
      startTime.getTime() + task.duration_minutes * 60 * 1000
    );

    if (isBefore(currentTime, startTime)) return 0;
    if (isAfter(currentTime, endTime)) return 100;

    const totalDuration = differenceInMinutes(endTime, startTime);
    const elapsedDuration = differenceInMinutes(currentTime, startTime);
    return (elapsedDuration / totalDuration) * 100;
  },

  /**
   * Calculates the day progress percentage for timeline visualization
   * @param {Date} date - The day to calculate progress for
   * @returns {number} Progress percentage (0-100)
   */
  getDayProgress: (date) => {
    const { currentTime } = get();

    // For past days, return 100%
    if (isBefore(date, currentTime) && !isSameDay(date, currentTime))
      return 100;

    // For future days, return 0%
    if (!isSameDay(date, currentTime)) return 0;

    // For current day, calculate percentage through the day
    const dayStart = setHours(setMinutes(new Date(date), 0), 8); // 8 AM
    const dayEnd = setHours(setMinutes(new Date(date), 0), 23); // 11 PM

    const totalDayDuration = dayEnd.getTime() - dayStart.getTime();
    const elapsedTime = currentTime.getTime() - dayStart.getTime();

    return Math.max(0, Math.min(100, (elapsedTime / totalDayDuration) * 100));
  },

  /**
   * Opens the task form for creating a new task
   */
  openTaskForm: () =>
    set({
      isTaskFormOpen: true,
      isEditingTask: false,
      taskFormValues: {},
    }),

  /**
   * Opens the task form for editing an existing task
   * @param {number} taskId - The ID of the task to edit
   */
  editTask: (taskId) => {
    const { currentTasks } = get();
    const task = currentTasks.find((task) => task.id === taskId);

    if (task) {
      set({
        isTaskFormOpen: true,
        isEditingTask: true,
        taskFormValues: { ...task },
        isTaskMenuOpen: false, // Close the task menu
      });
    } else {
      // If task not found, still open the form but with empty values
      set({
        isTaskFormOpen: true,
        isEditingTask: false,
        taskFormValues: {},
        isTaskMenuOpen: false,
      });
    }
  },

  /**
   * Closes the task form
   */
  handleCloseTaskForm: () =>
    set({
      isTaskFormOpen: false,
    }),

  /**
   * Creates a new task
   * @param {Object} taskData - The task data
   */
  createTask: (taskData) => {
    const { currentTasks } = get();
    const newId = Math.max(0, ...currentTasks.map((task) => task.id)) + 1;

    const newTask = {
      id: newId,
      ...taskData,
    };

    set({
      currentTasks: [...currentTasks, newTask],
      selectedTaskId: newId,
    });
  },

  /**
   * Updates an existing task
   * @param {number} taskId - The ID of the task to update
   * @param {Object} updates - The updates to apply
   */
  updateTask: (taskId, updates) => {
    const { currentTasks } = get();

    const updatedTasks = currentTasks.map((task) =>
      task.id === taskId ? { ...task, ...updates } : task
    );

    set({ currentTasks: updatedTasks });
  },

  /***********
   *
   * UI HANDLERS
   *
   ************/
  handleOpenTaskForm: () => {
    const { openTaskForm } = get();
    openTaskForm();
  },
}));

export default useCalendarStore;
