import useCalendarStore from "@/app/stores/useCalendarStore";

import DayColumn from "@/components/day-column";
import TimeLabels from "./time-labels";
import { useTaskStore } from "@/app/stores/useTaskStore";

/**
 * WeekTimeline component
 *
 * @param {Object} props - Component props
 * @param {Array} props.tasks - Array of tasks for the week
 * @param {Array} props.days - Array of Date objects for each day of the week
 * @param {boolean} props.isNext - Whether this timeline is for the next week view
 * @returns {JSX.Element} Rendered component
 */
export default function WeekTimeline({ tasks, days, isNext = false }) {
  // const { getTasksForFormattedDay } = useCalendarStore();
  const { getTasksForFormattedDay } = useTaskStore();

  return (
    <div
      className={`grid grid-cols-8 gap-4 ${isNext ? "absolute top-0 left-0 right-0" : ""}`}
    >
      {/* Time labels column */}
      <TimeLabels />

      {/* Timeline grid */}
      {days.map((date, dayIndex) => {
        const tasksForDay = getTasksForFormattedDay(date);

        return (
          <DayColumn
            key={dayIndex}
            date={date}
            tasks={tasksForDay}
            isNext={isNext}
          />
        );
      })}
    </div>
  );
}
