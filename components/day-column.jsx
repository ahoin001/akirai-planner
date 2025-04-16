"use client";

import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";

import { Moon } from "lucide-react";
import TaskItem from "./task-item"; // Assuming TaskItem is updated for CalculatedInstance
import useCalendarStore from "@/app/stores/useCalendarStore";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

// Constants for timeline configuration
const dayStartHour = 8; // 8 AM (0-23 range)
const dayEndHour = 23; // End of 10 PM hour (effectively up to 11 PM)
const hourHeight = 60; // Height of one hour in pixels
const totalTimelineHeight = (dayEndHour - dayStartHour) * hourHeight;

/**
 * DayColumn component (Refactored for new schema/instances)
 *
 * Renders a single day column in the timeline with hour markers,
 * vertical timeline, and tasks calculated for that day.
 *
 * @param {object} props - Component props
 * @param {Date|string} props.date - The date this column represents (local date).
 * @param {Array<CalculatedInstance>} props.tasks - Array of calculated task instances for this day.
 * @param {boolean} props.isNext - Whether this column is in the next week view (for animation).
 * @returns {JSX.Element} Rendered component
 */
export default function DayColumn({ date, tasks = [], isNext = false }) {
  // Default tasks to empty array
  // Get currentTime from store (assuming it's a Date object or similar)
  const { currentTime, updateCurrentTime } = useCalendarStore();

  // Memoize progress calculation? Maybe not needed if updated frequently anyway.
  const calculateProgress = (targetDate, now) => {
    const startOfDay = dayjs(targetDate).startOf("day").hour(dayStartHour); // Start at 8 AM
    const endOfDay = dayjs(targetDate).startOf("day").hour(dayEndHour); // End at 11 PM
    const current = dayjs(now);

    // Check if current time is outside the displayed range
    if (current.isBefore(startOfDay)) return 0;
    if (current.isAfter(endOfDay)) return 100;

    // Calculate percentage based on time passed since dayStartHour within the visible range
    const totalMinutesInRange = (dayEndHour - dayStartHour) * 60;
    const minutesPassed = current.diff(startOfDay, "minute");
    const progressPercent = (minutesPassed / totalMinutesInRange) * 100;

    return Math.min(100, Math.max(0, progressPercent)); // Clamp between 0 and 100
  };

  const [progress, setProgress] = useState(() =>
    calculateProgress(date, currentTime)
  );
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    updateCurrentTime(); // Update on mount
  }, [updateCurrentTime]); // Added dependency

  // Determine visual states using dayjs
  const today = dayjs(currentTime);
  const columnDate = dayjs(date); // Ensure `date` prop is usable by dayjs

  const isToday = isClient && columnDate.isSame(today, "day");
  const isPast = isClient && columnDate.isBefore(today, "day");
  const isInFuture = isClient && columnDate.isAfter(today, "day");

  // Update progress effect
  useEffect(() => {
    // Update progress state whenever currentTime or date changes
    setProgress(calculateProgress(date, currentTime));

    // Only set up interval for today's column
    if (isClient && isToday) {
      const interval = setInterval(() => {
        updateCurrentTime(); // Trigger store update
        // Progress will update via the dependency change on currentTime below
      }, 60000); // Update every minute
      return () => clearInterval(interval);
    }
  }, [currentTime, date, isClient, isToday, updateCurrentTime]); // Add updateCurrentTime

  // Update progress whenever currentTime changes (triggered by interval or external)
  useEffect(() => {
    setProgress(calculateProgress(date, currentTime));
  }, [currentTime, date]); // Rerun calculation when time/date changes

  /**
   * Calculates the vertical top position of a calculated task instance.
   * Converts the instance's UTC start time to the local time of the column's date
   * to find its position relative to the dayStartHour.
   *
   * @param {CalculatedInstance} instance - The calculated task instance object.
   * @returns {number} Top position in pixels relative to the column top.
   */
  const calculateTaskPosition = (instance) => {
    if (!instance?.scheduled_time_utc || !instance?.timezone) return 0;

    // Convert the instance's scheduled UTC time to the local timezone of the task
    const startTimeLocal = dayjs
      .utc(instance.scheduled_time_utc)
      .tz(instance.timezone);

    if (!startTimeLocal.isValid()) return 0;

    // Get hours and minutes from the local start time
    const hours = startTimeLocal.hour(); // 0-23
    const minutes = startTimeLocal.minute();

    // Calculate position relative to the start hour of the column (dayStartHour)
    const timeFromDayStartInHours = hours - dayStartHour + minutes / 60;

    // Calculate pixel offset, ensuring it's not negative if task starts before dayStartHour
    return Math.max(0, timeFromDayStartInHours * hourHeight);
  };

  /**
   * Calculates the height of a task based on its duration.
   *
   * @param {CalculatedInstance} instance - The calculated task instance object.
   * @returns {number} Height in pixels.
   */
  const calculateTaskHeight = (instance) => {
    if (!instance?.duration_minutes) return hourHeight / 2; // Default height?
    return (instance.duration_minutes / 60) * hourHeight;
  };

  return (
    <div
      className="relative"
      style={{ height: `${totalTimelineHeight}px` }} // Use calculated total height
    >
      {/* Hour grid lines */}
      {Array.from({ length: dayEndHour - dayStartHour }, (_, i) => (
        <div
          key={`line-${i}`}
          className="absolute w-full border-t border-gray-700/50" // Adjusted border color/opacity
          style={{ top: `${i * hourHeight}px`, left: 0, right: 0 }} // Ensure full width
        />
      ))}

      {/* Vertical timeline line */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 flex flex-col items-center">
        {" "}
        {/* Centered line */}
        <div className="relative w-full flex-grow">
          {/* Background line */}
          <div className="absolute inset-0 bg-gray-700 rounded-full"></div>{" "}
          {/* Softer gray */}
          {/* Progress overlay */}
          <div
            className={`absolute left-0 right-0 top-0 ${
              // Use more distinct colors based on state
              isPast ? "bg-primary" : isToday ? "bg-primary" : "bg-transparent"
            } rounded-full transition-all duration-1000 ease-linear`} // Smooth progress animation
            style={{ height: `${progress}%` }}
          />
        </div>
        <div
          className={`w-8 h-8 rounded-full ${isInFuture ? "bg-gray-800/50" : "bg-blue-900/30"} flex items-center justify-center my-1 flex-shrink-0`}
        >
          <Moon
            className={`w-4 h-4 ${isInFuture ? "text-gray-600" : "text-blue-400"}`}
          />
        </div>
      </div>

      {/* Tasks - Map over the calculated instances */}
      {tasks.map((instance) => {
        const top = calculateTaskPosition(instance);
        const height = calculateTaskHeight(instance);

        return (
          <TaskItem
            key={instance.id} // Use the unique calculated instance ID
            instance={instance}
            date={date}
            top={top} // Pass calculated top position
            height={height}
            isNext={isNext} // Pass isNext for potential animation sync
          />
        );
      })}
    </div>
  );
}
