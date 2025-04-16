"use client";

import { Popover } from "@headlessui/react";
import {
  Activity,
  AlarmClock,
  Book,
  CalendarIcon,
  Check,
  ChevronUp,
  ChevronDown,
  Dumbbell,
  Flag,
  Heart,
  Home,
  Loader2,
  Package,
  Rocket,
  Settings,
  ShoppingCart,
  Star,
  Target,
  Timer,
  Trash,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const allowedIcons = {
  Activity,
  AlarmClock,
  Book,
  CalendarIcon,
  Check,
  // ChevronUp,
  // ChevronDown,
  Dumbbell,
  Flag,
  Heart,
  Home,
  Loader2,
  Package,
  Rocket,
  Settings,
  ShoppingCart,
  Star,
  Target,
  Timer,
  Trash,
  Trophy,
  Users,
  // X,
  Zap,
};

type IconName = keyof typeof allowedIcons;
const iconList = Object.entries(allowedIcons).map(([name, Component]) => ({
  name,
  Component,
}));

export function IconPicker({ value, onChange, className }) {
  const SelectedIcon = allowedIcons[value as IconName] || Dumbbell;

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <Popover.Button
            as={Button}
            variant="outline"
            size="icon"
            className={cn(
              "w-12 h-12 text-primary rounded-xl hover:text-primary sm:w-14 sm:h-14 sm:rounded-2xl",
              "bg-gray-800 hover:bg-gray-700",
              "focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
              className
            )}
          >
            <SelectedIcon className="w-6 h-6 sm:w-7 sm:h-7" />
          </Popover.Button>

          <Popover.Panel className="absolute z-[60] w-80 p-2 bg-zinc-800 border border-gray-700 rounded-lg shadow-xl">
            <div className="overflow-y-auto h-30">
              {" "}
              {/* Native scrolling */}
              <div className="grid grid-cols-6 gap-2 p-2">
                {iconList.map(({ name, Component }) => (
                  <Button
                    key={name}
                    variant="ghost"
                    type="button" //
                    size="icon"
                    className={`hover:bg-zinc-700 hover:text-primary rounded-md p-2 ${
                      value === name
                        ? "bg-primary-600 text-primary"
                        : "text-gray-400"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent event bubbling
                      e.preventDefault(); // Prevent default form action
                      onChange(name);
                    }}
                  >
                    <Component className="w-5 h-5" />
                  </Button>
                ))}
              </div>
            </div>
          </Popover.Panel>
        </>
      )}
    </Popover>
  );
}
