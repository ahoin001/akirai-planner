"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Dumbbell,
  CalendarIcon,
  ChevronUp,
  ChevronDown,
  Loader2,
  X,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import DatePicker from "@/components/date-picker";
import { IconPicker } from "@/components/icon-picker";
import { SegmentedControl } from "@/components/segmented-control";
import { WheelPicker } from "@/components/wheel-picker";

import {
  createTaskAction,
  updateTaskDefinitionAction,
  modifyTaskOccurrenceAction,
} from "@/app/actions";

import { useTaskStore } from "@/app/stores/useTaskStore";
import { toast } from "react-hot-toast";

import { RecurrenceActionModal } from "./modals/recurrence-action-modal";
import DatePickerSheet from "@/components/date-picker-sheet";

// Extend Dayjs
dayjs.extend(utc);
dayjs.extend(timezone);

const formSchema = z
  .object({
    // Core Fields
    title: z.string().min(1, "Title is required"),
    // icon: z.enum(["education", "fitness", "busy", "rest"]),
    start_date: z.date({ required_error: "Start date is required" }),
    start_time: z
      .string()
      .min(1, "Start time is required")
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
        message: "Time must be in 24-hour HH:mm format",
      }),
    duration_minutes: z
      .number({
        required_error: "Duration required",
        invalid_type_error: "Duration must be a number",
      })
      .min(1, "Duration must be at least 1 minute"),

    // Recurrence Fields
    frequency: z.enum(["once", "daily", "weekly", "monthly"], {
      required_error: "Frequency is required",
    }),
    interval: z.number().min(1, "Interval must be at least 1").optional(),
    end_type: z.enum(["never", "after", "on"]).optional(),
    occurrences: z.number().min(1, "Must occur at least once").optional(),
    end_date: z.date().optional(),

    // Hidden fields for edit context
    _isExceptionEdit: z.boolean().optional().default(false),
    _taskId: z.string().optional(),
    _originalOccurrenceTimeUTC: z.string().optional(),
    _exceptionId: z.string().optional(),
  })

  // --- Refinements for conditional validation ---
  .refine(
    (data) =>
      data.frequency === "once" ||
      (data.interval !== undefined && data.interval >= 1),
    {
      message: "Interval required & must be >= 1 for recurring",
      path: ["interval"],
    }
  )
  .refine((data) => data.frequency === "once" || data.end_type !== undefined, {
    message: "End type required for recurring",
    path: ["end_type"],
  })
  .refine(
    (data) =>
      !(
        data.frequency !== "once" &&
        data.end_type === "after" &&
        (!data.occurrences || data.occurrences < 1)
      ),
    {
      message: "Occurrences required when ending 'after'",
      path: ["occurrences"],
    }
  )
  .refine(
    (data) =>
      !(data.frequency !== "once" && data.end_type === "on" && !data.end_date),
    {
      message: "End date required when ending 'on'",
      path: ["end_date"],
    }
  )
  .refine(
    (data) =>
      !(
        data.frequency !== "once" &&
        data.end_type === "on" &&
        data.end_date &&
        dayjs(data.end_date).isBefore(dayjs(data.start_date), "day")
      ),
    {
      message: "End date cannot be before start date",
      path: ["end_date"],
    }
  );

// --- UI Options ---
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
// ---

export function TaskForm({ selectedDate }) {
  const {
    isTaskFormOpen: isOpen,
    isEditingTask: isEditing,
    taskFormValues: initialValues,
    closeTaskForm: closeForm,
    tasks,
  } = useTaskStore();

  const [formError, setFormError] = useState(null);
  const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false); // Unified visibility state
  const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [scopeActionType, setScopeActionType] = useState(null); // 'modify' or 'delete' (for modal text context)
  const [selectedScopeOption, setSelectedScopeOption] = useState(null); // 'single', 'future', 'all' (set by modal clicks)
  const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);

  // --- React Hook Form Setup ---
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
    setValue,
    trigger,
  } = useForm({ resolver: zodResolver(formSchema) });

  // Watch relevant fields
  const frequency = watch("frequency");
  const endType = watch("end_type");
  const formStartDate = watch("start_date");
  const isExceptionEditMode = watch("_isExceptionEdit");
  const taskIdToEdit = watch("_taskId"); // From initialValues if editing

  // Time slots (Ensure HH:mm format)
  const timeSlots = useMemo(() => {
    return Array.from({ length: (23 - 9) * 4 + 1 }, (_, i) => {
      const hour = 9 + Math.floor(i / 4);
      const minute = (i % 4) * 15;
      return dayjs().hour(hour).minute(minute).format("h:mm A");
    });
  }, []);

  // --- Effects ---

  // Show/hide recurrence section
  useEffect(() => {
    const show = frequency !== "once" && !isExceptionEditMode;
    setShowRecurrenceOptions(show);
    if (!show && frequency !== "once") {
      setValue("interval", undefined);
      setValue("end_type", undefined);
      setValue("occurrences", undefined);
      setValue("end_date", undefined);
    }
  }, [frequency, isExceptionEditMode, setValue]);

  // Trigger validation for dependent recurrence fields
  useEffect(() => {
    if (frequency !== "once" && !isExceptionEditMode) {
      trigger(["interval", "end_type", "occurrences", "end_date"]);
    }
  }, [frequency, endType, isExceptionEditMode, trigger]);

  // Reset form when opening or initialValues change (uses store state now)
  useEffect(() => {
    if (isOpen) {
      const defaultStartDate = selectedDate
        ? dayjs(selectedDate).toDate()
        : new Date();

      const baseDefaults = {
        title: "",
        start_date: defaultStartDate,
        start_time: "09:00",
        duration_minutes: 30,
        frequency: "once",
        interval: 1,
        end_type: "never",
        occurrences: 10,
        end_date: dayjs().add(1, "month").toDate(),
        _isExceptionEdit: false,
        _taskId: undefined,
        _originalOccurrenceTimeUTC: undefined,
        _exceptionId: undefined,
      };

      const resetValues =
        initialValues && Object.keys(initialValues).length > 0
          ? {
              ...baseDefaults,
              ...initialValues,
              start_date: initialValues.start_date
                ? dayjs(initialValues.start_date).toDate()
                : defaultStartDate,
              end_date: initialValues.end_date
                ? dayjs(initialValues.end_date).toDate()
                : baseDefaults.end_date,
              start_time:
                initialValues.start_time &&
                typeof initialValues.start_time === "string" &&
                initialValues.start_time.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
                  ? initialValues.start_time
                  : baseDefaults.start_time,
              _isExceptionEdit: initialValues._isExceptionEdit === true,
              _taskId: initialValues._taskId ?? undefined,
              _originalOccurrenceTimeUTC:
                initialValues._originalOccurrenceTimeUTC ?? undefined,
              _exceptionId: initialValues._exceptionId ?? undefined,
            }
          : { ...baseDefaults, start_date: defaultStartDate }; // Ensure start_date uses prop if creating

      console.log(
        `Form Resetting (isEditing from store: ${isEditing}) with:`,
        resetValues
      );
      console.log(
        `Form Resetting (isEditing from store: ${isEditing}) with: Initial values being`,
        initialValues
      );
      reset(resetValues);
      setShowRecurrenceOptions(
        resetValues.frequency !== "once" && !resetValues._isExceptionEdit
      );
    } else {
      setFormError(null);
      setIsStartDatePickerOpen(false);
      setIsEndDatePickerOpen(false);
      setIsScopeModalOpen(false);
      setPendingPayload(null);
      setScopeActionType(null);
      setSelectedScopeOption(null);
    }
  }, [isOpen, initialValues, isEditing, reset, selectedDate]);

  const onSubmit = async (data) => {
    setFormError(null);

    // --- 1. Validate Time Format ---
    // ****** FIX: Ensure start_time is HH:mm ******
    if (!data.start_time?.match(/^([01]\d|2[0-3]):([0-5]\d)$/)) {
      // Attempt to parse h:mm A ONLY if regex fails
      const parsedTime = dayjs(data.start_time, "h:mm A");
      if (parsedTime.isValid()) {
        data.start_time = parsedTime.format("HH:mm");
        setValue("start_time", data.start_time); // Update form value if parsed
      } else {
        setFormError("Invalid start time. Please select time in HH:mm format.");
        return;
      }
    }

    // --- 2. Prepare Base Payload ---
    // These fields are common to most actions
    const guessedTimezone = dayjs.tz.guess() || "UTC";
    const basePayload = {
      title: data.title.trim(), // Trim title whitespace
      start_date: dayjs(data.start_date).format("YYYY-MM-DD"), // Format date
      start_time: data.start_time, // Use validated HH:mm time
      duration_minutes: data.duration_minutes,
      timezone: guessedTimezone, // Pass timezone for server-side dtstart calculation
    };

    // --- 3. Differentiate Logic based on Mode ---
    // Use isEditing prop and hidden form field _isExceptionEdit
    const effectiveIsEditing = isEditing || !!data._taskId; // Use store's isEditing

    if (effectiveIsEditing) {
      // --- EDIT MODE ---

      // Prepare the payload containing all form changes
      const updatePayload = {
        ...basePayload, // title, start_date, start_time, duration, timezone
        recurrence: {
          // Include recurrence fields for the action
          frequency: data.frequency,
          interval: data.interval,
          end_type: data.end_type,
          occurrences: data.occurrences,
          end_date: data.end_date
            ? dayjs(data.end_date).format("YYYY-MM-DD")
            : undefined,
        },
        // Pass context needed for 'single'/'future' scope handling in action/confirmation
        _originalOccurrenceTimeUTC: data._originalOccurrenceTimeUTC,
        _exceptionId: data._exceptionId,
        _taskId: data._taskId, // Ensure taskId is in payload if needed by action directly
      };

      // Check if the parent task (identified by _taskId) is recurring
      const parentTask = tasks.find((t) => t.id === data._taskId); // Use data._taskId
      const isParentRecurring = !!parentTask?.rrule;

      if (isParentRecurring) {
        // If parent IS recurring, save payload and SHOW SCOPE MODAL
        console.log("Editing a recurring task, showing scope modal.");
        setPendingPayload(updatePayload);
        // Action is determined *after* scope selection in handleScopeConfirm
        setScopeActionType("modify"); // Context for RecurrenceActionModal text
        setSelectedScopeOption(null); // Reset selection in modal
        setIsScopeModalOpen(true); // <<<<<<<<< OPEN SCOPE MODAL HERE
      } else {
        // If parent IS NOT recurring, update directly using updateTaskDefinitionAction
        console.log("Editing non-recurring task, executing update directly.");
        // Scope 'all' correctly updates the single task record
        await executeSubmit(updateTaskDefinitionAction, updatePayload, "all");
      }
    } else {
      // * --- CREATING NEW TASK ---
      const createPayload = {
        ...basePayload, // Title, start date/time, duration, timezone
        // Pass recurrence details object for action to parse
        recurrence: {
          frequency: data.frequency,
          // Only include recurrence details if frequency is not 'once'
          ...(data.frequency !== "once" && {
            interval: data.interval || 1, // Default interval if not set but recurring
            end_type: data.end_type || "never", // Default end_type
            ...(data.end_type === "after" && { occurrences: data.occurrences }),
            ...(data.end_type === "on" && {
              end_date: data.end_date
                ? dayjs(data.end_date).format("YYYY-MM-DD")
                : undefined,
            }),
          }),
          // Ensure frequency is always present even if 'once'
          ...(data.frequency === "once" && { frequency: "once" }),
        },
      };
      await executeSubmit(createTaskAction, createPayload, null);
    }
  };

  // Executes the actual submission
  const executeSubmit = async (action, payload, scope) => {
    // ****** Ensure closeForm is valid before proceeding ******
    if (typeof closeForm !== "function") {
      console.error("TaskForm Error: closeForm action is not available!");
      setFormError("Internal configuration error. Cannot close form.");
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);
    setFormError(null);

    try {
      console.log(
        `Executing Action ${action.name || "anonymous"} with scope: ${scope || "N/A"}`,
        payload
      );

      if (action === createTaskAction) {
        console.log("Creating task with payload:", payload);
        await action(payload);
      } else if (action === modifyTaskOccurrenceAction) {
        console.log("Modifying occurrence with payload:", payload);
        await action(payload);
      } else if (action === updateTaskDefinitionAction) {
        console.log("Updating task with payload:", payload);
        console.log("Updating task with scope:", scope);
        // Ensure taskIdToEdit is available for update definition calls
        const idToUpdate = taskIdToEdit || payload?._taskId; // Get ID from context or payload
        if (!idToUpdate)
          throw new Error("Task ID missing for definition update.");
        await action(idToUpdate, payload, scope); // Pass ID, payload, scope
      } else {
        throw new Error("Unknown action type.");
      }

      console.log(
        `Task ${isEditing ? (isExceptionEditMode ? "occurrence updated" : "updated") : "created"}!`
      );
      // toast.success(
      //   `Task ${isEditing ? (isExceptionEditMode ? "occurrence updated" : "updated") : "created"}!`
      // );
      closeForm();
    } catch (error) {
      console.error("Submission Execute Error:", error);
      const message =
        error?.message || `Failed to ${isEditing ? "update" : "create"} task.`;
      setFormError(message);
      // toast.error(message);
    } finally {
      setIsSubmitting(false);
      setIsScopeModalOpen(false);
      setPendingPayload(null);
      setScopeActionType(null);
      setSelectedScopeOption(null);
    }
  };

  // ****** CHANGE: Handles confirmation from RecurrenceActionModal ******
  // This is now called when the user clicks the main confirm button in the modal,
  // after having selected an option (single/future/all).
  const handleScopeConfirm = (selectedScopeFromModal) => {
    const finalScope = selectedScopeOption || selectedScopeFromModal; // Use state or arg

    console.log(
      `handleScopeConfirm: Action Type: ${scopeActionType}, Selected Scope State: ${finalScope}`
    );

    // Determine the correct action based on scope chosen
    let actionToExecute = null;
    let payloadForAction = pendingPayload; // Start with the full payload saved earlier

    if (!pendingPayload || !finalScope || scopeActionType !== "modify") {
      console.error(
        "Missing data or wrong context for edit scope confirmation."
      );
      setIsScopeModalOpen(false);
      return;
    }

    if (finalScope === "single") {
      actionToExecute = modifyTaskOccurrenceAction;

      console.log("In single with pending payload: ", pendingPayload);

      // Convert pendingPayload (rule changes) into an exception payload
      const originalTime = pendingPayload._originalOccurrenceTimeUTC;
      const taskId = pendingPayload._taskId;
      if (!originalTime || !taskId) {
        setFormError("Missing context.");
        return;
      }

      const tz = pendingPayload.timezone || dayjs.tz.guess() || "UTC";

      payloadForAction = {
        // Overwrite payload entirely for modify action
        taskId: taskId,
        originalOccurrenceTimeUTC: originalTime,
        // userId: "user-id-placeholder", // !!! GET USER ID !!!
        overrideTitle: pendingPayload.title,
        newStartTimeISO: dayjs
          .tz(
            `${pendingPayload.start_date} ${pendingPayload.start_time}`,
            "YYYY-MM-DD HH:mm",
            tz
          )
          .toISOString(),
        newDurationMinutes: pendingPayload.duration_minutes,
        isComplete: false,
        isCancelled: false, // Defaults
        exceptionId: pendingPayload._exceptionId,
      };

      // if (payloadForAction.userId.includes("placeholder")) {
      //   console.log("user id missing add it somewhee");
      //   /* error */ return;
      // }
    } else {
      // 'future' or 'all'
      // Payload remains pendingPayload (containing all form data)
      // Scope (finalScope) will be passed to executeSubmit
      actionToExecute = updateTaskDefinitionAction;
    }

    // Close the modal happens inside executeSubmit finally block
    executeSubmit(actionToExecute, payloadForAction, finalScope);
  };

  // --- Date Selection Handlers ---
  const handleStartDateSelect = (date) => {
    setValue("start_date", date, { shouldValidate: true });
    setIsStartDatePickerOpen(false);
  };

  const handleEndDateSelect = (date) => {
    setValue("end_date", date, { shouldValidate: true });
    setIsEndDatePickerOpen(false);
  };

  // --- Close Handler passed to Sheet ---
  // This function receives the new open state from the Sheet component
  const handleSheetOpenChange = useCallback(
    (open) => {
      console.log("Sheet onOpenChange received:", open);
      // We only need to react when the sheet is closed externally
      // Opening is handled by store actions like openTaskForm etc.
      if (!open) {
        // Call the store action to ensure state consistency and cleanup
        closeForm();
      }
      // No need to call a prop onOpenChange anymore
    },
    [closeForm]
  ); // Dependency is the store action

  // --- JSX ---
  return (
    <Sheet open={isOpen} onOpenChange={handleSheetOpenChange}>
      <SheetContent
        side="bottom"
        className="h-auto max-h-[95vh] sm:max-h-[90vh] flex flex-col rounded-t-3xl bg-drawer border-t border-gray-700 z-[70] p-0" // Use theme bg
        onOpenAutoFocus={(e) => e.preventDefault()}
        // Prevent closing on interact outside if it interferes with date pickers
        // onInteractOutside={(e) => e.preventDefault()}
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col h-full overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-700/50 flex-shrink-0">
            <SheetTitle className="text-white text-xl sm:text-2xl font-semibold">
              {/* Use isEditing from store */}
              {isEditing
                ? isExceptionEditMode
                  ? "Edit Occurrence"
                  : "Edit Task"
                : "New Task"}
            </SheetTitle>
            {/* Use store action to close */}
            <button
              type="button"
              onClick={closeForm}
              className="rounded-full p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable Content Area */}
          <div className="overflow-y-auto flex-grow p-4 sm:p-6 space-y-6 sm:space-y-8">
            {/* --- Form Fields (Structure remains the same, check Controller usage) --- */}
            {/* Task Name */}
            <div>
              <Controller
                name="title"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-12...">
                      <Dumbbell className="..." />
                    </div>
                    <Input {...field} placeholder="Task name" className="..." />
                  </div>
                )}
              />
              {errors.title && (
                <p className="text-red-400 text-xs mt-1 pl-16 sm:pl-[76px]">
                  {errors.title.message}
                </p>
              )}
            </div>
            {/* Time Picker & Start Date */}
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-300 mb-3 sm:mb-4">
                When
              </h3>
              <Controller
                name="start_time"
                control={control}
                render={({ field }) => (
                  <>
                    {/* Ensure WheelPicker uses HH:mm */}
                    <WheelPicker
                      options={timeSlots}
                      onChange={field.onChange}
                      itemHeight={40}
                      duration={watch("duration_minutes")}
                      defaultValue={field.value}
                    />
                    {errors.start_time && (
                      <p className="text-red-400 text-xs mt-2 text-center">
                        {errors.start_time.message}
                      </p>
                    )}
                  </>
                )}
              />
              {/* Start Date Picker */}
              <Controller
                name="start_date"
                control={control}
                render={({ field }) => (
                  <>
                    <div className="flex flex-col items-center mt-4 sm:mt-6">
                      <button
                        type="button"
                        onClick={() =>
                          setIsStartDatePickerOpen((prev) => !prev)
                        }
                        className="flex items-center gap-2 text-rose-400 px-4 py-2 rounded-lg hover:bg-gray-800/60 transition-colors text-sm sm:text-base"
                      >
                        <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span>
                          {field.value
                            ? dayjs(field.value).format("MMMM D, YYYY")
                            : "Select Start Date"}
                        </span>
                        {isStartDatePickerOpen ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      {isStartDatePickerOpen && (
                        <DatePickerSheet
                          open={isStartDatePickerOpen}
                          onOpenChange={setIsStartDatePickerOpen}
                          selectedDate={field.value}
                          onDateSelect={(date) => {
                            field.onChange(date); // Update react-hook-form value
                          }}
                        />
                      )}
                      {errors.start_date && (
                        <p className="text-red-400 text-xs mt-1">
                          {errors.start_date.message}
                        </p>
                      )}
                    </div>
                  </>
                )}
              />
            </div>
            {/* Duration Picker */}
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-300 mb-3 sm:mb-4">
                Duration
              </h3>
              <Controller
                name="duration_minutes"
                control={control}
                render={({ field }) => (
                  <>
                    <SegmentedControl
                      data={durationOptions}
                      value={String(field.value ?? 30)}
                      onChange={(v) => field.onChange(Number(v))}
                      fullWidth
                      fillSelected
                    />
                    {errors.duration_minutes && (
                      <p className="text-red-400 text-xs mt-1">
                        {errors.duration_minutes.message}
                      </p>
                    )}
                  </>
                )}
              />
            </div>
            {/* Frequency Picker */}
            <div
              className={
                isExceptionEditMode ? "opacity-50 pointer-events-none" : ""
              }
            >
              <h3 className="text-lg sm:text-xl font-semibold text-gray-300 mb-3 sm:mb-4">
                How often?
              </h3>
              <Controller
                name="frequency"
                control={control}
                render={({ field }) => (
                  <SegmentedControl
                    data={frequencyOptions}
                    value={field.value ?? "once"}
                    onChange={field.onChange}
                    fullWidth
                    fillSelected
                  />
                  // disabled={isExceptionEditMode}
                )}
              />
              {errors.frequency && (
                <p className="text-red-400 text-xs mt-1">
                  {errors.frequency.message}
                </p>
              )}
              {isExceptionEditMode && (
                <p className="text-xs text-amber-400 mt-1">
                  Recurrence cannot be changed when editing a single occurrence.
                </p>
              )}
            </div>
            {/* Recurrence Options (Conditional) */}
            {showRecurrenceOptions && (
              <div className="space-y-4 sm:space-y-6 border-t border-gray-700/50 pt-4 sm:pt-6">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-300">
                  Recurrence Settings
                </h3>
                {/* Interval */}
                <div>
                  <Controller
                    name="interval"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <label
                          htmlFor="intervalInput"
                          className="text-sm text-gray-400 block mb-1.5 sm:mb-2"
                        >
                          Repeat every
                        </label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="intervalInput"
                            type="number"
                            min="1"
                            step="1"
                            className="w-20 bg-zinc-800 border-gray-700 focus:border-rose-500 focus:ring-rose-500 text-white rounded-md"
                            {...field}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              field.onChange(isNaN(val) || val < 1 ? 1 : val);
                            }}
                            value={field.value ?? ""} // Use empty string for better controlled input handling
                          />
                          <span className="text-gray-400 text-sm">
                            {frequency === "daily" &&
                              `day${(field.value ?? 1) > 1 ? "s" : ""}`}
                            {frequency === "weekly" &&
                              `week${(field.value ?? 1) > 1 ? "s" : ""}`}
                            {frequency === "monthly" &&
                              `month${(field.value ?? 1) > 1 ? "s" : ""}`}
                          </span>
                        </div>
                      </div>
                    )}
                  />
                  {errors.interval && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.interval.message}
                    </p>
                  )}
                </div>

                {/* End Type */}
                <div>
                  <label className="text-sm text-gray-400 block mb-1.5 sm:mb-2">
                    Ends
                  </label>
                  <Controller
                    name="end_type"
                    control={control}
                    render={({ field }) => (
                      <SegmentedControl
                        data={[
                          { label: "Never", value: "never" },
                          { label: "After", value: "after" },
                          { label: "On Date", value: "on" },
                        ]}
                        value={field.value ?? "never"}
                        onChange={field.onChange}
                        fullWidth
                      />
                    )}
                  />
                  {errors.end_type && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.end_type.message}
                    </p>
                  )}
                </div>

                {/* Occurrences */}
                {endType === "after" && (
                  <div>
                    <Controller
                      name="occurrences"
                      control={control}
                      render={({ field }) => (
                        <div>
                          <label
                            htmlFor="occurrencesInput"
                            className="text-sm text-gray-400 block mb-1.5 sm:mb-2"
                          >
                            Number of occurrences
                          </label>
                          <Input
                            id="occurrencesInput"
                            type="number"
                            min="1"
                            step="1"
                            className="w-full bg-zinc-800 border-gray-700 focus:border-rose-500 focus:ring-rose-500 text-white rounded-md"
                            {...field}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              field.onChange(isNaN(val) || val < 1 ? 1 : val);
                            }}
                            value={field.value ?? ""}
                          />
                        </div>
                      )}
                    />
                    {errors.occurrences && (
                      <p className="text-red-400 text-xs mt-1">
                        {errors.occurrences.message}
                      </p>
                    )}
                  </div>
                )}

                {/* End Date */}
                {endType === "on" && (
                  <div>
                    <Controller
                      name="end_date"
                      control={control}
                      render={({ field }) => (
                        <div className="relative">
                          <label className="text-sm text-gray-400 block mb-1.5 sm:mb-2">
                            End Date
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setIsEndDatePickerOpen((prev) => !prev)
                            }
                            className="flex items-center justify-between text-left w-full gap-2 text-gray-200 px-3 py-2 rounded-md bg-zinc-800 border border-gray-700 hover:border-gray-600 transition-colors"
                            aria-haspopup="dialog"
                            aria-expanded={isEndDatePickerOpen}
                          >
                            <span className="flex items-center gap-2">
                              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                              <span className="flex-grow">
                                {field.value
                                  ? dayjs(field.value).format("MMMM D, YYYY")
                                  : "Select end date"}
                              </span>
                            </span>
                            <ChevronDown
                              className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isEndDatePickerOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                          {isEndDatePickerOpen && (
                            <div className="absolute top-full left-0 mt-2 w-full max-w-xs z-20 bg-zinc-800 rounded-lg shadow-lg border border-gray-700">
                              <DatePicker
                                isOpen={isEndDatePickerOpen}
                                selectedDate={field.value}
                                onSelect={handleEndDateSelect}
                                onClose={() => setIsEndDatePickerOpen(false)}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    />
                    {errors.end_date && (
                      <p className="text-red-400 text-xs mt-1">
                        {errors.end_date.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="h-8 sm:h-12"></div> {/* Bottom space */}
          </div>

          {/* Footer */}
          <div className="p-4 pb-20  border-t border-gray-700/50 flex-shrink-0">
            {formError && (
              <div className="bg-red-800/30 border border-red-600/50 text-red-300 p-3 rounded-md mb-3 sm:mb-4 text-sm text-center">
                {formError}
              </div>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="w-full h-12 sm:h-14 text-base sm:text-lg rounded-xl bg-rose-400 hover:bg-rose-700 focus-visible:ring-rose-500 focus-visible:ring-offset-zinc-900 text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  {isEditing ? "Saving..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Create Task"
              )}
            </Button>
          </div>
        </form>

        <RecurrenceActionModal
          actionType={"modify"}
          isOpen={isScopeModalOpen}
          onClose={() => {
            setIsScopeModalOpen(false);
            setPendingPayload(null);
            setScopeActionType(null);
            setSelectedScopeOption(null);
          }}
          onConfirm={handleScopeConfirm}
          selectedOption={selectedScopeOption} // State to display selection
          setSelectedOption={setSelectedScopeOption}
        />
      </SheetContent>
    </Sheet>
  );
}
