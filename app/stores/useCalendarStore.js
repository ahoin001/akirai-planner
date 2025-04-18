/**
 * Calendar Store using Zustand
 *
 * This store manages all state related to the calendar, including:
 * - Current time and date tracking
 * - Week navigation and transitions
 * - UI state (drawer, animations, etc.)
 *
 * The store provides actions for interacting with the calendar and computed
 * values for derived state.
 */
import dayjs from "dayjs";

import { create } from "zustand";
import { isSameDay, addDays, startOfWeek, addWeeks, getDay } from "date-fns";

/**
 * Calendar store with Zustand
 * Manages all state and actions for the calendar application
 */
const useCalendarStore = create((set, get) => ({
  // Time and date state
  currentTime: new Date(),
  currentWeekStart: startOfWeek(new Date()),

  // UI state
  drawerOpen: false,
  isLoading: false,
  selectedDay: new Date(),
  slideDirection: null,

  /**
   * Updates the current time (called every second)
   */
  updateCurrentTime: () => set({ currentTime: new Date() }),

  // ******************
  // * SETTERS
  // ******************
  /**
   * Selects a day and sets the selected task ID to null
   * @param {Date} day - The day to select
   */
  selectDay: (day) =>
    set({
      selectedDay: day,
      selectedTaskId: null,
    }),

  setIsLoading: (isLoading) => set({ isLoading }),

  /**
   * Toggles the drawer open/closed state
   */
  toggleDrawer: () =>
    set((state) => ({
      drawerOpen: !state.drawerOpen,
    })),

  // ******************
  // * HELPERS FOR CALENDAR SHEET
  // ******************

  selectedDate: new Date(),
  currentMonth: new Date(),
  isWheelOpen: false,
  setSelectedDate: (date) => set({ selectedDate: date }),
  setCurrentMonth: (date) => set({ currentMonth: date }),
  setWheelOpen: (open) => set({ isWheelOpen: open }),

  // ******************
  // * HELPERS
  // ******************

  /**
   * Changes the current week
   * @param {string} direction - Direction to change ('prev' or 'next')
   */
  changeWeek: (direction) => {
    const { currentWeekStart, selectedDay } = get();

    // Get the day of week of the currently selected day (0 = Sunday, 6 = Saturday)
    const selectedDayOfWeek = getDay(selectedDay);

    // Calculate the new week start
    const newWeekStart = addWeeks(
      currentWeekStart,
      direction === "prev" ? -1 : 1
    );

    // Calculate the same day of week in the new week
    const newSelectedDay = addDays(newWeekStart, selectedDayOfWeek);

    set({
      slideDirection: direction === "prev" ? "right" : "left",
    });

    // Complete the transition after animation
    setTimeout(() => {
      set({
        currentWeekStart: newWeekStart,
        slideDirection: null,
        selectedDay: newSelectedDay, // Set the same day of week in the new week
      });
    }, 300);
  },

  /**
   * Navigates to a specific date by setting the current week to the week containing that date
   * @param {Date} date - The date to navigate to
   */
  navigateToDate: (date) => {
    const { currentWeekStart } = get();

    // Get the start of the week containing the selected date
    const targetWeekStart = startOfWeek(date);

    // If we're already on this week, just select the day
    if (isSameDay(targetWeekStart, currentWeekStart)) {
      set({ selectedDay: date });
      return;
    }

    // Determine if we're going forward or backward
    const isForward = targetWeekStart > currentWeekStart;

    set({
      slideDirection: isForward ? "left" : "right",
      selectedDay: date,
    });

    // Complete the transition after animation
    setTimeout(() => {
      set({
        currentWeekStart: targetWeekStart,
        nextTasks: [],
        slideDirection: null,
      });
    }, 300);
  },

  /**
   * Gets the days of the current week
   * @returns {Array} Array of Date objects for each day of the current week
   */
  getWeekDays: () => {
    const { currentWeekStart } = get();
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  },

  // TODO Verify is working and used
  /**
   * Calculates the progress percentage of a specific task occurrence (instance).
   * @param {CalculatedInstance} instance - The calculated task instance object.
   * @param {Date} currentTime - The current time (as a Date object or compatible).
   * @returns {number} Progress percentage (0-100), clamped. Returns 0 if instance data is invalid.
   */
  getTaskProgress: (instance, currentTime) => {
    // Validate input
    if (
      !instance ||
      !instance.scheduled_time_utc ||
      !instance.duration_minutes ||
      !currentTime
    ) {
      console.warn(
        "getTaskProgress: Invalid instance or currentTime provided",
        { instance, currentTime }
      );
      return 0; // Cannot calculate progress without valid data
    }

    // Use dayjs with UTC plugin for accurate time manipulation
    const now = dayjs.utc(currentTime); // Ensure current time is treated as UTC for comparison
    const startTime = dayjs.utc(instance.scheduled_time_utc); // Start time is already UTC

    // Check if start time is valid
    if (!startTime.isValid()) {
      console.warn(
        "getTaskProgress: Invalid scheduled_time_utc for instance:",
        instance.id,
        instance.scheduled_time_utc
      );
      return 0;
    }

    // Calculate end time by adding duration to the UTC start time
    const endTime = startTime.add(instance.duration_minutes, "minute");

    // --- Determine Progress ---

    // 1. If current time is before the instance starts: Progress is 0%
    if (now.isBefore(startTime)) {
      return 0;
    }

    // 2. If current time is after the instance ends: Progress is 100%
    if (now.isSameOrAfter(endTime)) {
      // Use isSameOrAfter to include the exact end time as 100%
      return 100;
    }

    // 3. If current time is during the instance: Calculate percentage
    const totalDuration = endTime.diff(startTime, "minute"); // Total duration in minutes
    // Ensure totalDuration is not zero to avoid division by zero
    if (totalDuration <= 0) {
      return 100; // If duration is 0 or negative, consider it instantly complete if current time is >= start time
    }

    const elapsedDuration = now.diff(startTime, "minute"); // Elapsed duration in minutes

    const progress = (elapsedDuration / totalDuration) * 100;

    // Clamp the result between 0 and 100 just in case of floating point issues
    return Math.min(100, Math.max(0, progress));
  },
}));

export default useCalendarStore;
