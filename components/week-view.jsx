"use client";

import dayjs from "dayjs";
import { useMemo, memo, useState, useCallback } from "react";
import useCalendarStore from "@/app/stores/useCalendarStore";
import { useTaskStore } from "@/app/stores/useTaskStore";
import { calculateInstancesForRange } from "@/lib/taskCalculator";
import DayColumn from "./day-column";
import TimeLabels from "./time-labels";
import { format, isSameDay } from "date-fns";

dayjs.extend(require("dayjs/plugin/isSameOrAfter"));
dayjs.extend(require("dayjs/plugin/isSameOrBefore"));

// Mobile actions
const useSwipe = (changeWeek) => {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Minimum swipe distance required for switching weeks
  const minSwipeDistance = 70;

  const onTouchStart = useCallback((e) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchEnd(null);
  }, []);

  const onTouchMove = useCallback((e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      changeWeek("next");
    } else if (isRightSwipe) {
      changeWeek("prev");
    }
  }, [touchStart, touchEnd, changeWeek]);

  return { onTouchStart, onTouchMove, onTouchEnd };
};

const WeekView = () => {
  const { changeWeek, currentTime, selectDay, selectedDay, getWeekDays } =
    useCalendarStore();
  const { tasks, exceptions } = useTaskStore();
  const weekDays = getWeekDays();

  const swipeHandlers = useSwipe(changeWeek);

  const weekInstances = useMemo(() => {
    if (!weekDays?.length || !tasks) return [];
    const rangeStart = dayjs(weekDays[0]).startOf("day");
    const rangeEnd = dayjs(weekDays[6]).endOf("day");
    return calculateInstancesForRange(
      tasks,
      exceptions,
      rangeStart.toISOString(),
      rangeEnd.toISOString()
    );
  }, [tasks, exceptions, weekDays]);

  return (
    <div
      className="flex flex-col w-full h-full overflow-hidden"
      {...swipeHandlers}
    >
      <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {/* Single grid container for headers and timeline */}
        <div className="grid grid-rows-[auto,1fr] grid-cols-[10px_repeat(7,1fr)] gap-y-2">
          {/* Day headers row */}
          <div className="contents">
            {" "}
            {/* Phantom element to maintain grid structure */}
            <div /> {/* Empty cell for time label column */}
            {weekDays.map((date, i) => (
              <DayHeader
                key={i}
                date={date}
                isSelected={isSameDay(date, selectedDay)}
                isToday={isSameDay(date, currentTime)}
                onSelect={selectDay}
              />
            ))}
          </div>

          {/* Timeline content row */}
          <div className="contents">
            {" "}
            {/* Phantom element for grid structure */}
            <TimeLabels />
            {weekDays.map((date) => {
              const tasksForDay = weekInstances.filter((instance) =>
                dayjs(instance.scheduled_time_utc).isSame(date, "day")
              );
              return (
                <DayColumn
                  key={date.toISOString()}
                  date={date}
                  tasks={tasksForDay}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Individual day header component
 * Memoized to prevent unnecessary rerenders
 */
const DayHeader = memo(({ date, isSelected, isToday, onSelect }) => {
  return (
    <div className="text-center relative group">
      {/* Day of week label */}
      <div className="text-gray-400 text-sm mb-2">{format(date, "EEE")}</div>

      {/* Day number with selection indicator */}
      <div
        className={`text-xl font-medium w-10 h-10 rounded-full flex items-center justify-center mx-auto cursor-pointer
            ${
              isSelected
                ? "bg-pink-500 text-white"
                : isToday
                  ? "ring-2 ring-pink-500 text-white"
                  : "text-white"
            }`}
        onClick={() => onSelect(date)}
      >
        {format(date, "d")}
      </div>
    </div>
  );
});

DayHeader.displayName = "DayHeader";

export default memo(WeekView);
