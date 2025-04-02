"use client";
import dayjs from "dayjs";
import { useState, useEffect } from "react";
import useCalendarStore from "@/app/stores/useCalendarStore";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * ResponsiveCalendar - A beautiful, responsive calendar component
 * Shows multiple months on larger screens and adapts to available space
 * Uses dayjs for date handling
 */
export function ResponsiveCalendar({
  className,
  selected: externalSelected,
  onSelect: externalOnSelect,
}) {
  // Get store values only if not controlled externally
  const storeSelectedDate = useCalendarStore((state) => state.selectedDate);
  const storeSetSelectedDate = useCalendarStore(
    (state) => state.setSelectedDate
  );

  // Use external props if provided because that's for the form, otherwise use store setters
  const isControlled = externalSelected !== undefined;
  const selectedDate = isControlled ? externalSelected : storeSelectedDate;
  const setSelectedDate = isControlled
    ? externalOnSelect
    : storeSetSelectedDate;

  const dayjsSelectedDate = dayjs(selectedDate);

  // State for the calendar
  const [currentMonth, setCurrentMonth] = useState(dayjsSelectedDate.toDate());
  const [visibleMonths, setVisibleMonths] = useState(1);

  // Update visible months based on screen width
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1280) {
        setVisibleMonths(3);
      } else if (window.innerWidth >= 768) {
        setVisibleMonths(2);
      } else {
        setVisibleMonths(1);
      }
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle date selection
  function handleSelect(date) {
    if (date) {
      setSelectedDate(date);
    }
  }

  // Navigation handlers using dayjs
  function goToPreviousMonth() {
    setCurrentMonth((prevDate) => {
      return dayjs(prevDate).subtract(1, "month").toDate();
    });
  }

  function goToNextMonth() {
    setCurrentMonth((prevDate) => {
      return dayjs(prevDate).add(1, "month").toDate();
    });
  }

  // Generate months to display using dayjs
  function getMonthsToDisplay() {
    return Array.from({ length: visibleMonths }, (_, i) => {
      return dayjs(currentMonth).add(i, "month").toDate();
    });
  }

  return (
    <div
      className={cn(
        "bg-[#121212] text-white rounded-3xl p-6 w-full",
        className
      )}
    >
      {/* Calendar header with navigation */}
      <div className="flex justify-between items-center mb-6">
        <MonthYearPicker
          currentMonth={currentMonth}
          onChange={setCurrentMonth}
        />

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPreviousMonth}
            className="rounded-full text-[#ff8a8a] hover:text-[#ff8a8a] hover:bg-[#2a2a2a]"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextMonth}
            className="rounded-full text-[#ff8a8a] hover:text-[#ff8a8a] hover:bg-[#2a2a2a]"
            aria-label="Next month"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Responsive grid of calendars */}
      <div
        className={cn(
          "grid gap-8",
          visibleMonths === 1
            ? "grid-cols-1 max-w-md mx-auto"
            : visibleMonths === 2
              ? "grid-cols-1 md:grid-cols-2"
              : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
        )}
      >
        {getMonthsToDisplay().map((month) => (
          <MonthCalendar
            key={`${dayjs(month).month()}-${dayjs(month).year()}`}
            month={month}
            selected={dayjs(selectedDate).startOf("day").toDate()}
            onSelect={handleSelect}
            isSingleMonth={visibleMonths === 1}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * MonthCalendar - Displays a single month calendar
 */
function MonthCalendar({ month, selected, onSelect, isSingleMonth }) {
  return (
    <Calendar
      mode="single"
      selected={selected}
      onSelect={onSelect}
      month={month}
      className={cn("border-0", isSingleMonth && "w-full")}
      classNames={{
        months: "",
        month: "space-y-4 w-full",
        caption: "flex justify-start items-center pt-1 relative w-full",
        caption_label: "text-lg font-medium text-white text-left",
        nav: "hidden", // Hide default navigation
        table: "w-full border-collapse h-[280px]",
        head_row: "flex w-full justify-between",
        head_cell:
          "text-gray-500 font-medium flex-1 flex items-center justify-center",
        row: "flex w-full mt-2 justify-between",
        cell: "flex-1 text-center text-sm relative flex items-center justify-center",
        day: "h-10 w-10 flex items-center justify-center rounded-full transition-colors hover:bg-[#2a2a2a] text-xl",
        day_selected: "bg-blue-300 text-white hover:bg-blue-500",
        day_today: "bg-accent text-white hover:bg-accent",
        day_outside: "text-gray-600 opacity-50",
        day_disabled: "text-gray-600 opacity-50",
        day_range_middle: "rounded-none",
        day_hidden: "invisible",
      }}
      components={{
        Caption: ({ displayMonth }) => (
          <div className="text-left py-2 w-full">
            <h3 className="text-lg font-medium">
              {dayjs(displayMonth).format("MMMM YYYY")}
            </h3>
          </div>
        ),
      }}
      showOutsideDays={false}
      fixedWeeks
    />
  );
}

/**
 * MonthYearPicker - Allows selecting month and year via a popover
 */
function MonthYearPicker({ currentMonth, onChange }) {
  const [year, setYear] = useState(() => dayjs(currentMonth).year());

  // Update year when currentMonth changes
  useEffect(() => {
    setYear(dayjs(currentMonth).year());
  }, [currentMonth]);

  // Handle month selection
  function selectMonth(monthIndex) {
    const newDate = dayjs().year(year).month(monthIndex).date(1).toDate();
    onChange(newDate);
  }

  // Handle year navigation
  function changeYear(increment) {
    const newYear = year + increment;
    setYear(newYear);

    const newDate = dayjs(currentMonth).year(newYear).toDate();
    onChange(newDate);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="text-2xl font-bold flex items-center gap-1 hover:text-[#ff8a8a] transition-colors"
          aria-label="Select month and year"
        >
          {dayjs(currentMonth).format("MMMM YYYY")}
          <ChevronRight className="h-6 w-6 text-[#ff8a8a]" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4 bg-[#1a1a1a] border-[#333] text-white">
        <div className="space-y-4">
          {/* Year navigation */}
          <div className="flex justify-between items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => changeYear(-1)}
              className="text-[#ff8a8a] hover:text-[#ff8a8a] hover:bg-[#2a2a2a]"
              aria-label={`Previous year (${year - 1})`}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {year - 1}
            </Button>
            <div className="font-bold">{year}</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => changeYear(1)}
              className="text-[#ff8a8a] hover:text-[#ff8a8a] hover:bg-[#2a2a2a]"
              aria-label={`Next year (${year + 1})`}
            >
              {year + 1}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }, (_, i) => {
              const monthName = dayjs().month(i).format("MMM");
              const isCurrentMonth =
                i === dayjs(currentMonth).month() &&
                year === dayjs(currentMonth).year();

              return (
                <Button
                  key={i}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "rounded-lg py-2",
                    isCurrentMonth && "bg-[#2a2a2a] text-[#ff8a8a]"
                  )}
                  onClick={() => selectMonth(i)}
                  aria-label={dayjs().year(year).month(i).format("MMMM YYYY")}
                  aria-selected={isCurrentMonth}
                >
                  {monthName}
                </Button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
