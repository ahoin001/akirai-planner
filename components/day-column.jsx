"use client";

/**
 * DayColumn Component
 *
 * Renders a single day column in the timeline with hour markers,
 * vertical timeline, and tasks.
 *
 * @component
 */
import { useEffect, useState } from "react";
import { isSameDay, isBefore, isAfter } from "date-fns";
import { Moon } from "lucide-react";
import TaskItem from "./task-item";
import useCalendarStore from "@/app/stores/useCalendarStore";

// Constants for timeline configuration
const dayStart = 8; // 8 AM
const dayEnd = 23; // 11 PM
const hourHeight = 60; // Height of one hour in pixels

/**
 * DayColumn component
 *
 * @param {Object} props - Component props
 * @param {Date} props.date - The date this column represents
 * @param {Array} props.tasks - Array of tasks for this day
 * @param {boolean} props.isNext - Whether this column is in the next week view
 * @returns {JSX.Element} Rendered component
 */
export default function DayColumn({ date, tasks, isNext = false }) {
  const { currentTime, getDayProgress, updateCurrentTime } = useCalendarStore();
  const [progress, setProgress] = useState(getDayProgress(date));

  const [isClient, setIsClient] = useState(false);

  // Set isClient to true after first render
  useEffect(() => {
    setIsClient(true);
    // Update time once after component mounts on client
    updateCurrentTime();
  }, []);

  // Determine visual states - only use real-time values on client
  const isInFuture = isClient ? isAfter(date, currentTime) : false;
  const isPast = isClient
    ? isBefore(date, new Date(currentTime).setHours(0, 0, 0, 0))
    : false;
  const isToday = isClient ? isSameDay(date, currentTime) : false;

  // Update progress in real-time for the current day
  useEffect(() => {
    if (!isClient || !isToday) return;

    // Update progress immediately
    setProgress(getDayProgress(date));

    // Set up interval to update progress every minute
    const interval = setInterval(() => {
      updateCurrentTime(); // Update the time in the store
      setProgress(getDayProgress(date));
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [date, isToday, getDayProgress, isClient, updateCurrentTime]);

  // Update progress when currentTime changes
  useEffect(() => {
    setProgress(getDayProgress(date));
  }, [currentTime, date, getDayProgress]);

  /**
   * Calculates the vertical position of a task
   * @param {Object} task - The task object
   * @returns {number} Top position in pixels
   */
  const calculateTaskPosition = (task) => {
    const [hours, minutes] = task.start_time.split(":").map(Number);
    const timeInHours = hours + minutes / 60 - dayStart;
    return timeInHours * hourHeight;
  };

  /**
   * Calculates the height of a task based on duration
   * @param {Object} task - The task object
   * @returns {number} Height in pixels
   */
  const calculateTaskHeight = (task) => {
    return (task.duration_minutes / 60) * hourHeight;
  };

  return (
    <div
      className="relative"
      style={{ height: `${(dayEnd - dayStart) * hourHeight}px` }}
    >
      {/* Hour grid lines */}
      {Array.from({ length: dayEnd - dayStart }, (_, i) => (
        <div
          key={i}
          className="absolute w-full border-t border-gray-800"
          style={{ top: `${i * hourHeight}px` }}
        />
      ))}

      {/* Vertical timeline line - always full height with color indicating progress */}
      <div className="absolute inset-0 flex flex-col items-center">
        {/* Timeline line with progress indicator */}
        <div className="relative w-1 flex-grow">
          {/* Background line (always full height) */}
          <div className="absolute inset-0 bg-gray-700"></div>

          {/* Progress overlay */}
          <div
            className={`absolute inset-0 ${
              isPast
                ? "bg-pink-500"
                : isToday
                  ? "bg-pink-500"
                  : "bg-transparent"
            } transition-all duration-1000`}
            style={{
              height: `${progress}%`,
              top: 0, // Fill from top to bottom
            }}
          />
        </div>

        {/* Moon icon at bottom */}
        <div
          className={`w-8 h-8 rounded-full ${
            isInFuture ? "bg-gray-800" : "bg-blue-500/20"
          } flex items-center justify-center mb-2`}
        >
          <Moon
            className={`w-5 h-5 ${isInFuture ? "text-gray-600" : "text-blue-400"}`}
          />
        </div>
      </div>

      {/* Tasks */}
      {tasks.map((task) => {
        return (
          <TaskItem
            key={task.id}
            task={task}
            date={date}
            top={calculateTaskPosition(task)}
            height={calculateTaskHeight(task)}
            isNext={isNext}
          />
        );
      })}
    </div>
  );
}
