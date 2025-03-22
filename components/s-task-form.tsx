"use client";

import dayjs from "dayjs";
import { useEffect, useState, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";

import { Button } from "@/components/ui/button";
import { Dumbbell, CalendarIcon, ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/segmented-control";
import { WheelPicker } from "@/components/wheel-picker";

import { createTaskAction, updateTask } from "@/app/actions";

import { ResponsiveCalendar } from "@/components/responsive-calendar";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  start_date: z.any(),
  start_time: z.string().min(1, "Start time is required"),
  duration_minutes: z.number().min(1, "Duration is required"),
  frequency: z.string().min(1, "Frequency is required"),
});

type TaskFormValues = z.infer<typeof formSchema>;

interface CreateTaskProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues?: Partial<TaskFormValues> & { id?: string };
  isEditing?: boolean;
  selectedDate?: Date;
  setSelectedDate?: (date: Date) => void;
}

const durationOptions = [
  { label: "1m", value: "1" },
  { label: "15m", value: "15" },
  { label: "30m", value: "30" },
  { label: "45m", value: "45" },
  { label: "1h", value: "60" },
  { label: "1.5h", value: "90" },
];

const frequencyOptions = [
  { label: "Once", value: "once" },
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

const timeSlots = Array.from({ length: (23 - 9) * 4 + 1 }, (_, i) => {
  const hour = 9 + Math.floor(i / 4);
  const minute = (i % 4) * 15;

  return dayjs()
    .hour(hour)
    .minute(minute)
    .second(0)
    .millisecond(0)
    .format("h:mm A");
});

/**
 * Task Form Component
 *
 * A form for creating or editing tasks.
 * Uses React Hook Form with Zod validation.
 */
export function TaskForm({
  isOpen,
  onOpenChange,
  initialValues,
  isEditing = false,
  selectedDate,
}: CreateTaskProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  console.log("Initial values form v 1:", initialValues);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
    setValue,
  } = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "testing",
      start_date: selectedDate,
      frequency: "once",
      start_time: "11:00",
      duration_minutes: 30,
      // ...initialValues,
    },
  });

  const itemHeight = 50;
  const formDate = watch("start_date");

  // Reset form when opened or when initialValues change
  useEffect(() => {
    console.log("effect");
    console.log("effect");
    if (isOpen)
      reset({
        title: "",
        start_date: selectedDate,
        // start_date: initialValues?.start_date
        //   ? dayjs(initialValues?.start_date).toDate()
        //   : selectedDate,
        frequency: "once",
        start_time: "11:00",
        duration_minutes: 30,
        ...initialValues,
      });
  }, [isOpen, initialValues, reset, selectedDate]);

  const onSubmit = async (data: TaskFormValues) => {
    console.log("Form :");
    console.log("Form data:", data);
    try {
      const payload = {
        title: data.title,
        start_date: dayjs(data.start_date).format("YYYY-MM-DD"),
        start_time: data.start_time,
        duration_minutes: data.duration_minutes,
        recurrence:
          data.frequency === "once"
            ? null
            : {
                frequency: data.frequency,
                interval: 1, // TODO implement such as if daily, interval would be every X days
                endType: "never", // TODO Implement an end for recurrence
              },
        is_recurring: data.frequency !== "once",
      };

      console.log("FORM: ", payload);

      if (isEditing && initialValues?.id) {
        // Update existing task
        const result = await updateTask(initialValues.id, payload);
        // console.log("Updated task:", result);
      } else {
        // Create new task
        const result = await createTaskAction(payload as any);
        console.log("Created task:", result);
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Submission error:", error);
    }
  };

  const handleDateSelect = (start_date: Date) => {
    setValue("start_date", start_date);
    setIsCalendarOpen(false);
  };

  const handleCalendarClick = () => {
    setIsCalendarOpen(!isCalendarOpen);
  };

  // Animation classes for calendar
  const calendarClasses = isCalendarOpen
    ? "max-h-[600px] opacity-100 transition-all duration-300 ease-in-out"
    : "max-h-0 opacity-0 transition-all duration-300 ease-in-out overflow-hidden";

  // Add this before the return statement
  console.log("Validation errors:", errors);
  console.log("Current form values:", watch());

  return (
    <>
      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          onOpenChange(open);
        }}
      >
        <SheetContent
          side="bottom"
          className="h-[90vh] rounded-t-3xl bg-drawer border-gray-800 z-[9000]"
        >
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Fixed Header */}
            <div className="flex items-center justify-between mb-8">
              <SheetTitle className="text-white text-2xl font-bold">
                {isEditing ? "Edit" : "New"}{" "}
                <span className="text-accent">Task</span>
              </SheetTitle>
              <SheetClose className="rounded-full p-2 hover:bg-gray-800">
                <span className="sr-only">Close</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-x text-white"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </SheetClose>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto h-[calc(90vh-150px)] space-y-8 pb-24">
              {/* Task Name */}
              <Controller
                name="title"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center"
                    >
                      <Dumbbell className="w-8 h-8 text-accent" />
                    </button>
                    <Input
                      {...field}
                      className="text-white text-2xl bg-transparent border-none focus-visible:ring-0 p-0 h-auto"
                      placeholder="Task name"
                    />
                    {errors.title && (
                      <span className="text-accent">
                        {errors.title.message}
                      </span>
                    )}
                  </div>
                )}
              />

              {/* Time Picker */}
              <Controller
                name="start_time"
                control={control}
                render={({ field }) => (
                  <div>
                    <h3 className="text-xl text-gray-400">When</h3>
                    <WheelPicker
                      options={timeSlots}
                      onChange={field.onChange}
                      itemHeight={itemHeight}
                      duration={watch("duration_minutes")}
                      defaultValue={
                        initialValues?.start_time
                          ? dayjs("1/1/1 " + initialValues.start_time).format(
                              "hh:mm A"
                            )
                          : "11:00 AM"
                      }
                    />
                    {errors.start_time && (
                      <span className="text-accent">
                        {errors.start_time.message}
                      </span>
                    )}

                    {/* Date selector button */}
                    <div className="flex flex-col items-center">
                      <button
                        type="button"
                        onClick={handleCalendarClick}
                        className="flex items-center gap-2 text-accent mt-4 px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        <CalendarIcon className="w-5 h-5" />
                        <span>{dayjs(formDate).format("MMMM D, YYYY")}</span>
                        {isCalendarOpen ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      {errors.start_date && (
                        <span className="text-accent">
                          {errors.start_date.message}
                        </span>
                      )}
                      {/* Expandable Calendar */}
                      <div
                        ref={calendarRef}
                        className={`${calendarClasses} w-full mt-2`}
                      >
                        <div className="rounded-lg p-4">
                          <ResponsiveCalendar
                            selected={formDate}
                            onSelect={handleDateSelect}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              />

              {/* Duration Picker */}
              <Controller
                name="duration_minutes"
                control={control}
                render={({ field }) => (
                  <div>
                    <h3 className="text-xl text-gray-400 mb-4">Duration</h3>
                    <SegmentedControl
                      data={durationOptions}
                      value={field.value.toString()}
                      onChange={(value) => field.onChange(parseInt(value, 10))}
                      fullWidth
                      fillSelected
                    />
                    {errors.duration_minutes && (
                      <span className="text-accent">
                        {errors.duration_minutes.message}
                      </span>
                    )}
                  </div>
                )}
              />

              {/* Frequency Picker (Rename to reccurrence later) */}
              <Controller
                name="frequency"
                control={control}
                render={({ field }) => (
                  <div>
                    <h3 className="text-xl text-gray-400 mb-4">How often?</h3>
                    <SegmentedControl
                      data={frequencyOptions}
                      value={field.value}
                      onChange={field.onChange}
                      fullWidth
                      fillSelected
                    />
                    {errors.frequency && (
                      <span className="text-accent">
                        {errors.frequency.message}
                      </span>
                    )}
                  </div>
                )}
              />
            </div>
            {/* Fixed Footer Button */}
            <div className="absolute bottom-0 left-0 right-0 pt-4 pb-8 px-4 z-[99]">
              <Button
                type="submit"
                className="w-full h-14 text-lg text-white font-semibold rounded-2xl bg-accent bg-rose-400 hover:bg-rose-500"
              >
                {isEditing ? "Update Task" : "Create Task"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
