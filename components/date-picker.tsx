// components/DatePicker.tsx

"use client";

import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import dayjs from "dayjs";

import { DateWheelPicker } from "./date-wheel-picker";
import useCalendarStore from "@/app/stores/useCalendarStore";

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

interface DatePickerProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  selectedDate,
  onDateSelect,
}) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate ?? new Date());
  const [selectedDateState, setSelectedDateState] = useState(
    selectedDate ?? new Date()
  );
  const [isWheelOpen, setIsWheelOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 0
  );

  const [tempMonth, setTempMonth] = useState<number>(
    dayjs(selectedDate).month()
  );
  const [tempYear, setTempYear] = useState<number>(dayjs(selectedDate).year());

  useEffect(() => {
    if (selectedDate) {
      setSelectedDateState(selectedDate);
      setCurrentMonth(selectedDate);
      setTempMonth(dayjs(selectedDate).month());
      setTempYear(dayjs(selectedDate).year());
    }
  }, [selectedDate]);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleApplyMonthYear = () => {
    const newDate = dayjs().year(tempYear).month(tempMonth).date(1).toDate();
    setCurrentMonth(newDate);
    setIsWheelOpen(false);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDateState(date);
    onDateSelect?.(date);
  };

  const prevMonth = () =>
    setCurrentMonth(dayjs(currentMonth).subtract(1, "month").toDate());

  const nextMonth = () =>
    setCurrentMonth(dayjs(currentMonth).add(1, "month").toDate());

  const toggleWheelPicker = () => {
    setTempMonth(dayjs(currentMonth).month());
    setTempYear(dayjs(currentMonth).year());
    setIsWheelOpen(!isWheelOpen);
  };

  const showTwoMonths = viewportWidth >= 768;

  return (
    <div className="w-full max-w-[900px] px-8 py-8 mx-auto overflow-hidden rounded-xl bg-drawer shadow-lg border text-white">
      <h1 className="px-4 pt-4 pb-2 flex justify-between items-center">
        <div className="flex items-center">
          {isWheelOpen && (
            <button
              onClick={toggleWheelPicker}
              className="ml-2 p-1 text-rose-400"
            >
              <ChevronLeft size={18} />
            </button>
          )}

          <h1 className="mx-6 text-2xl font-semibold text-white">
            <span className="hover:cursor-pointer" onClick={toggleWheelPicker}>
              Select Date
            </span>

            {!isWheelOpen && (
              <button
                onClick={toggleWheelPicker}
                className="ml-2 text-rose-400 hover:text-rose-300 hover:bg-transparent"
              >
                <ChevronRight className="h-4 w-4 mr-1" />
              </button>
            )}
          </h1>

          {isWheelOpen && (
            <button
              onClick={handleApplyMonthYear}
              className="flex items-center gap-x-1 text-rose-400 hover:text-rose-300"
            >
              <span>Apply</span>
            </button>
          )}
        </div>

        <button
          onClick={() => {
            const today = dayjs().startOf("day").toDate();
            useCalendarStore.getState().selectDay(today);
            setSelectedDateState(today);
          }}
          className="px-3 py-1.5 text-sm rounded-full bg-rose-400/20 hover:bg-rose-400/30 text-rose-400 transition-colors"
        >
          Today
        </button>
      </h1>

      <div className="overflow-hidden relative">
        {isWheelOpen ? (
          <div className="flex space-x-4 h-[250px]">
            <DateWheelPicker
              options={months}
              defaultIndex={tempMonth}
              onChange={(_, index) => setTempMonth(index)}
            />
            <DateWheelPicker
              options={years}
              defaultIndex={tempYear - (currentYear - 10)}
              onChange={(value) => setTempYear(Number.parseInt(value))}
            />
          </div>
        ) : (
          <div className="h-full flex flex-col animate-fade-in">
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col">
                <div className="p-4 flex justify-between items-center">
                  <button
                    onClick={prevMonth}
                    className="p-2 rounded-full hover:bg-gray-800 text-rose-400"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <h3 className="text-lg font-medium">
                    {dayjs(currentMonth).format("MMMM YYYY")}
                  </h3>
                  {!showTwoMonths && (
                    <button
                      onClick={nextMonth}
                      className="p-2 rounded-full hover:bg-gray-800 text-rose-400"
                    >
                      <ChevronRight size={20} />
                    </button>
                  )}
                </div>
                <MonthCalendar
                  month={currentMonth}
                  selectedDate={selectedDateState}
                  onDateSelect={handleDateSelect}
                />
              </div>

              {showTwoMonths && (
                <div className="flex-1 flex flex-col">
                  <div className="p-4 flex justify-between items-center">
                    <div className="p-2 opacity-0">
                      <ChevronLeft size={20} />
                    </div>
                    <h3 className="text-lg font-medium">
                      {dayjs(currentMonth).add(1, "month").format("MMMM YYYY")}
                    </h3>
                    <button
                      onClick={nextMonth}
                      className="p-2 rounded-full hover:bg-gray-800 text-rose-400"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                  <MonthCalendar
                    month={dayjs(currentMonth).add(1, "month").toDate()}
                    selectedDate={selectedDateState}
                    onDateSelect={handleDateSelect}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface MonthCalendarProps {
  month: Date;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

const MonthCalendar: React.FC<MonthCalendarProps> = ({
  month,
  selectedDate,
  onDateSelect,
}) => {
  const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const weeks = getCalendarDays(month);
  const today = dayjs().startOf("day");

  return (
    <div className="flex-1 px-2">
      <div className="grid grid-cols-7 mb-2">
        {daysOfWeek.map((day) => (
          <div
            key={day}
            className="text-center py-2 text-gray-500 text-sm font-medium"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-4">
        {weeks.map((week, weekIndex) =>
          week.map((day, dayIndex) => {
            const isCurrentMonth = day.getMonth() === month.getMonth();
            const isSelected = dayjs(day).isSame(selectedDate, "day");
            const isToday = dayjs(day).isSame(today, "day");

            return (
              <div
                key={`${weekIndex}-${dayIndex}`}
                className="flex justify-center items-center"
              >
                {isCurrentMonth ? (
                  <button
                    onClick={() => onDateSelect(day)}
                    style={{
                      transform: isSelected ? "scale(1.1)" : "scale(1)",
                    }}
                    className={`
                   w-10 h-10 rounded-full flex items-center justify-center text-lg 
                   transition-all duration-200 ease-out
                   ${isSelected ? "bg-rose-400 text-white font-medium" : ""}
                   ${isToday && !isSelected ? "font-bold text-rose-400" : "text-white"}
                   hover:scale-105 hover:bg-rose-400/20
                 `}
                  >
                    {day.getDate()}
                  </button>
                ) : (
                  <span className="w-10 h-10 flex items-center justify-center text-gray-600 text-lg">
                    {day.getDate()}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

function getCalendarDays(month: Date): Date[][] {
  const start = dayjs(month).startOf("month").startOf("week");
  const end = dayjs(month).endOf("month").endOf("week");
  const days: Date[] = [];
  let curr = start;
  while (curr.isBefore(end)) {
    days.push(curr.toDate());
    curr = curr.add(1, "day");
  }
  return Array.from({ length: Math.ceil(days.length / 7) }, (_, i) =>
    days.slice(i * 7, i * 7 + 7)
  );
}
