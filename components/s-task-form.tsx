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
import {
  Dumbbell,
  CalendarIcon,
  ChevronUp,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/segmented-control";
import { WheelPicker } from "@/components/wheel-picker";
import DatePicker from "@/components/date-picker";
import { createTaskAction, updateTask } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  start_date: z.date(),
  start_time: z.string().min(1, "Start time is required"),
  duration_minutes: z.number().min(1, "Duration is required"),
  frequency: z.string().min(1, "Frequency is required"),
  interval: z.number().min(1).default(1),
  end_type: z.enum(["never", "after", "on"]).default("never"),
  occurrences: z.number().min(1).optional(),
  end_date: z.date().optional(),
});

type TaskFormValues = z.infer<typeof formSchema>;

interface CreateTaskProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues?: Partial<TaskFormValues> & { id?: string };
  isEditing?: boolean;
  selectedDate?: Date;
}

const durationOptions = [
  { label: "15m", value: "15" },
  { label: "30m", value: "30" },
  { label: "45m", value: "45" },
  { label: "1h", value: "60" },
  { label: "1.5h", value: "90" },
  { label: "2h", value: "120" },
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
  return dayjs().hour(hour).minute(minute).format("h:mm A");
});

export function TaskForm({
  isOpen,
  onOpenChange,
  initialValues,
  isEditing = false,
  selectedDate,
}: CreateTaskProps) {
  const { toast } = useToast();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
      title: "",
      start_date: selectedDate,
      frequency: "once",
      start_time: "11:00",
      duration_minutes: 30,
      interval: 1,
      end_type: "never",
      ...initialValues,
    },
  });

  const frequency = watch("frequency");
  const endType = watch("end_type");
  const formDate = watch("start_date");

  useEffect(() => {
    setShowRecurrenceOptions(frequency !== "once");
  }, [frequency]);

  useEffect(() => {
    if (isOpen) {
      // Ensure start_date is a proper Date object
      const startDate = initialValues?.start_date
        ? dayjs(initialValues.start_date).toDate()
        : selectedDate;
      console.log(startDate);
      reset({
        title: initialValues?.title || "",
        start_date: initialValues?.start_date ? startDate : selectedDate,
        frequency: initialValues?.frequency || "once",
        start_time: initialValues?.start_time || "11:00",
        duration_minutes: initialValues?.duration_minutes || 30,
        interval: initialValues?.interval || 1,
        end_type: initialValues?.end_type || "never",
        occurrences: initialValues?.occurrences || 10,
        end_date: initialValues?.end_date || dayjs().add(30, "day").toDate(),
      });
    }
  }, [isOpen, initialValues, reset, selectedDate]);

  const onSubmit = async (data: TaskFormValues) => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        title: data.title,
        start_date: dayjs(data.start_date).format("YYYY-MM-DD"),
        start_time: data.start_time,
        duration_minutes: data.duration_minutes,
        recurrence: {
          frequency: data.frequency,
          interval: data.interval,
          end_type: data.end_type,
          ...(data.end_type === "after" && { occurrences: data.occurrences }),
          ...(data.end_type === "on" && {
            end_date: dayjs(data.end_date).format("YYYY-MM-DD"),
          }),
        },
        is_recurring: data.frequency !== "once",
      };

      if (isEditing && initialValues?.id) {
        await updateTask(initialValues.id, payload);
        toast({
          title: "Task Updated",
          description: "Task updated successfully",
          variant: "success",
        });
      } else {
        await createTaskAction(payload);
        toast({
          title: "Task Created",
          description: "New task created successfully",
          variant: "success",
        });
      }

      onOpenChange(false);
    } catch (error: any) {
      console.error("Submission error:", error);
      setFormError(error.message || "Failed to save task");
      toast({
        title: "Error",
        description: error.message || "Failed to save task",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateSelect = (date: Date) => {
    setValue("start_date", date);
    setIsCalendarOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[90vh] rounded-t-3xl bg-drawer border-gray-800 z-[9000]"
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex items-center justify-between mb-8">
            <SheetTitle className="text-white text-2xl font-bold">
              {isEditing ? "Edit" : "New"}{" "}
              <span className="text-accent">Task</span>
            </SheetTitle>
            <SheetClose className="rounded-full p-2 hover:bg-gray-800">
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
                className="lucide lucide-x"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </SheetClose>
          </div>

          <div className="overflow-y-auto h-[calc(90vh-150px)] space-y-8 pb-24">
            {/* Task Name */}
            <Controller
              name="title"
              control={control}
              render={({ field }) => (
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center">
                    <Dumbbell className="w-8 h-8 text-accent" />
                  </div>
                  <Input
                    {...field}
                    className="text-2xl bg-transparent border-none focus-visible:ring-0 p-0 h-auto"
                    placeholder="Task name"
                  />
                  {errors.title && (
                    <span className="text-accent">{errors.title.message}</span>
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
                    itemHeight={50}
                    duration={watch("duration_minutes")}
                    defaultValue={field.value}
                  />
                  {errors.start_time && (
                    <span className="text-accent">
                      {errors.start_time.message}
                    </span>
                  )}

                  <div className="flex flex-col items-center mt-4">
                    <button
                      type="button"
                      onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                      className="flex items-center gap-2 text-accent px-4 py-2 rounded-lg hover:bg-gray-800"
                    >
                      <CalendarIcon className="w-5 h-5" />
                      <span>{dayjs(formDate).format("MMMM D, YYYY")}</span>
                      {isCalendarOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {isCalendarOpen && (
                      <div className="mt-4 bg-zinc-800 rounded-lg p-4 w-full">
                        <DatePicker
                          selectedDate={formDate}
                          onSelect={handleDateSelect}
                          onClose={() => setIsCalendarOpen(false)}
                        />
                      </div>
                    )}
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
                    onChange={(v) => field.onChange(Number(v))}
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

            {/* Frequency Picker */}
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

            {/* Recurrence Options */}
            {showRecurrenceOptions && (
              <div className="space-y-6 border-t border-gray-800 pt-6">
                <h3 className="text-xl text-gray-400">Recurrence Settings</h3>

                {/* Interval */}
                <Controller
                  name="interval"
                  control={control}
                  render={({ field }) => (
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">
                        Repeat every
                      </label>
                      <div className="flex items-center gap-2 ml-1">
                        <Input
                          type="number"
                          min="1"
                          className="w-20 bg-zinc-900/50 border-gray-700"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                        <span className="text-gray-400">
                          {frequency === "daily" && "days"}
                          {frequency === "weekly" && "weeks"}
                          {frequency === "monthly" && "months"}
                        </span>
                      </div>
                    </div>
                  )}
                />

                {/* End Type */}
                <Controller
                  name="end_type"
                  control={control}
                  render={({ field }) => (
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">
                        Ends
                      </label>
                      <SegmentedControl
                        data={[
                          { label: "Never", value: "never" },
                          { label: "After", value: "after" },
                          { label: "On Date", value: "on" },
                        ]}
                        value={field.value}
                        onChange={field.onChange}
                        fullWidth
                      />
                    </div>
                  )}
                />

                {/* Occurrences */}
                {endType === "after" && (
                  <Controller
                    name="occurrences"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <label className="text-sm text-gray-400 block mb-2">
                          Number of occurrences
                        </label>
                        <Input
                          type="number"
                          min="1"
                          className="w-full bg-gray-900 border-gray-700"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </div>
                    )}
                  />
                )}

                {/* End Date */}
                {endType === "on" && (
                  <Controller
                    name="end_date"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <label className="text-sm text-gray-400 block mb-2">
                          End Date
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsCalendarOpen(true)}
                          className="flex items-center gap-2 text-accent px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 w-full"
                        >
                          <CalendarIcon className="w-5 h-5" />
                          <span>
                            {field.value
                              ? dayjs(field.value).format("MMM D, YYYY")
                              : "Select end date"}
                          </span>
                        </button>
                      </div>
                    )}
                  />
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 pt-4 pb-8 px-4 z-[99]">
            {formError && (
              <div className="bg-red-900/20 border border-red-500 text-red-300 p-3 rounded-md mb-4">
                {formError}
              </div>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 text-lg text-white font-semibold rounded-2xl bg-rose-400 hover:bg-accent/90 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Update Task"
              ) : (
                "Create Task"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
