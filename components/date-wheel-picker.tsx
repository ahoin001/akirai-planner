"use client";

import type React from "react";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";

interface DateWheelPickerProps {
  options: string[];
  onChange: (value: string, index: number) => void;
  itemHeight?: number;
  visibleItems?: number;
  defaultIndex?: number;
  renderOption?: (option: string, isSelected: boolean) => React.ReactNode;
}

export function DateWheelPicker({
  options,
  onChange,
  itemHeight = 50,
  visibleItems = 5,
  defaultIndex = 0,
  renderOption,
}: DateWheelPickerProps) {
  // State
  const [selectedIndex, setSelectedIndex] = useState(defaultIndex);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const latestOnChangeRef = useRef(onChange);

  // Update latest onChange ref
  useEffect(() => {
    latestOnChangeRef.current = onChange;
  }, [onChange]);

  // Initialize with default index
  useEffect(() => {
    setSelectedIndex(defaultIndex);
    scrollToIndex(defaultIndex, false);
  }, [defaultIndex]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Call onChange when selectedIndex changes
  useEffect(() => {
    if (options[selectedIndex]) {
      latestOnChangeRef.current(options[selectedIndex], selectedIndex);
    }
  }, [selectedIndex, options]);

  // Scroll to index
  const scrollToIndex = useCallback(
    (index: number, animate: boolean) => {
      const container = containerRef.current;
      if (!container || index < 0 || index >= options.length) return;

      const targetScrollTop = index * itemHeight;

      isProgrammaticScrollRef.current = true;

      container.scrollTo({
        top: targetScrollTop,
        behavior: animate ? "smooth" : "auto",
      });

      setTimeout(
        () => {
          isProgrammaticScrollRef.current = false;
        },
        animate ? 300 : 50
      );
    },
    [itemHeight, options.length]
  );

  // Handle scroll end
  const handleScrollEnd = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const calculatedIndex = Math.round(scrollTop / itemHeight);
    const safeIndex = Math.max(
      0,
      Math.min(calculatedIndex, options.length - 1)
    );

    setSelectedIndex((prevIndex) => {
      if (safeIndex !== prevIndex) {
        return safeIndex;
      }
      return prevIndex;
    });
  }, [itemHeight, options.length]);

  // Handle scroll with debounce
  const handleScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      handleScrollEnd();
    }, 150);
  }, [handleScrollEnd]);

  // Handle option click
  const handleOptionClick = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      scrollToIndex(index, true);
    },
    [scrollToIndex]
  );

  // Render options with padding
  const renderOptions = useMemo(() => {
    const paddingCount = Math.floor(visibleItems / 2);

    const paddingTop = (
      <li
        key="pad-top"
        style={{ height: `${paddingCount * itemHeight}px` }}
        aria-hidden="true"
      />
    );

    const paddingBottom = (
      <li
        key="pad-bottom"
        style={{ height: `${paddingCount * itemHeight}px` }}
        aria-hidden="true"
      />
    );

    const items = options.map((option, index) => {
      const isSelected = selectedIndex === index;
      const distance = Math.abs(selectedIndex - index);
      const opacity = isSelected ? 1 : Math.max(0.3, 1 - distance * 0.25);
      const scale = isSelected ? 1 : Math.max(0.85, 1 - distance * 0.08);

      return (
        <li
          key={index}
          role="option"
          aria-selected={isSelected}
          id={`option-${index}`}
          className={cn(
            "flex items-center justify-center text-center transition-all duration-200 ease-out select-none snap-center",
            isSelected ? "text-rose-400 font-medium" : "text-gray-400"
          )}
          style={{
            height: `${itemHeight}px`,
            cursor: "pointer",
            opacity,
            transform: `scale(${scale})`,
          }}
          onClick={() => handleOptionClick(index)}
        >
          {renderOption ? renderOption(option, isSelected) : option}
        </li>
      );
    });

    return [paddingTop, ...items, paddingBottom];
  }, [
    options,
    selectedIndex,
    itemHeight,
    visibleItems,
    handleOptionClick,
    renderOption,
  ]);

  return (
    <div
      className="relative w-full"
      style={{ height: `${itemHeight * visibleItems}px` }}
    >
      {/* Selection Indicator */}
      <div
        className="absolute w-full border-t border-b border-gray-700 pointer-events-none z-10"
        style={{
          top: "50%",
          left: 0,
          height: `${itemHeight}px`,
          transform: "translateY(-50%)",
        }}
        aria-hidden="true"
      />

      {/* Scrollable Container */}
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-auto snap-y snap-mandatory scrollbar-hide"
        style={{
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          scrollBehavior: "auto",
          maskImage:
            "linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)",
        }}
        onScroll={handleScroll}
        role="listbox"
        aria-activedescendant={`option-${selectedIndex}`}
        tabIndex={0}
      >
        <ul className="flex flex-col items-center">{renderOptions}</ul>
      </div>
    </div>
  );
}
