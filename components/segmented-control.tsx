"use client";
import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SegmentedControlProps {
  data: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  fullWidth?: boolean;
  className?: string;
  fillSelected?: boolean;
}

export const SegmentedControl = React.forwardRef<
  HTMLDivElement,
  SegmentedControlProps
>(function SegmentedControl(props, ref) {
  const {
    data,
    value,
    onChange,
    onBlur,
    fullWidth = false,
    className,
    fillSelected = false,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = data.findIndex((item) => item.value === value);

  // Track sliding background position and width
  const [backgroundStyle, setBackgroundStyle] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const updateBackgroundPosition = () => {
    if (selectedIndex < 0 || !containerRef.current) return;

    const container = containerRef.current;
    const selectedButton = buttonRefs.current[selectedIndex];

    if (!selectedButton) return;

    const containerRect = container.getBoundingClientRect();
    const buttonRect = selectedButton.getBoundingClientRect();

    setBackgroundStyle({
      left: buttonRect.left - containerRect.left,
      width: buttonRect.width,
      opacity: 1,
    });
  };

  // Update background position when selection changes
  useEffect(() => {
    updateBackgroundPosition();
    const timer = setTimeout(() => {
      // Clear any transition after initial animation
      setBackgroundStyle((prev) => ({ ...prev, transition: "none" }));
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedIndex, value]);

  // Initialize background on first render
  useEffect(() => {
    updateBackgroundPosition();
  }, []);

  // Progressive fill style calculation
  const getFillStyle = () => {
    if (!fillSelected) return { opacity: 0 };

    return {
      left: 4,
      top: 4,
      bottom: 4,
      width: backgroundStyle.left + backgroundStyle.width - 4,
      opacity: backgroundStyle.opacity,
    };
  };

  return (
    <div
      ref={(node) => {
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
        containerRef.current = node;
      }}
      className={cn(
        "inline-flex rounded-lg bg-zinc-900/50 p-1 relative overflow-hidden",
        fullWidth && "w-full",
        className
      )}
    >
      {/* Sliding background */}
      <div
        className="absolute z-0 bg-rose-400/90 rounded-md transition-all duration-300 ease-out"
        style={{
          ...backgroundStyle,
          top: 4,
          bottom: 4,
        }}
      />

      {/* Progressive fill effect */}
      {fillSelected && (
        <div
          className="absolute z-0 bg-rose-950/60 rounded-md transition-all duration-300 ease-out"
          style={getFillStyle()}
        />
      )}

      {data.map((item, index) => (
        <Button
          key={item.value}
          ref={(el) => {
            buttonRefs.current[index] = el;
          }}
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "flex-1 py-8 rounded-md relative z-10 transition-colors hover:text-white",
            item.value === value
              ? "text-white shadow-sm bg-rose-400 hover:bg-rose-500"
              : "text-white hover:bg-rose-400/10",
            "border-0"
          )}
          onClick={() => {
            onChange(item.value);
            onBlur?.();
          }}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
});

SegmentedControl.displayName = "SegmentedControl";
