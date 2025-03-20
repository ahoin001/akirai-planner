"use client";

/**
 * DatePicker Component
 *
 * A modal calendar for selecting dates. Allows navigation between months
 * and selection of any date.
 *
 * @component
 */
import { useState, useRef, useEffect } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";

import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * DatePicker component
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the date picker is open
 * @param {Function} props.onClose - Function to call when closing the picker
 * @param {Function} props.onSelect - Function to call when a date is selected
 * @param {Date} props.selectedDate - Currently selected date
 * @returns {JSX.Element|null} Rendered component or null if closed
 */
export default function DatePicker({
  isOpen,
  onClose,
  onSelect,
  selectedDate,
}) {
  // State to track the currently displayed month
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());
  const pickerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Navigation functions
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  // Get all days in the current month
  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  // Get day of week for first day (0 = Sunday, 6 = Saturday)
  const startDay = startOfMonth(currentMonth).getDay();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={pickerRef}
        className="bg-zinc-900 rounded-lg shadow-xl p-4 w-80 max-w-full"
      >
        {/* Header with month/year and navigation */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={prevMonth}
            className="p-1 hover:bg-zinc-800 rounded cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <button
            onClick={nextMonth}
            className="p-1 hover:bg-zinc-800 rounded cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded ml-2 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Day of week headers */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
            <div key={day} className="text-xs text-gray-400">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before the first of the month */}
          {Array.from({ length: startDay }).map((_, i) => (
            <div key={`empty-${i}`} className="h-8"></div>
          ))}

          {/* Actual days */}
          {days.map((day) => (
            <button
              key={day.toString()}
              onClick={() => {
                onSelect(day);
                onClose();
              }}
              className={`h-8 w-8 rounded-full flex items-center justify-center mx-auto text-sm
                ${
                  isSameDay(day, selectedDate)
                    ? "bg-pink-500 text-white"
                    : isToday(day)
                      ? "ring-1 ring-pink-500"
                      : !isSameMonth(day, currentMonth)
                        ? "text-gray-600"
                        : "hover:bg-zinc-800"
                }`}
            >
              {format(day, "d")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
