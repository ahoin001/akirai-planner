"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import dayjs from "dayjs";

interface WheelPickerProps {
  options: string[];
  onChange: (value: string) => void;
  isMobile?: boolean;
  itemHeight?: number;
  duration?: number; // Duration in minutes (default to 30 minutes)
  defaultValue?: string; // NEW: Default selected value
}

// Helper type for clarity
type TimeoutId = ReturnType<typeof setTimeout> | null;

const VISIBLE_ITEMS = 7; // Number of items visible (should be odd)
const SCROLL_END_DEBOUNCE_MS = 150; // Debounce time for scroll end detection

export function WheelPicker({
  options,
  onChange,
  isMobile = false,
  itemHeight = 20,
  duration = 30, // Default to 30 minutes
  defaultValue,
}: WheelPickerProps) {
  // --- State ---
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isActuallyMobile, setIsActuallyMobile] = useState(isMobile); // State for detected mobile status

  // --- Refs ---
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<TimeoutId>(null); // For debouncing scroll end
  const isProgrammaticScrollRef = useRef(false); // To ignore scroll events during programmatic scroll
  const latestOnChangeRef = useRef(onChange); // Keep track of the latest onChange without causing effect re-runs
  const latestOptionsRef = useRef(options); // Keep track of latest options

  // --- Memoized Initial Index ---
  // Calculate initial index only when defaultValue or options change
  const initialIndex = useMemo(() => {
    if (!defaultValue || !options || options.length === 0) return 0;
    const formattedDefaultValue = dayjs(
      `2000-01-01 ${defaultValue}`,
      "YYYY-MM-DD HH:mm"
    ).format("h:mm A");
    const index = options.indexOf(formattedDefaultValue);
    return index >= 0 ? index : 0;
  }, [defaultValue, options]);

  // --- Effects ---

  // Update latest refs
  useEffect(() => {
    latestOnChangeRef.current = onChange;
    latestOptionsRef.current = options;
  }, [onChange, options]);

  // Initialize selectedIndex based on initialIndex prop
  // This runs once or when initialIndex calculation changes
  useEffect(() => {
    setSelectedIndex(initialIndex);
  }, [initialIndex]);

  // Detect touch device on mount if not explicitly mobile
  useEffect(() => {
    let detected = false;
    const detectTouch = () => {
      if (!detected) {
        detected = true;
        setIsActuallyMobile(true);
        window.removeEventListener("touchstart", detectTouch);
      }
    };
    if (!isMobile && typeof window !== "undefined") {
      window.addEventListener("touchstart", detectTouch, { passive: true });
      return () => window.removeEventListener("touchstart", detectTouch);
    } else if (isMobile) {
      setIsActuallyMobile(true); // Respect prop if true
    }
  }, [isMobile]); // Only depends on the initial prop value

  // Effect to call onChange when selectedIndex changes
  useEffect(() => {
    const currentOptions = latestOptionsRef.current;
    if (currentOptions && currentOptions[selectedIndex]) {
      const selectedTimeOption = currentOptions[selectedIndex];
      const formatToParse = "h:mm A"; // The format of strings in the options array
      const formatToSend = "HH:mm"; // The format required by the parent component

      // Parse the option string and format it correctly
      const parsedTime = dayjs(
        `2000-01-01 ${selectedTimeOption}`,
        `YYYY-MM-DD ${formatToParse}`
      );

      if (parsedTime.isValid()) {
        const formattedTimeForParent = parsedTime.format(formatToSend);
        // Use the ref to call the latest onChange without adding it as a dependency
        latestOnChangeRef.current(formattedTimeForParent);
      } else {
        console.warn(
          `WheelPicker: Could not parse option "${selectedTimeOption}" at index ${selectedIndex}`
        );
      }
    }
  }, [selectedIndex]); // Only trigger when selectedIndex changes

  // Effect to scroll to the selected index when it changes programmatically
  // or when the initialIndex causes the first valid state update
  useEffect(() => {
    // Scroll instantly on initial load based on derived initialIndex
    // Subsequent changes might be animated if triggered by user interaction (handled elsewhere)
    // Or instant if triggered by defaultValue prop change (handled by scrollToIndex below)
    scrollToIndex(selectedIndex, false); // Scroll instantly when state initializes/syncs
  }, [selectedIndex]); // Runs when selectedIndex state is finally set

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // --- Callbacks ---

  // Scroll the container to a specific index
  const scrollToIndex = useCallback(
    (index: number, animate: boolean) => {
      const container = containerRef.current;
      const currentOptions = latestOptionsRef.current;
      if (!container || index < 0 || index >= currentOptions.length) return;

      const targetScrollTop = index * itemHeight;

      // Prevent scroll handler from interfering during programmatic scroll
      isProgrammaticScrollRef.current = true;

      // Use native smooth scrolling on desktop, allow JS animation on mobile (optional)
      // Or just use instant scroll always for simplicity from programmatic changes
      const behavior = animate && !isActuallyMobile ? "smooth" : "auto"; // 'smooth' on desktop if animated, else instant

      container.scrollTo({
        top: targetScrollTop,
        behavior: behavior,
      });

      // If scrolling instantly ('auto'), the scroll event might not fire reliably or might be async.
      // We need to ensure the programmatic scroll flag is reset *after* the scroll completes.
      // Using a small timeout is a common way to handle this.
      // For native 'smooth', the timeout needs to be longer.
      const resetFlagTimeout = behavior === "smooth" ? 300 : 50; // Longer for smooth scroll animation
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, resetFlagTimeout);
    },
    [itemHeight, isActuallyMobile]
  ); // Dependencies needed for calculation/behavior

  // Handle the end of a scroll action (debounce)
  const handleScrollEnd = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentOptions = latestOptionsRef.current;
    const scrollTop = container.scrollTop;
    const calculatedIndex = Math.round(scrollTop / itemHeight);
    const safeIndex = Math.max(
      0,
      Math.min(calculatedIndex, currentOptions.length - 1)
    );

    // Check if the final index differs from the current state
    setSelectedIndex((prevIndex) => {
      if (safeIndex !== prevIndex) {
        // Snap to the final position if necessary (usually handled by CSS snap, but good fallback)
        // Use non-animated scroll for snapping to avoid triggering more events
        const targetScrollTop = safeIndex * itemHeight;
        if (Math.abs(scrollTop - targetScrollTop) > 1) {
          // No need to call scrollToIndex here if setSelectedIndex triggers the effect
          // scrollToIndex(safeIndex, false);
          // Let the useEffect hook handle the scroll correction based on state change
        }
        return safeIndex; // Update the state
      }
      return prevIndex; // No change needed
    });
  }, [itemHeight]); // itemHeight needed for calculation

  // Handle the scroll event (debounced)
  const handleScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) {
      // Ignore scroll events triggered by scrollToIndex
      return;
    }

    // Clear any existing debounce timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set a new timeout to trigger handleScrollEnd after scrolling stops
    scrollTimeoutRef.current = setTimeout(() => {
      handleScrollEnd();
    }, SCROLL_END_DEBOUNCE_MS);
  }, [handleScrollEnd]); // Depends on handleScrollEnd

  // Handle click on an option item
  const handleOptionClick = useCallback(
    (index: number) => {
      setSelectedIndex((prevIndex) => {
        if (index !== prevIndex) {
          scrollToIndex(index, true); // Animate scroll on direct click
          return index; // Update state
        }
        return prevIndex; // No change
      });
    },
    [scrollToIndex]
  );

  // Format time range for the selected item display
  const getTimeRange = useCallback(
    (index: number): string => {
      const currentOptions = latestOptionsRef.current;
      if (!currentOptions || !currentOptions[index]) return "Invalid time";

      const startTime = dayjs(
        `2000-01-01 ${currentOptions[index]}`,
        "YYYY-MM-DD h:mm A"
      );
      if (!startTime.isValid()) return "Invalid format";

      const endTime = startTime.add(duration, "minute");
      return `${startTime.format("h:mm A")} - ${endTime.format("h:mm A")}`;
    },
    [duration]
  ); // Depends on duration prop

  // --- Render ---

  const renderOptions = useMemo(() => {
    const paddingCount = Math.floor(VISIBLE_ITEMS / 2);
    const paddingTop = (
      <li
        key="pad-top"
        style={{ height: `${paddingCount * itemHeight}px` }}
        aria-hidden="true"
      ></li>
    );
    const paddingBottom = (
      <li
        key="pad-bottom"
        style={{ height: `${paddingCount * itemHeight}px` }}
        aria-hidden="true"
      ></li>
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
          id={`option-${index}`} // ID for aria-activedescendant
          className={`flex items-center justify-center text-center transition-opacity duration-200 ease-out select-none snap-center ${
            isSelected ? "text-white font-bold" : "text-gray-400"
          }`}
          style={{
            height: `${itemHeight}px`,
            cursor: "pointer",
            opacity: opacity,
            transform: `scale(${scale})`,
            transition: "opacity 0.2s ease-out, transform 0.2s ease-out", // Added transform transition
          }}
          onClick={() => handleOptionClick(index)}
        >
          {isSelected ? getTimeRange(index) : option}
        </li>
      );
    });

    return [paddingTop, ...items, paddingBottom];
  }, [options, selectedIndex, itemHeight, handleOptionClick, getTimeRange]); // Dependencies for rendering options

  return (
    <div
      className="relative w-full"
      style={{ height: `${itemHeight * VISIBLE_ITEMS}px` }}
    >
      {/* Selection Indicator */}
      <div
        className="absolute w-full bg-rose-400/50 rounded-lg pointer-events-none z-0"
        style={{
          top: "50%",
          left: "50%",
          height: `${itemHeight}px`,
          transform: "translate(-50%, -50%)",
          transition: "background-color 0.3s ease",
        }}
        aria-hidden="true"
      />

      {/* Scrollable Container */}
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-auto snap-y snap-mandatory no-scrollbar"
        style={{
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          // Let JS handle scroll behavior for programmatic scrolls
          scrollBehavior: "auto", // Native smooth scrolling often fights with snapping/JS
          maskImage:
            "linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)",
        }}
        onScroll={handleScroll} // Attach the debounced scroll handler
        role="listbox"
        aria-activedescendant={`option-${selectedIndex}`}
        tabIndex={0} // Make focusable
      >
        {/* Hide scrollbar visually */}
        <style jsx>{`
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
        <ul className="flex flex-col items-center">{renderOptions}</ul>
      </div>
    </div>
  );
}
