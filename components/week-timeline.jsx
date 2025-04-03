"use client";

// ****** CHANGE: Import necessary hooks/utils ******
import { useMemo } from "react";
import { useTaskStore } from "@/app/stores/useTaskStore";
import { calculateInstancesForRange } from "@/lib/taskCalculator"; // Adjust path if needed
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

import DayColumn from "@/components/day-column";
import TimeLabels from "./time-labels";

// Let's try extending with the ones we know we need for comparison:
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

/**
 * WeekTimeline component (Refactored for new store/schema)
 * Calculates and displays tasks for a given week.
 *
 * @param {Object} props - Component props
 * @param {Array<Date|string>} props.days - Array of Date objects or ISO strings for each day of the week
 * @param {boolean} props.isNext - Whether this timeline is for the next week view (for animation/positioning)
 * @returns {JSX.Element} Rendered component
 */
export default function WeekTimeline({ days, isNext = false }) {
  const tasks = useTaskStore((state) => state.tasks);
  const exceptions = useTaskStore((state) => state.exceptions);

  // ****** CHANGE: Calculate instances for the entire week using useMemo ******
  const weekInstances = useMemo(() => {
    if (!days || days.length === 0 || !tasks) {
      return []; // Return empty if essential data is missing
    }
    // Determine the start and end of the range covered by the 'days' array
    const rangeStart = dayjs(days[0]).startOf("day");
    const rangeEnd = dayjs(days[days.length - 1]).endOf("day");

    // Ensure dates are valid before calculating
    if (!rangeStart.isValid() || !rangeEnd.isValid()) {
      console.error(
        "WeekTimeline: Invalid date range provided in 'days' prop."
      );
      return [];
    }

    // console.log(
    //   `WeekTimeline: Calculating instances for range: ${rangeStart.toISOString()} to ${rangeEnd.toISOString()}`
    // );

    // Call the calculator utility
    return calculateInstancesForRange(
      tasks,
      exceptions,
      rangeStart.toISOString(),
      rangeEnd.toISOString() // Pass end date for calculation range
    );
  }, [tasks, exceptions, days]); // Recalculate only if data or days array changes

  return (
    <div
      // Keep existing layout classes
      className={`grid grid-cols-8 gap-2 sm:gap-4 ${isNext ? "absolute top-0 left-0 right-0" : ""}`} // Adjusted gap
    >
      {/* Time labels column */}
      <TimeLabels />

      {/* Timeline grid */}
      {days.map((date, dayIndex) => {
        // ****** CHANGE: Filter pre-calculated weekInstances for the current day ******
        const tasksForDay = weekInstances.filter((instance) =>
          // Compare the scheduled time (UTC) with the start of the target day (UTC)
          dayjs
            .utc(instance.scheduled_time_utc)
            .isSame(dayjs(date).startOf("day"), "day")
        );

        // console.log(`Day ${dayIndex} (${dayjs(date).format('YYYY-MM-DD')}): Found ${tasksForDay.length} tasks`);

        return (
          <DayColumn
            key={dayjs(date).toISOString()} // Use a more stable key like ISO string
            date={date}
            tasks={tasksForDay} // Pass the filtered tasks for this specific day
            isNext={isNext}
          />
        );
      })}
    </div>
  );
}
