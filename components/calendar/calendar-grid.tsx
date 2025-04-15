"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import { cn } from "@/lib/utils";

interface CalendarGridProps {
  currentDate: dayjs.Dayjs;
  selectedDate: Date;
  animatingDate: number | null;
  onDateSelect: (day: number) => void;
}

const weekDays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export const CalendarGrid = memo(function CalendarGrid({
  currentDate,
  selectedDate,
  animatingDate,
  onDateSelect,
}: CalendarGridProps) {
  const firstDayOfMonth = currentDate.startOf("month").day();
  const daysInMonth = currentDate.daysInMonth();
  const selectedDayjs = dayjs(selectedDate);

  // Render week day headers
  const renderWeekDays = () => (
    <div className="grid grid-cols-7 gap-0 text-center mb-4">
      {weekDays.map((day) => (
        <div key={day} className="text-gray-500 text-sm md:text-lg">
          {day}
        </div>
      ))}
    </div>
  );

  // Render calendar days
  const renderDays = () => {
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(
        <div key={`empty-${i}`} className="h-12 md:h-14 w-12 md:w-14" />
      );
    }

    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected =
        selectedDayjs.date() === day &&
        selectedDayjs.month() === currentDate.month() &&
        selectedDayjs.year() === currentDate.year();

      const isAnimating = animatingDate === day;

      days.push(
        <motion.button
          key={day}
          onClick={() => onDateSelect(day)}
          className={cn(
            "h-12 md:h-14 w-12 md:w-14 rounded-full text-xl md:text-2xl font-light flex items-center justify-center transition-colors",
            isSelected ? "bg-rose-400 text-white" : "hover:bg-gray-800"
          )}
          whileTap={{ scale: 0.95 }}
          animate={isAnimating ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.3 }}
        >
          {day}
        </motion.button>
      );
    }

    return <div className="grid grid-cols-7 gap-0">{days}</div>;
  };

  return (
    <>
      {renderWeekDays()}
      {renderDays()}
    </>
  );
});
