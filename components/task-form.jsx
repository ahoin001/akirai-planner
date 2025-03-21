"use client";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Dumbbell,
  CalendarIcon,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react";
import useCalendarStore from "@/app/stores/useCalendarStore";

import DatePicker from "@/components/date-picker";
import { WheelPicker } from "@/components/wheel-picker";

import { createTaskAction, updateTask } from "@/app/actions";

import { useTaskStore } from "@/app/stores/useTaskStore";
import dayjs from "dayjs";

/**
 * TaskForm component
 *
 * A form for creating or editing tasks
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the form is open
 * @param {Function} props.onClose - Function to call when closing the form
 * @param {Object} props.initialValues - Initial values for the form
 * @param {boolean} props.isEditing - Whether we're editing an existing task
 * @returns {JSX.Element|null} Rendered component or null if closed
 */
export default function TaskForm({
  isOpen,
  onClose,
  initialValues = {},
  isEditing = false,
}) {
  const { selectedDay } = useCalendarStore();

  // Form state
  const [title, setTitle] = useState(initialValues?.title || "");
  const [startDate, setStartDate] = useState(
    initialValues?.start_date ? parseISO(initialValues.start_date) : selectedDay
  );
  const [startTime, setStartTime] = useState(
    initialValues?.start_time || "11:00"
  );
  const [durationMinutes, setDurationMinutes] = useState(
    initialValues?.duration_minutes || 30
  );
  const [frequency, setFrequency] = useState(
    initialValues?.frequency || "once"
  );
  const [taskType, setTaskType] = useState(initialValues?.type || "workout");

  // UI state
  const [isMounted, setIsMounted] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [errors, setErrors] = useState({});

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      // Use optional chaining to safely access properties of initialValues
      setTitle(initialValues?.title || "");
      setStartDate(
        initialValues?.start_date
          ? parseISO(initialValues.start_date)
          : selectedDay
      );
      setStartTime(initialValues?.start_time || "11:00");
      setDurationMinutes(initialValues?.duration_minutes || 30);
      setFrequency(initialValues?.frequency || "once");
      setTaskType(initialValues?.type || "workout");
      setErrors({});

      // Animate in
      setTimeout(() => setIsMounted(true), 10);
    } else {
      setIsMounted(false);
    }
  }, [isOpen, initialValues, selectedDay]);

  // Duration options
  const durationOptions = [
    { label: "15m", value: 15 },
    { label: "30m", value: 30 },
    { label: "45m", value: 45 },
    { label: "1h", value: 60 },
    { label: "1.5h", value: 90 },
    { label: "2h", value: 120 },
  ];

  // Frequency options
  const frequencyOptions = [
    { label: "Once", value: "once" },
    { label: "Daily", value: "daily" },
    { label: "Weekly", value: "weekly" },
  ];

  // Task type options
  const taskTypeOptions = [
    { label: "Workout", value: "workout" },
    { label: "Alarm", value: "alarm" },
    { label: "Night", value: "night" },
  ];

  // Time options (9am to 11pm in 15 minute increments)
  const timeOptions = [];
  for (let hour = 9; hour <= 23; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const formattedHour = hour % 12 || 12;
      const period = hour < 12 ? "AM" : "PM";
      timeOptions.push({
        label: `${formattedHour}:${minute.toString().padStart(2, "0")} ${period}`,
        value: `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
      });
    }
  }

  // Time slots for wheelpicker
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

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!title.trim()) {
      newErrors.title = "Title is required";
    }

    if (!startTime) {
      newErrors.startTime = "Start time is required";
    }

    if (!durationMinutes) {
      newErrors.durationMinutes = "Duration is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const taskData = {
      title,
      start_date: format(startDate, "yyyy-MM-dd"),
      start_time: startTime,
      duration_minutes: durationMinutes,
      // type: taskType,
      // color: taskType === "alarm" ? "pink" : "blue",
      //   frequency,
      //   is_complete: initialValues.is_complete || false,
    };

    if (isEditing && initialValues.id) {
      console.log("updating task", initialValues.id, taskData);
      updateTask(initialValues.id, taskData);
    } else {
      createTaskAction(taskData);
    }

    onClose();
  };

  // Handle date selection
  const handleDateSelect = (date) => {
    setStartDate(date);
    setIsCalendarOpen(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Form */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl z-50 transition-all duration-500 ease-in-out ${
          isMounted ? "transform translate-y-0" : "transform translate-y-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="h-[90vh] pb-48 overflow-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-800">
            <h2 className="text-2xl font-bold">
              {isEditing ? "Edit" : "New"}{" "}
              <span className="text-pink-500">Task</span>
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Scrollable content */}
          <div
            className="overflow-y-auto p-6 space-y-8"
            style={{ height: "calc(90vh - 80px - 80px)" }}
          >
            {/* Task name */}
            <div className="space-y-2">
              <label htmlFor="title" className="block text-lg text-gray-400">
                Task Name
              </label>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center">
                  <Dumbbell className="w-6 h-6 text-pink-500" />
                </div>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 bg-zinc-800 border-none rounded-lg p-3 text-lg focus:ring-1 focus:ring-pink-500"
                  placeholder="Task name"
                />
              </div>
              {errors.title && (
                <p className="text-red-500 text-sm">{errors.title}</p>
              )}
            </div>
            {/* Task type */}
            <div className="space-y-2">
              <label className="block text-lg text-gray-400">Task Type</label>
              <div className="grid grid-cols-3 gap-3">
                {taskTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTaskType(option.value)}
                    className={`p-3 rounded-lg text-center transition-colors ${
                      taskType === option.value
                        ? "bg-pink-500 text-white"
                        : "bg-zinc-800 text-gray-300 hover:bg-zinc-700"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Date and time */}
            <div className="space-y-2">
              <label className="block text-lg text-gray-400">When</label>
              {/* Date picker button */}
              <button
                type="button"
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                className="w-full flex items-center justify-between bg-zinc-800 rounded-lg p-3 hover:bg-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CalendarIcon className="w-5 h-5 text-pink-500" />
                  <span>{format(startDate, "MMMM d, yyyy")}</span>
                </div>
                {isCalendarOpen ? <ChevronUp /> : <ChevronDown />}
              </button>
              {/* Calendar */}
              {isCalendarOpen && (
                <div className="mt-2 bg-zinc-800 rounded-lg p-4">
                  <DatePicker
                    isOpen={true}
                    onClose={() => setIsCalendarOpen(false)}
                    onSelect={handleDateSelect}
                    selectedDate={startDate}
                  />
                </div>
              )}
              {/* Time picker */}
              <div className="mt-4">
                <label
                  htmlFor="startTime"
                  className="block text-lg text-gray-400 mt-4 mb-1"
                >
                  Start Time
                </label>

                <WheelPicker
                  options={timeSlots}
                  onChange={(value) => setStartTime(value)}
                  itemHeight={50}
                  duration={durationMinutes}
                  defaultValue={
                    initialValues?.start_time
                      ? dayjs("1/1/1 " + initialValues.start_time).format(
                          "hh:mm A"
                        )
                      : "11:00 AM"
                  }
                />

                {errors.startTime && (
                  <p className="text-red-500 text-sm">{errors.startTime}</p>
                )}
              </div>
            </div>
            {/* Duration */}
            <div className="space-y-2">
              <label className="block text-lg text-gray-400">Duration</label>
              <div className="grid grid-cols-3 gap-3">
                {durationOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDurationMinutes(option.value)}
                    className={`p-3 rounded-lg text-center transition-colors ${
                      durationMinutes === option.value
                        ? "bg-pink-500 text-white"
                        : "bg-zinc-800 text-gray-300 hover:bg-zinc-700"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {errors.durationMinutes && (
                <p className="text-red-500 text-sm">{errors.durationMinutes}</p>
              )}
            </div>
            {/* Frequency */}
            <div className="space-y-2">
              <label className="block text-lg text-gray-400">How often?</label>
              <div className="grid grid-cols-3 gap-3">
                {frequencyOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFrequency(option.value)}
                    className={`p-3 rounded-lg text-center transition-colors ${
                      frequency === option.value
                        ? "bg-pink-500 text-white"
                        : "bg-zinc-800 text-gray-300 hover:bg-zinc-700"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-zinc-800 bg-zinc-900">
            <button
              type="submit"
              className="w-full bg-pink-500 hover:bg-pink-600 text-white rounded-lg p-4 text-lg font-medium transition-colors"
            >
              {isEditing ? "Update Task" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
