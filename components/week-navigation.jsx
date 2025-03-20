"use client";
import { format, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import useCalendarStore from "@/stores/useCalendarStore";

/**
 * WeekNavigation component
 *
 * @returns {JSX.Element} Rendered component
 */
export default function WeekNavigation() {
  const { currentWeekStart, isTransitioning, changeWeek } = useCalendarStore();

  return (
    <div className="flex justify-between items-center mb-4">
      {/* Previous week button */}
      <button
        onClick={() => changeWeek("prev")}
        className="text-gray-400 cursor-pointer"
        disabled={isTransitioning}
        aria-label="Previous week"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      {/* Week date range */}
      <span className="text-lg">
        {format(currentWeekStart, "MMM d")} -{" "}
        {format(endOfWeek(currentWeekStart), "MMM d, yyyy")}
      </span>

      {/* Next week button */}
      <button
        onClick={() => changeWeek("next")}
        className="text-gray-400 cursor-pointer"
        disabled={isTransitioning}
        aria-label="Next week"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  );
}
