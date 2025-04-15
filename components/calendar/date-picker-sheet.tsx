"use client";

import { memo, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AnimatePresence } from "framer-motion";
import { useMediaQuery } from "@/hooks/use-media-query";
import useCalendarStore from "@/app/stores/useCalendarStore";
import { MonthYearPicker } from "./month-year-picker";
import { MonthView } from "./month-view";
import dayjs from "dayjs";

interface DatePickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDateSelect?: (date: Date) => void;
  selectedDate?: Date;
}

export const DatePickerSheet = memo(function DatePickerSheet({
  open,
  onOpenChange,
  onDateSelect,
  selectedDate = new Date(),
}: DatePickerSheetProps) {
  // Responsive state
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Date picker state from Zustand store
  const {
    selectedDay: currentDate,
    nextMonth,
    showMonthPicker,
    sheetSlideDirection,
    animatingDate,
    tempMonth,
    tempYear,
    setTempMonth,
    setTempYear,
    handlePreviousMonth,
    handleNextMonth,
    handleDateSelect,
    handleMonthPickerOpen,
    handleMonthPickerCancel,
    handleMonthPickerApply,
    syncWithSelectedDate,
  } = useCalendarStore();

  // Sync with selected date when it changes
  // useEffect(() => {
  //   syncWithSelectedDate(selectedDate);
  // }, [selectedDate, syncWithSelectedDate]);

  // Month and year options
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const currentYear = dayjs().year();
  const years = Array.from({ length: 21 }, (_, i) =>
    String(currentYear - 10 + i)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "bg-black text-white rounded-t-3xl p-4 md:p-6 mx-auto h-auto",
          isDesktop ? "max-w-4xl" : "max-w-md"
        )}
      >
        <AnimatePresence mode="wait">
          {showMonthPicker ? (
            <MonthYearPicker
              months={months}
              years={years}
              tempMonth={tempMonth}
              tempYear={tempYear}
              currentYear={currentYear}
              onMonthChange={setTempMonth}
              onYearChange={setTempYear}
              onCancel={handleMonthPickerCancel}
              onApply={handleMonthPickerApply}
            />
          ) : (
            <div className={cn(isDesktop ? "grid grid-cols-2 gap-8" : "block")}>
              {/* Current Month */}
              <MonthView
                date={currentDate}
                selectedDate={selectedDate}
                animatingDate={animatingDate}
                slideDirection={sheetSlideDirection}
                onDateSelect={(day) => handleDateSelect(day, 0, onDateSelect)}
                onMonthPickerOpen={handleMonthPickerOpen}
                onPrevious={handlePreviousMonth}
                onNext={handleNextMonth}
              />

              {/* Next Month (only on desktop) */}
              {isDesktop && (
                <MonthView
                  date={nextMonth}
                  selectedDate={selectedDate}
                  animatingDate={animatingDate}
                  slideDirection={sheetSlideDirection}
                  showNavigation={false}
                  onDateSelect={(day) => handleDateSelect(day, 1, onDateSelect)}
                />
              )}
            </div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
});
