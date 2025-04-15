"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Dayjs } from "dayjs";

interface MonthHeaderProps {
  date: Dayjs;
  showNavigation?: boolean;
  onMonthPickerOpen?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function MonthHeader({
  date,
  showNavigation = true,
  onMonthPickerOpen,
  onPrevious,
  onNext,
}: MonthHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6 mt-4">
      {onMonthPickerOpen ? (
        <button
          onClick={onMonthPickerOpen}
          className="text-2xl md:text-3xl font-bold flex items-center"
        >
          {date.format("MMMM YYYY")}
          <ChevronRight className="h-5 w-5 md:h-6 md:w-6 ml-2" />
        </button>
      ) : (
        <h2 className="text-2xl md:text-3xl font-bold">
          {date.format("MMMM YYYY")}
        </h2>
      )}

      {showNavigation && onPrevious && onNext && (
        <div className="flex space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevious}
            className="text-rose-400 hover:text-rose-300 hover:bg-transparent"
          >
            <ChevronLeft className="h-6 w-6 md:h-8 md:w-8" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            className="text-rose-400 hover:text-rose-300 hover:bg-transparent"
          >
            <ChevronRight className="h-6 w-6 md:h-8 md:w-8" />
          </Button>
        </div>
      )}
    </div>
  );
}
