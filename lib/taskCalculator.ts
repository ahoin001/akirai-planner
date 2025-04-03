// src/lib/taskCalculator.ts (or utils/taskCalculator.ts)

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isBetween from "dayjs/plugin/isBetween"; // Needed for checking if single instance falls in range
// Import RRule (make sure it's installed: npm install rrule)
import { RRule, RRuleSet, rrulestr } from "rrule";
// Import types (adjust path as needed)
import {
  TaskDefinition,
  TaskException,
  CalculatedInstance,
} from "@/types/taskTypes";

// Ensure Dayjs plugins are loaded
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isBetween);

/**
 * Calculates the actual task instances within a given date range,
 * considering recurrence rules (RRULE) and applying exceptions.
 *
 * @param tasks - Array of TaskDefinition objects from the database.
 * @param exceptions - Array of TaskException objects from the database.
 * @param rangeStartISO - The start of the date range (inclusive) as an ISO 8601 string (UTC or with offset).
 * @param rangeEndISO - The end of the date range (exclusive or inclusive depending on usage) as an ISO 8601 string.
 * @returns An array of CalculatedInstance objects, sorted by time.
 */
export const calculateInstancesForRange = (
  tasks: TaskDefinition[],
  exceptions: TaskException[],
  rangeStartISO: string,
  rangeEndISO: string
): CalculatedInstance[] => {
  if (!tasks || tasks.length === 0) {
    return []; // No tasks, no instances
  }

  // --- 1. Prepare Date Range and Exceptions Map ---

  // Ensure range dates are Dayjs UTC objects for reliable comparison
  // Use startOf('day') and endOf('day') for full day inclusion if needed by UI logic
  // For RRULE `between`, raw Date objects are often required.
  const queryStartUTC = dayjs.utc(rangeStartISO).toDate();
  const queryEndUTC = dayjs.utc(rangeEndISO).toDate(); // RRULE 'between' end is typically exclusive

  // Create an efficient lookup map for exceptions:
  // { [taskId]: { [originalTimeISO]: exceptionData } }
  const exceptionsMap: Record<string, Record<string, TaskException>> = {};
  for (const ex of exceptions) {
    if (!ex || !ex.task_id || !ex.original_occurrence_time) continue; // Skip invalid exceptions

    if (!exceptionsMap[ex.task_id]) {
      exceptionsMap[ex.task_id] = {};
    }
    try {
      // Ensure the key is a consistent ISO string representation of the UTC time
      const originalTimeISO = dayjs
        .utc(ex.original_occurrence_time)
        .toISOString();
      exceptionsMap[ex.task_id][originalTimeISO] = ex;
    } catch (e) {
      console.error(
        "taskCalculator: Error processing exception date:",
        ex.original_occurrence_time,
        e
      );
    }
  }

  const finalInstances: CalculatedInstance[] = [];

  // --- 2. Iterate Through Task Definitions ---
  for (const task of tasks) {
    if (!task || !task.dtstart || !task.timezone) {
      console.warn(
        `taskCalculator: Task ${task?.id} is missing dtstart or timezone. Skipping.`
      );
      continue; // Skip tasks missing essential data
    }

    // Ensure dtstart is parsed correctly (it's TIMESTAMPTZ, so Dayjs UTC is appropriate)
    const taskDtstartUTC = dayjs.utc(task.dtstart);
    if (!taskDtstartUTC.isValid()) {
      console.warn(
        `taskCalculator: Task ${task.id} has invalid dtstart: ${task.dtstart}. Skipping.`
      );
      continue;
    }

    // --- 3. Handle Single Occurrence Tasks ---
    if (!task.rrule) {
      // Check if the single occurrence falls within the query range
      // Using isBetween for clearer range checking (inclusive start, exclusive end by default)
      // Adjust inclusivity based on how queryEndUTC is defined (e.g., endOf('day'))
      if (
        taskDtstartUTC.isBetween(
          rangeStartISO,
          rangeEndISO,
          "millisecond",
          "[)"
        )
      ) {
        // Inclusive start, exclusive end
        const originalTimeISO = taskDtstartUTC.toISOString();
        const exception = exceptionsMap[task.id]?.[originalTimeISO];

        // Skip if this specific instance is marked as cancelled
        if (exception?.is_cancelled) {
          continue;
        }

        // Construct the instance, applying any exception overrides
        finalInstances.push({
          // Generate a unique ID: use exception ID if it exists, otherwise combine task ID and time
          id: exception?.id || `${task.id}-${originalTimeISO}`,
          task_id: task.id,
          original_occurrence_time_utc: originalTimeISO,
          // Use overridden start time if available, otherwise use original dtstart
          scheduled_time_utc: exception?.new_start_time
            ? dayjs.utc(exception.new_start_time).toISOString()
            : originalTimeISO,
          duration_minutes:
            exception?.new_duration_minutes ?? task.duration_minutes,
          title: exception?.override_title ?? task.title,
          is_complete: exception?.is_complete ?? false,
          completion_time: exception?.completion_time ?? null,
          is_cancelled: false, // If we reached here, it wasn't cancelled
          timezone: task.timezone,
          // Pass through other relevant parent task properties if needed
          // color: exception?.override_color ?? task.color,
          // type: task.type, // Type usually doesn't change per instance
        });
      }
    }
    // --- 4. Handle Recurring Tasks ---
    else {
      try {
        // Prepare RRULE options. DTSTART is crucial.
        const ruleOptions = {
          dtstart: taskDtstartUTC.toDate(), // Pass JS Date object in UTC
          // Consider adding tzid to ruleOptions if rrule.js supports it well,
          // otherwise rely on dtstart being correctly timestamped.
          // tzid: task.timezone // May or may not be needed depending on rrule.js version/usage
        };

        // Use rrulestr to parse the rule string along with the DTSTART context
        const rule = rrulestr(task.rrule, ruleOptions);

        // Get occurrences strictly within the specified UTC range
        // Note: `between`'s end date is exclusive by default.
        const occurrences = rule.between(queryStartUTC, queryEndUTC, true); // `true` makes start inclusive

        for (const occurrenceDate of occurrences) {
          // rrule.js returns Date objects, convert to Dayjs UTC for consistency
          const occurrenceStartTimeUTC = dayjs.utc(occurrenceDate);
          if (!occurrenceStartTimeUTC.isValid()) {
            console.warn(
              `taskCalculator: RRule generated invalid date for task ${task.id}. Skipping.`
            );
            continue;
          }

          const originalTimeISO = occurrenceStartTimeUTC.toISOString();
          const exception = exceptionsMap[task.id]?.[originalTimeISO];

          // Skip if this specific occurrence is cancelled via an exception
          if (exception?.is_cancelled) {
            continue;
          }

          // Construct the instance, applying overrides
          finalInstances.push({
            id: exception?.id || `${task.id}-${originalTimeISO}`,
            task_id: task.id,
            original_occurrence_time_utc: originalTimeISO,
            // Use override time, otherwise use the calculated occurrence time
            scheduled_time_utc: exception?.new_start_time
              ? dayjs.utc(exception.new_start_time).toISOString()
              : originalTimeISO,
            duration_minutes:
              exception?.new_duration_minutes ?? task.duration_minutes,
            title: exception?.override_title ?? task.title,
            is_complete: exception?.is_complete ?? false,
            completion_time: exception?.completion_time ?? null,
            is_cancelled: false,
            timezone: task.timezone,
            // Pass through other relevant parent task properties
            // color: exception?.override_color ?? task.color,
            // type: task.type,
          });
        }
      } catch (rruleError) {
        console.error(
          `taskCalculator: Error processing RRULE for task ${task.id} (Rule: ${task.rrule}):`,
          rruleError
        );
        // Decide if you want to skip this task or add a placeholder error instance
      }
    }
  }

  // --- 5. Sort Final Instances by Scheduled Time ---
  finalInstances.sort((a, b) =>
    dayjs(a.scheduled_time_utc).diff(dayjs(b.scheduled_time_utc))
  );

  // console.log(
  //   `taskCalculator: Calculated ${finalInstances.length} instances for range ${rangeStartISO} to ${rangeEndISO}`
  // );
  return finalInstances;
};

// --- Example Usage (in a component or selector) ---
/*
import { useTaskStore } from '@/app/stores/useTaskStore';
import { calculateInstancesForRange } from '@/lib/taskCalculator';
import { useMemo } from 'react';

function MyPlannerComponent() {
    const tasks = useTaskStore(state => state.tasks);
    const exceptions = useTaskStore(state => state.exceptions);
    const currentViewStartDate = useTaskStore(state => state.currentViewStartDate);

    const instancesForWeek = useMemo(() => {
        const weekStartISO = dayjs(currentViewStartDate).toISOString();
        // Calculate end based on your view (e.g., 7 days)
        const weekEndISO = dayjs(currentViewStartDate).add(7, 'days').toISOString();
        return calculateInstancesForRange(tasks, exceptions, weekStartISO, weekEndISO);
    }, [tasks, exceptions, currentViewStartDate]);

    // ... render instancesForWeek ...
}
*/
