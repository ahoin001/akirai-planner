"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Dayjs } from "dayjs";
import { MonthHeader } from "./month-header";
import { CalendarGrid } from "./calendar-grid";

interface MonthViewProps {
  date: Dayjs;
  selectedDate: Date;
  animatingDate: number | null;
  slideDirection: "left" | "right";
  showNavigation?: boolean;
  onDateSelect: (day: number) => void;
  onMonthPickerOpen?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

export const MonthView = memo(function MonthView({
  date,
  selectedDate,
  animatingDate,
  slideDirection,
  showNavigation = true,
  onDateSelect,
  onMonthPickerOpen,
  onPrevious,
  onNext,
}: MonthViewProps) {
  return (
    <div>
      <MonthHeader
        date={date}
        showNavigation={showNavigation}
        onMonthPickerOpen={onMonthPickerOpen}
        onPrevious={onPrevious}
        onNext={onNext}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={date.format("YYYY-MM")}
          initial={{
            opacity: 0,
            x: slideDirection === "right" ? 100 : -100,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          exit={{
            opacity: 0,
            x: slideDirection === "right" ? -100 : 100,
          }}
          transition={{ duration: 0.3 }}
        >
          <CalendarGrid
            currentDate={date}
            selectedDate={selectedDate}
            animatingDate={animatingDate}
            onDateSelect={onDateSelect}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
});
