"use client";

import { format, endOfWeek } from "date-fns";
import useCalendarStore from "@/app/stores/useCalendarStore";

import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * WeekNavigation component
 *
 * @returns {JSX.Element} Rendered component
 */
export default function WeekNavigation() {
  const { currentWeekStart, changeWeek } = useCalendarStore();

  return (
    <div className="flex justify-between items-center my-4 md:py-4">
      <button
        onClick={() => changeWeek("prev")}
        className="text-gray-400 cursor-pointer"
        aria-label="Previous week"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      {/* Week date range */}
      <span className="text-lg">
        {format(currentWeekStart, "MMM d")} -{" "}
        {format(endOfWeek(currentWeekStart), "MMM d, yyyy")}
      </span>

      <button
        onClick={() => changeWeek("next")}
        className="text-gray-400 cursor-pointer"
        aria-label="Next week"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  );
}
