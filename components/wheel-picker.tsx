"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dayjs from "dayjs";

interface WheelPickerProps {
  options: string[];
  onChange: (value: string) => void;
  isMobile?: boolean;
  itemHeight?: number;
  duration?: number; // Duration in minutes (default to 30 minutes)
  defaultValue?: string; // NEW: Default selected value
}

export function WheelPicker({
  options,
  onChange,
  isMobile = false,
  itemHeight = 50,
  duration = 30, // Default to 30 minutes
  defaultValue,
}: WheelPickerProps) {
  const defaultIndex = defaultValue ? options.indexOf(defaultValue) : 0;
  const [selectedIndex, setSelectedIndex] = useState(
    defaultIndex >= 0 ? defaultIndex : 0
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);
  const velocityRef = useRef(0);
  const lastTimeRef = useRef(0);
  const targetScrollTopRef = useRef<number | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const visibleItems = 7; // Number of items visible in the picker (should be odd)

  // Detect if it's a mobile device
  const [isActuallyMobile, setIsActuallyMobile] = useState(isMobile || false);

  //Day.js was defaulting to the current day and resetting the time incorrectly, this was fix
  const getTimeRange = (index: number) => {
    if (!options[index]) return "Invalid time"; // Handle missing or undefined values

    const timeParts = options[index].split(":");
    if (timeParts.length !== 2) return "Invalid time"; // Ensure format is correct

    const startHour = parseInt(timeParts[0], 10);
    const startMinute = parseInt(timeParts[1], 10);

    // Ensure the time is set correctly without defaulting to AM
    let startTime = dayjs()
      .set("hour", startHour)
      .set("minute", startMinute)
      .set("second", 0);

    // Ensure the correct PM time is applied (if applicable)
    if (startHour < 12 && options[index].includes("PM")) {
      startTime = startTime.add(12, "hour"); // Convert 1PM-11PM correctly
    }

    const endTime = startTime.add(duration, "minute");

    return `${startTime.format("h:mm A")} - ${endTime.format("h:mm A")}`;
  };

  // Create a passive touch detection on component mount
  useEffect(() => {
    const detectTouch = () => {
      setIsActuallyMobile(true);
      window.removeEventListener("touchstart", detectTouch);
    };

    if (!isMobile) {
      window.addEventListener("touchstart", detectTouch, { passive: true });
    }

    return () => {
      window.removeEventListener("touchstart", detectTouch);
    };
  }, [isMobile]);

  // Update the onChange callback when selected index changes
  useEffect(() => {
    const selectedTime = options[selectedIndex];
    const formattedTime = dayjs(`2000-01-01 ${selectedTime}`).format("HH:mm");

    onChange(formattedTime);
  }, [selectedIndex, onChange, options]);

  // Scroll to  selected item on mount
  useEffect(() => {
    if (containerRef.current) {
      setTimeout(() => {
        scrollToIndex(selectedIndex, false);
      }, 0);
    }
  }, [options, selectedIndex]);

  // Update selectedIndex when defaultValue changes
  useEffect(() => {
    if (defaultValue && options.includes(defaultValue)) {
      const newIndex = options.indexOf(defaultValue);
      setSelectedIndex(newIndex);
      scrollToIndex(newIndex, false);
    }
  }, []);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const scrollToIndex = useCallback(
    (index: number, animate = true) => {
      if (containerRef.current) {
        const targetScrollTop = index * itemHeight;

        if (!animate) {
          // Instant scroll
          containerRef.current.scrollTop = targetScrollTop;
          return;
        }

        // Set flag to indicate this is a programmatic scroll
        isProgrammaticScrollRef.current = true;

        if (isActuallyMobile) {
          // Custom animation for mobile
          // Set the target for smooth animation
          targetScrollTopRef.current = targetScrollTop;

          // Cancel any ongoing animation
          if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
          }

          // Start the smooth animation
          const startTime = performance.now();
          const startScrollTop = containerRef.current.scrollTop;
          const distance = targetScrollTop - startScrollTop;
          const duration = 300;

          const animateScroll = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function for smoother animation (ease-out cubic)
            const eased = 1 - Math.pow(1 - progress, 3);

            if (containerRef.current) {
              scrollingRef.current = true;
              containerRef.current.scrollTop =
                startScrollTop + distance * eased;

              if (progress < 1) {
                animationFrameRef.current =
                  requestAnimationFrame(animateScroll);
              } else {
                // Animation completed
                setTimeout(() => {
                  scrollingRef.current = false;
                  targetScrollTopRef.current = null;
                  isProgrammaticScrollRef.current = false;
                }, 50);
              }
            }
          };

          animationFrameRef.current = requestAnimationFrame(animateScroll);
        } else {
          // Use browser's native smooth scrolling for desktop
          scrollingRef.current = true;

          containerRef.current.scrollTo({
            top: targetScrollTop,
            behavior: "smooth",
          });

          // Reset flags after animation is likely complete
          setTimeout(() => {
            scrollingRef.current = false;
            isProgrammaticScrollRef.current = false;
          }, 300);
        }
      }
    },
    [itemHeight, isActuallyMobile]
  );

  const handleScrollEnd = useCallback(() => {
    if (!containerRef.current) return;

    const scrollTop = containerRef.current.scrollTop;
    const newIndex = Math.round(scrollTop / itemHeight);

    // Ensure the new index is within bounds
    const safeIndex = Math.max(0, Math.min(newIndex, options.length - 1));

    if (safeIndex !== selectedIndex) {
      setSelectedIndex(safeIndex);
    }

    // Snap to the nearest item
    if (Math.abs(scrollTop - safeIndex * itemHeight) > 1) {
      scrollToIndex(safeIndex);
    }
  }, [itemHeight, options.length, scrollToIndex, selectedIndex]);

  const handleScroll = useCallback(() => {
    // Skip processing during programmatic scrolls
    if (!containerRef.current || isProgrammaticScrollRef.current) return;

    const currentScrollTop = containerRef.current.scrollTop;

    // For mobile, track velocity for momentum scrolling
    if (isActuallyMobile) {
      const currentTime = performance.now();

      // Calculate velocity for mobile momentum scrolling
      if (lastTimeRef.current) {
        const deltaTime = currentTime - lastTimeRef.current;
        if (deltaTime > 0) {
          const deltaY = currentScrollTop - lastScrollTopRef.current;
          velocityRef.current =
            0.7 * velocityRef.current + 0.3 * (deltaY / deltaTime) * 16.67;
        }
      }

      lastScrollTopRef.current = currentScrollTop;
      lastTimeRef.current = currentTime;

      // Mobile momentum scrolling
      clearTimeout(animationFrameRef.current as unknown as number);
      animationFrameRef.current = setTimeout(() => {
        if (Math.abs(velocityRef.current) > 0.5 && isActuallyMobile) {
          applyMomentum();
        } else {
          handleScrollEnd();
        }
      }, 50) as unknown as number;
    } else {
      // Desktop scrolling - just a simple debounce for snapping
      clearTimeout(animationFrameRef.current as unknown as number);
      animationFrameRef.current = setTimeout(() => {
        handleScrollEnd();
      }, 150) as unknown as number;
    }

    // Update the selected index while scrolling
    const newIndex = Math.round(currentScrollTop / itemHeight);
    if (
      newIndex >= 0 &&
      newIndex < options.length &&
      newIndex !== selectedIndex
    ) {
      setSelectedIndex(newIndex);
    }
  }, [
    handleScrollEnd,
    itemHeight,
    options.length,
    selectedIndex,
    isActuallyMobile,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  const applyMomentum = useCallback(() => {
    if (!containerRef.current || !isActuallyMobile) return;

    // Physics-based deceleration
    const friction = 0.92;
    velocityRef.current *= friction;

    containerRef.current.scrollTop += velocityRef.current;

    if (Math.abs(velocityRef.current) > 0.5) {
      animationFrameRef.current = requestAnimationFrame(applyMomentum);
    } else {
      handleScrollEnd();
    }
  }, [handleScrollEnd, isActuallyMobile]);

  const handleWheel = (event: React.WheelEvent) => {
    // For desktop, we want to let the browser handle the scrolling naturally
    if (!isActuallyMobile) return;

    // Only apply custom wheel behavior on mobile
    event.preventDefault();

    if (!containerRef.current) return;

    // Cancel any ongoing animation
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clear target scroll top
    targetScrollTopRef.current = null;

    // Apply delta with small factor for mobile
    const scrollFactor = 0.1;
    const delta = event.deltaY * scrollFactor;

    // Update scroll position
    containerRef.current.scrollTop += delta;

    // Update velocity for momentum
    const now = performance.now();
    velocityRef.current = 0.6 * velocityRef.current + 0.4 * delta;
    lastTimeRef.current = now;
    lastScrollTopRef.current = containerRef.current.scrollTop;

    // Debounce for scroll end
    clearTimeout(animationFrameRef.current as unknown as number);
    animationFrameRef.current = setTimeout(() => {
      if (Math.abs(velocityRef.current) > 0.5) {
        animationFrameRef.current = requestAnimationFrame(applyMomentum);
      } else {
        handleScrollEnd();
      }
    }, 100) as unknown as number;
  };

  // Handle direct click on an option
  const handleOptionClick = (index: number) => {
    setSelectedIndex(index);
    scrollToIndex(index);
  };

  const renderOptions = () => {
    const paddingItems = Math.floor(visibleItems / 2);

    // Create padding elements
    const paddingTop = (
      <li
        key="padding-top"
        style={{ height: `${paddingItems * itemHeight}px` }}
      ></li>
    );
    const paddingBottom = (
      <li
        key="padding-bottom"
        style={{ height: `${paddingItems * itemHeight}px` }}
      ></li>
    );

    const optionElements = options.map((option, index) => (
      <li
        key={index}
        className={`flex items-center justify-center text-center transition-all duration-300 select-none snap-center ${
          selectedIndex === index ? "text-white font-bold" : "text-gray-500"
        }`}
        style={{
          height: `${itemHeight}px`,
          cursor: "pointer",
          opacity:
            selectedIndex === index
              ? 1
              : Math.max(0.5, 1 - Math.abs(selectedIndex - index) * 0.2),
        }}
        onClick={() => handleOptionClick(index)}
      >
        {selectedIndex === index ? getTimeRange(index) : option}
      </li>
    ));

    return [paddingTop, ...optionElements, paddingBottom];
  };

  return (
    <div
      className="relative w-full"
      style={{ height: `${itemHeight * visibleItems}px` }}
    >
      {/* Selection indicator */}
      <div
        className="absolute w-1/2 bg-rose-400 rounded-lg pointer-events-none z-0 opacity-80"
        style={{
          top: "50%",
          left: "50%",
          height: `${itemHeight}px`,
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Main scrollable container */}
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-auto snap-y snap-mandatory"
        style={{
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          scrollBehavior: isActuallyMobile ? "auto" : "smooth",
          maskImage:
            "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
          msOverflowStyle: "none",
          scrollbarWidth: "none",
        }}
        onWheel={isActuallyMobile ? handleWheel : undefined}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <ul className="flex flex-col items-center">{renderOptions()}</ul>
      </div>
    </div>
  );
}
