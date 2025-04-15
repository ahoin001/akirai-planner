"use client";

import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { DateWheelPicker } from "@/components/calendar/date-wheel-picker";

interface MonthYearPickerProps {
  months: string[];
  years: string[];
  tempMonth: number;
  tempYear: number;
  currentYear: number;
  onMonthChange: (index: number) => void;
  onYearChange: (year: number) => void;
  onCancel: () => void;
  onApply: () => void;
}

export function MonthYearPicker({
  months,
  years,
  tempMonth,
  tempYear,
  currentYear,
  onMonthChange,
  onYearChange,
  onCancel,
  onApply,
}: MonthYearPickerProps) {
  return (
    <motion.div
      key="picker"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className="pt-4"
    >
      <div className="flex justify-between items-center mb-6">
        <Button
          variant="ghost"
          onClick={onCancel}
          className="text-rose-400 hover:text-rose-300 hover:bg-transparent"
        >
          Cancel
        </Button>
        <h2 className="text-lg font-medium">Select Date</h2>
        <Button
          variant="ghost"
          onClick={onApply}
          className="text-rose-400 hover:text-rose-300 hover:bg-transparent"
        >
          <Check className="h-5 w-5 mr-1" />
          Done
        </Button>
      </div>

      <div className="flex space-x-4 h-[250px]">
        {/* Month Picker */}
        <div className="flex-1">
          <DateWheelPicker
            options={months}
            defaultIndex={tempMonth}
            onChange={(_, index) => onMonthChange(index)}
          />
        </div>

        {/* Year Picker */}
        <div className="flex-1">
          <DateWheelPicker
            options={years}
            defaultIndex={10 + (tempYear - currentYear)}
            onChange={(value) => onYearChange(Number.parseInt(value))}
          />
        </div>
      </div>
    </motion.div>
  );
}
