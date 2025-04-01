"use client";

/**
 * WeekHeader Component
 *
 * Displays the days of the week with selection indicators and
 * provides access to the date picker.
 *
 * @component
 */
import { format, isSameDay } from "date-fns";
import { useState, useCallback, memo } from "react";
import useCalendarStore from "@/app/stores/useCalendarStore";

import DatePicker from "./date-picker";

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

/**
 * WeekHeader component
 *
 * @param {Object} props - Component props
 * @param {Array} props.weekDays - Array of Date objects for each day of the week
 * @param {boolean} props.isNext - Whether this header is for the next week view
 * @returns {JSX.Element} Rendered component
 */
const WeekHeader = ({ weekDays, isNext = false }) => {
  const {
    currentTime,
    selectedDay,
    selectDay,
    navigateToDate,
    slideDirection,
  } = useCalendarStore();

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerFor, setDatePickerFor] = useState(null);

  /**
   * Handles click on the calendar icon to open date picker
   * @param {Date} date - The date associated with the clicked calendar icon
   */
  const handleDayClick = useCallback((date) => {
    setDatePickerFor(date);
    setDatePickerOpen(true);
  }, []);

  /**
   * Handles date selection from the date picker
   * @param {Date} date - The selected date
   */
  const handleDateSelect = useCallback(
    (date) => {
      // Navigate to the week containing the selected date
      navigateToDate(date);
      setDatePickerOpen(false);
    },
    [navigateToDate]
  );

  /**
   * Handles closing the date picker
   */
  const handleCloseDatePicker = useCallback(() => {
    setDatePickerOpen(false);
  }, []);

  return (
    <>
      <div
        className={`grid grid-cols-8 gap-4 mb-4 transition-transform duration-300 ${
          !isNext && slideDirection === "left"
            ? "-translate-x-full"
            : !isNext && slideDirection === "right"
              ? "translate-x-full"
              : isNext && slideDirection === "left"
                ? "translate-x-0"
                : isNext && slideDirection === "right"
                  ? "translate-x-0"
                  : ""
        }`}
        style={{
          transform:
            isNext && slideDirection === "left"
              ? "translateX(100%)"
              : isNext && slideDirection === "right"
                ? "translateX(-100%)"
                : "",
        }}
      >
        <div className="text-center"></div> {/* Empty cell for alignment */}
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

      {/* Date Picker */}
      <DatePicker
        isOpen={datePickerOpen}
        onClose={handleCloseDatePicker}
        onSelect={handleDateSelect}
        selectedDate={datePickerFor}
      />
    </>
  );
};

export default memo(WeekHeader);
