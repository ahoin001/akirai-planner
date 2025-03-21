"use client";

/**
 * TaskItem Component
 *
 * Renders an individual task on the timeline with proper positioning,
 * styling, and progress indication.
 *
 * @component
 */
import { isAfter } from "date-fns";
import { AlarmClock, Moon, Dumbbell } from "lucide-react";
import useCalendarStore from "@/app/stores/useCalendarStore";

/**
 * Gets the appropriate icon for a task type
 * @param {string} type - The task type ('alarm', 'workout', or 'night')
 * @returns {JSX.Element} The icon component
 */
const getTaskIcon = (type) => {
  switch (type) {
    case "alarm":
      return <AlarmClock className="w-5 h-5" />;
    case "workout":
      return <Dumbbell className="w-5 h-5" />;
    case "night":
      return <Moon className="w-5 h-5" />;
    default:
      return null;
  }
};

/**
 * TaskItem component
 *
 * @param {Object} props - Component props
 * @param {Object} props.task - Task data object
 * @param {Date} props.date - The date this task belongs to
 * @param {number} props.top - Top position in pixels
 * @param {number} props.height - Height in pixels
 * @param {boolean} props.isNext - Whether this task is in the next week view
 * @returns {JSX.Element} Rendered component
 */
export default function TaskItem({ task, date, top, height, isNext = false }) {
  const { currentTime, getTaskProgress, selectDay, setSelectedTaskId } =
    useCalendarStore();

  // Calculate task progress and determine visual states
  const progress = getTaskProgress(task);
  const isActive = progress > 0 && progress < 100;
  const isGrayed = isAfter(date, currentTime) || isNext;

  /**
   * Handle task click - select the day and the task
   */
  const handleTaskClick = () => {
    selectDay(date);
    setSelectedTaskId(task.id);
  };

  return (
    <div
      className={`absolute left-1/2 transform -translate-x-1/2 w-12 rounded-full overflow-hidden transition-all duration-300 cursor-pointer
        ${isActive ? "ring-2 ring-white" : ""}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
      }}
      onClick={handleTaskClick}
    >
      {/* Task background */}
      <div
        className={`absolute inset-0 ${
          isGrayed
            ? "bg-gray-700"
            : task.color === "pink"
              ? "bg-pink-500"
              : "bg-blue-500"
        }`}
      />

      {/* Progress overlay - fills from bottom to top */}
      <div
        className={`absolute inset-0 bg-gradient-to-t ${
          isGrayed
            ? "from-gray-700 to-transparent"
            : task.color === "pink"
              ? "from-pink-500 to-transparent"
              : "from-blue-500 to-transparent"
        } transition-all duration-1000`}
        style={{ height: `${progress}%`, top: "auto" }}
      />

      {/* Task icon */}
      <div
        className={`absolute inset-0 flex items-center justify-center ${isGrayed ? "text-gray-500" : "text-white"}`}
      >
        <Dumbbell className="w-5 h-5" />;{/* {getTaskIcon(task.type)} */}
      </div>
    </div>
  );
}
