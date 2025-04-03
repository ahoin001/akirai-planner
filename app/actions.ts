"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { SupabaseClient } from "@supabase/supabase-js";

import { RRule, RRuleSet, rrulestr } from "rrule";
import { revalidatePath } from "next/cache"; // For refreshing UI data

// Extend Day.js with required plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const DATE_FORMAT = "YYYY-MM-DD";
const MAX_OCCURRENCES = 25; // Safety cap

// *************** CREATE ACTIONS *******************
export const createTaskAction = async (taskData) => {
  console.log("SERVER ACTION (createTaskAction): Received Data:", taskData);

  try {
    const supabase = await createClient(); // Get server client
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("SERVER ACTION Error: Authentication Failed", authError);
      throw new Error("User not authenticated");
    }

    // --- 1. Validate Core Fields ---
    if (!taskData.title?.trim()) throw new Error("Task title is required.");
    if (!taskData.start_date) throw new Error("Start date is required.");
    // ****** VALIDATE: Ensure start_time is HH:mm ******
    if (
      !taskData.start_time ||
      !/^([01]\d|2[0-3]):([0-5]\d)$/.test(taskData.start_time)
    ) {
      throw new Error("Start time is required in HH:mm format.");
    }
    if (!taskData.duration_minutes || taskData.duration_minutes < 1) {
      throw new Error("Duration must be at least 1 minute.");
    }
    if (!taskData.recurrence?.frequency) {
      throw new Error("Recurrence frequency selection is required.");
    }

    // --- 2. Validate Duration Against Limits (Optional but recommended) ---
    let maxDuration = 1440; // Default
    try {
      const { data: limitsData, error: limitError } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "task_limits")
        .maybeSingle(); // Handles null if not found
      if (limitError)
        console.warn(
          "SERVER ACTION Warning: Failed to fetch duration limits.",
          limitError.message
        );
      if (limitsData?.value?.max_duration_minutes) {
        const parsedMax = parseInt(limitsData.value.max_duration_minutes, 10);
        if (!isNaN(parsedMax) && parsedMax > 0) maxDuration = parsedMax;
      }
    } catch (fetchLimitError) {
      console.warn(
        "SERVER ACTION Warning: Error fetching duration limit, using default.",
        fetchLimitError
      );
    }
    const duration = parseInt(taskData.duration_minutes, 10);
    if (isNaN(duration) || duration < 1 || duration > maxDuration) {
      throw new Error(`Duration must be between 1 and ${maxDuration} minutes.`);
    }

    // --- 3. Determine Timezone & Calculate `dtstart` (TIMESTAMPTZ) ---
    const timeZone = taskData.timezone || dayjs.tz.guess() || "UTC"; // Guess timezone if not provided
    const localStartDateTime = dayjs.tz(
      `${taskData.start_date} ${taskData.start_time}`, // Combine date and HH:mm time
      "YYYY-MM-DD HH:mm", // Specify format for parsing
      timeZone // Specify the timezone of the input
    );

    if (!localStartDateTime.isValid()) {
      console.error(
        "SERVER ACTION Error: Invalid date/time/timezone combination",
        {
          date: taskData.start_date,
          time: taskData.start_time,
          tz: timeZone,
        }
      );
      throw new Error(
        "Invalid start date/time combination. Please use YYYY-MM-DD and HH:mm."
      );
    }
    // Convert the local time to an ISO 8601 string. Supabase TIMESTAMPTZ handles this correctly.
    const dtstartISO = localStartDateTime.toISOString();
    console.log(
      `SERVER ACTION: Using timezone: ${timeZone}, Calculated dtstart: ${dtstartISO}`
    );

    // --- 4. Generate RRULE String based on taskData.recurrence ---
    let rruleString = null; // Default: null means occurs only once on dtstart
    const {
      frequency,
      interval = 1,
      end_type = "never",
      occurrences,
      end_date,
    } = taskData.recurrence;

    if (frequency && frequency !== "once") {
      const freqMap = {
        daily: RRule.DAILY,
        weekly: RRule.WEEKLY,
        monthly: RRule.MONTHLY,
        // yearly: RRule.YEARLY, // Add if needed
      };

      if (!freqMap[frequency]) {
        throw new Error(`Invalid recurrence frequency provided: ${frequency}`);
      }

      // Base RRULE options
      const ruleOptions = {
        freq: freqMap[frequency],
        interval: Math.max(1, parseInt(interval, 10) || 1),
        // dtstart is implicitly handled by the context or can be explicitly set
        // dtstart: localStartDateTime.toDate(), // rrule often prefers JS Date objects
        // wkst: RRule.SU // Optional: Define week start if needed
      };

      // Add end condition based on end_type
      switch (end_type) {
        case "after":
          const count = Math.max(1, parseInt(occurrences, 10) || 0);
          if (count === 0)
            throw new Error("Occurrences must be at least 1 for 'after'.");
          ruleOptions.count = count;
          break;
        case "on":
          if (!end_date) throw new Error("End date is required for 'on'.");
          // Parse end date string (YYYY-MM-DD) IN THE TASK'S TIMEZONE.
          // Use endOf('day') to include the whole day.
          const untilDateTime = dayjs
            .tz(end_date, "YYYY-MM-DD", timeZone)
            .endOf("day");
          if (!untilDateTime.isValid())
            throw new Error("Invalid end date format.");
          // Validate end date is not before start date
          if (untilDateTime.isBefore(localStartDateTime, "day")) {
            throw new Error("End date cannot be before the start date.");
          }
          // Convert to UTC Date object for RRULE 'until'
          ruleOptions.until = untilDateTime.utc().toDate();
          break;
        case "never":
        default:
          // No end condition ('count' or 'until') needed for never-ending rules
          break;
      }

      try {
        // Generate the RRULE string
        const rule = new RRule(ruleOptions);
        rruleString = rule.toString();
        console.log(`SERVER ACTION: Generated RRULE: ${rruleString}`);
      } catch (rruleError) {
        console.error(
          "SERVER ACTION Error: Failed to generate RRULE",
          rruleError,
          ruleOptions
        );
        throw new Error("Failed to process recurrence rule. Check parameters.");
      }
    } else {
      console.log(
        "SERVER ACTION: Task frequency is 'once'. No RRULE will be stored."
      );
    }

    // --- 5. Database Insert into 'tasks' table ---
    console.log("SERVER ACTION: Inserting task definition into database...");
    const { data: insertedTask, error: insertError } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        title: taskData.title.trim(),
        dtstart: dtstartISO, // TIMESTAMPTZ (ISO String)
        duration_minutes: duration,
        rrule: rruleString, // TEXT (RRULE string or null)
        timezone: timeZone, // TEXT (IANA timezone name)
        status: "active", // Default status
        // created_at and updated_at have defaults
      })
      .select() // Select the newly created task record
      .single(); // Expect only one record back

    // --- 6. Error Handling & Return ---
    if (insertError) {
      console.error("SERVER ACTION Error: Supabase insert failed", insertError);
      // Check for specific constraint violations if helpful
      if (insertError.message.includes("check constraint")) {
        throw new Error(`Data validation failed: ${insertError.message}`);
      }
      if (
        insertError.message.includes(
          "invalid input syntax for type timestamp with time zone"
        )
      ) {
        throw new Error(
          `Database error: Invalid format for start date/time. Calculated value: ${dtstartISO}`
        );
      }
      throw new Error(`Database error creating task: ${insertError.message}`);
    }

    console.log(
      "SERVER ACTION: Task created successfully in DB:",
      insertedTask
    );

    // --- 7. Revalidate Cache ---
    // Invalidate cache for pages displaying tasks to show the new data
    revalidatePath("/"); // Revalidate home/dashboard page (adjust path)
    revalidatePath("/protected"); // Example path
    // Add any other specific paths where tasks are displayed

    return insertedTask; // Return the created task definition
  } catch (error) {
    // Log the detailed error on the server
    console.error("SERVER ACTION Error: Task creation failed.", error);
    // Throw a user-friendly error message back to the client
    // Re-throw the original error object for better debugging in some cases
    throw error; // Or: throw new Error(error.message || "Failed to create task.");
  }
};

// *************** DELETE ACTIONS *******************
// --- Action to Delete Future Occurrences (Updates RRULE UNTIL) ---
/**
 * Modifies a recurring task's RRULE to end just before a specific occurrence.
 * Optionally cleans up exceptions after the new end date.
 *
 * @param {string} taskId - The ID of the parent task definition in the 'tasks' table.
 * @param {string} originalOccurrenceTimeUTC - The ISO string UTC timestamp of the *first* occurrence to delete.
 * @returns {Promise<object>} Object indicating success and the updated task ID.
 * @throws {Error} If validation or database operations fail.
 */
export const deleteFutureOccurrencesAction = async (
  taskId,
  originalOccurrenceTimeUTC
) => {
  console.log(
    `SERVER ACTION: Deleting future occurrences for task ${taskId} from ${originalOccurrenceTimeUTC}`
  );
  if (!taskId || !originalOccurrenceTimeUTC) {
    throw new Error(
      "Task ID and the occurrence time to delete from are required."
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("User not authenticated.");
  }
  console.log("User : ", user);
  try {
    // 1. Fetch the parent task definition (need rrule, dtstart, user_id)
    const { data: task, error: fetchError } = await supabase
      .from("tasks")
      .select("rrule, dtstart, user_id") // Select only necessary fields
      .eq("id", taskId)
      .eq("user_id", user.id) // Ensure ownership
      .single(); // Expect one task

    if (fetchError)
      throw new Error(`Database error fetching task: ${fetchError.message}`);
    if (!task) throw new Error("Task not found or unauthorized.");
    if (!task.rrule)
      throw new Error(
        "Cannot delete future occurrences of a non-recurring task."
      ); // Should not happen if called correctly

    // 2. Calculate the new UNTIL date/time
    // The UNTIL clause in RRULE specifies the *last possible moment* an occurrence can START.
    // So, we set it to the moment *just before* the 'originalOccurrenceTimeUTC' starts.
    const newUntilDateTime = dayjs
      .utc(originalOccurrenceTimeUTC)
      .subtract(1, "millisecond"); // Go back slightly
    if (!newUntilDateTime.isValid()) {
      throw new Error("Invalid occurrence time provided for cutoff.");
    }
    const newUntilDateUTC = newUntilDateTime.toDate(); // Get JS Date object in UTC for RRule

    // 3. Parse the existing RRULE and add/update the UNTIL property
    let updatedRruleString;
    try {
      // Parse the existing rule string. Provide dtstart for context.
      // Use rrulestr for flexibility as it handles DTSTART within the string or via options.
      const existingRuleOptions = RRule.parseString(task.rrule);
      const dtstartDate = dayjs.utc(task.dtstart).toDate(); // Ensure dtstart is a Date object

      // Create new options, merging existing ones with the new 'until'
      // Ensure properties like freq, interval etc. are preserved.
      const newOptions = {
        ...existingRuleOptions, // Keep existing freq, interval, byday etc.
        dtstart: dtstartDate, // Ensure dtstart is set for context
        until: newUntilDateUTC, // Set the new end date/time
      };

      // Handle potential conflicts: If rule already had a COUNT, remove it when setting UNTIL.
      if (newOptions.count) {
        delete newOptions.count;
      }

      // Regenerate the rule string with the updated options
      updatedRruleString = new RRule(newOptions).toString();
      console.log(
        `SERVER ACTION: Original RRULE: ${task.rrule}, New RRULE with UNTIL: ${updatedRruleString}`
      );
    } catch (rruleError) {
      console.error(
        "SERVER ACTION Error: Failed to parse/update RRULE",
        rruleError
      );
      throw new Error("Failed to update recurrence rule.");
    }

    // 4. Update the task in the database with the new RRULE string
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ rrule: updatedRruleString })
      .eq("id", taskId); // RLS handles user_id check

    if (updateError)
      throw new Error(
        `Database error updating task rule: ${updateError.message}`
      );

    // 5. Optional Cleanup: Delete any exceptions whose *original* time occurs ON or AFTER the occurrence we are deleting from.
    // This prevents orphaned exceptions for occurrences that no longer exist according to the rule.
    const { error: deleteExceptionsError } = await supabase
      .from("task_instance_exceptions")
      .delete()
      .eq("task_id", taskId)
      .gte("original_occurrence_time", originalOccurrenceTimeUTC); // Use GTE

    if (deleteExceptionsError) {
      // Log warning but don't necessarily fail the whole operation
      console.warn(
        `SERVER ACTION Warning: Failed to clean up future exceptions for task ${taskId}`,
        deleteExceptionsError
      );
    }

    console.log(
      `SERVER ACTION: Future occurrences for task ${taskId} deleted (rule updated).`
    );
    revalidatePath("/"); // Revalidate relevant paths
    revalidatePath("/protected");
    return { success: true, updatedTaskId: taskId };
  } catch (error) {
    console.error(
      "SERVER ACTION Error: deleting future occurrences failed.",
      error
    );
    throw error; // Re-throw for the client
  }
};

// --- Action to Delete Entire Task Series (including single non-recurring tasks) ---
/**
 * Deletes a task definition (and all its potential occurrences/exceptions)
 * from the 'tasks' table. Handles both single and recurring tasks.
 *
 * @param {string} taskId - The ID of the task definition in the 'tasks' table.
 * @returns {Promise<object>} Object indicating success and the deleted task ID.
 * @throws {Error} If validation or database operations fail.
 */
export const deleteTaskSeriesAction = async (taskId) => {
  console.log(`SERVER ACTION: Deleting task series ${taskId}`);
  if (!taskId) throw new Error("Task ID is required to delete the series.");

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("User not authenticated.");

  try {
    // Optional: Verify ownership first if RLS isn't fully trusted or for logging
    // const { count, error: checkError } = await supabase
    //   .from('tasks')
    //   .select('id', { count: 'exact', head: true }) // Just check existence and ownership
    //   .eq('id', taskId)
    //   .eq('user_id', user.id);
    // if (checkError) throw new Error(`DB error checking task: ${checkError.message}`);
    // if (count === 0) throw new Error("Task not found or unauthorized.");

    // Delete the parent task record.
    // RLS on the 'tasks' table ensures the user can only delete their own tasks.
    // The 'ON DELETE CASCADE' constraint on 'task_instance_exceptions.task_id'
    // will automatically delete all associated exception records.
    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId); // RLS handles the user_id check implicitly

    if (deleteError) {
      console.error(
        `SERVER ACTION Error: Failed deleting task ${taskId}`,
        deleteError
      );
      throw new Error(`Database error deleting task: ${deleteError.message}`);
    }

    console.log(`SERVER ACTION: Task series ${taskId} deleted successfully.`);
    revalidatePath("/"); // Revalidate relevant paths
    revalidatePath("/protected");
    return { success: true, deletedTaskId: taskId };
  } catch (error) {
    console.error("SERVER ACTION Error: deleting task series failed.", error);
    throw error; // Re-throw for the client
  }
};

// Handles the 'single' scope correctly for both recurring and non-recurring.
export const deleteSingleTaskOrOccurrenceAction = async (payload) => {
  const { taskId, originalOccurrenceTimeUTC, isParentRecurring, exceptionId } =
    payload;
  console.log("SERVER ACTION: Deleting Single Task/Occurrence", payload);

  if (!taskId) {
    throw new Error("Task ID  required.");
  }
  // originalOccurrenceTimeUTC is needed ONLY if isParentRecurring is true

  const supabase = await createClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !authUser) {
    throw new Error("User not authenticated or mismatched.");
  }

  try {
    if (isParentRecurring) {
      // --- Case 1: Delete a SINGLE OCCURRENCE of a RECURRING task ---
      console.log(
        `Deleting single occurrence of recurring task ${taskId} at ${originalOccurrenceTimeUTC}`
      );
      if (!originalOccurrenceTimeUTC) {
        throw new Error(
          "Original occurrence time is required to delete a recurring instance."
        );
      }

      // Create/Update an exception to mark it as cancelled
      const exceptionData = {
        task_id: taskId,
        user_id: authUser.id,
        original_occurrence_time: originalOccurrenceTimeUTC,
        is_cancelled: true,
        is_complete: false, // Reset other fields on cancellation
        completion_time: null,
        new_start_time: null,
        new_duration_minutes: null,
        override_title: null,
      };

      const { error: upsertError } = await supabase
        .from("task_instance_exceptions")
        .upsert(exceptionData, {
          onConflict: "task_id, original_occurrence_time",
        })
        .select("id") // Select something to confirm success/failure
        .single();

      if (upsertError) {
        console.error(
          "SERVER ACTION Error: Failed to create cancellation exception",
          upsertError
        );
        throw new Error(
          `Database error cancelling occurrence: ${upsertError.message}`
        );
      }
      console.log(
        `SERVER ACTION: Occurrence at ${originalOccurrenceTimeUTC} for task ${taskId} cancelled.`
      );
    } else {
      // --- Case 2: Delete a NON-RECURRING (truly single) task ---
      console.log(`Deleting non-recurring task definition ${taskId}`);
      // Delete the parent task record itself. RLS ensures user owns it.
      // Cascade delete should handle any potential orphaned exceptions (though unlikely).
      const { error: deleteError } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId); // RLS implicitly checks user_id

      if (deleteError) {
        console.error(
          "SERVER ACTION Error: Failed to delete single task definition",
          deleteError
        );
        throw new Error(`Database error deleting task: ${deleteError.message}`);
      }
      console.log(`SERVER ACTION: Single task definition ${taskId} deleted.`);
    }

    revalidatePath("/"); // Revalidate relevant paths
    revalidatePath("/protected");
    return { success: true };
  } catch (error) {
    console.error(
      "SERVER ACTION Error: deleteSingleTaskOrOccurrenceAction failed.",
      error
    );
    throw error; // Re-throw
  }
};

// *************** UPDATE ACTIONS *******************

export const updateTask = async (
  taskInstanceId: string,
  updates: object,
  scope: "single" | "future" | "all" = "single"
) => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("User not authenticated");

    // 1. Fetch task instance with parent task relationship
    const { data: taskInstance, error: fetchError } = await supabase
      .from("task_instances")
      .select("*, tasks!task_instances_task_id_fkey(*)")
      .eq("id", taskInstanceId)
      .single();

    if (fetchError) throw fetchError;

    const parentTask = taskInstance.tasks;
    if (!parentTask) throw new Error("Parent task not found");

    console.log("Before scope check: ", scope);

    // 2. Validate recurrence for non-single scopes
    if (scope !== "single" && !parentTask.is_recurring) {
      throw new Error(
        "Cannot update future/all instances of non-recurring task"
      );
    }

    // 3. Perform scope-specific updates
    switch (scope) {
      case "single":
        return await updateSingleInstance(
          supabase,
          taskInstanceId,
          updates,
          parentTask,
          user.id
        );

      case "future":
        return await updateFutureInstances(
          supabase,
          taskInstanceId,
          updates,
          parentTask,
          user.id,
          taskInstance.scheduled_date
        );

      case "all":
        return await updateAllInstances(
          supabase,
          taskInstanceId,
          updates,
          parentTask,
          user.id
        );

      default:
        throw new Error("Invalid update scope");
    }
  } catch (error) {
    console.error("Update task error:", error);
    throw error;
  }
};

// Helper functions
async function updateSingleInstance(
  supabase: SupabaseClient,
  taskInstanceId: string,
  updates: any,
  parentTask: any,
  userId: string
) {
  console.log("tI ID: ", taskInstanceId);
  console.log("Updates: ", updates);

  const supabaseInit = await createClient();
  // Verify ownership
  if (parentTask.user_id !== userId) throw new Error("Unauthorized");

  // Update instance
  const { data: updatedInstance, error: instanceError } = await supabaseInit
    .from("task_instances")
    .update({
      duration_minutes: updates.duration_minutes,
      override_title: updates.title,
      scheduled_date: updates.start_date,
      start_time: updates.start_time,
    })
    .eq("id", taskInstanceId)
    .select("*")
    .single();

  console.log("updated instance");

  if (instanceError) throw instanceError;

  return { instance: updatedInstance };
}

async function updateFutureInstances(
  supabase: SupabaseClient,
  taskInstanceId: string,
  updates: any,
  parentTask: any,
  userId: string,
  cutoffDate: string
) {
  if (parentTask.user_id !== userId) throw new Error("Unauthorized");

  // 1. Update the edited instance
  const { data: updatedInstance, error: instanceError } = await supabase
    .from("task_instances")
    .update({
      duration_minutes: updates.duration_minutes,
      override_title: updates.title,
      scheduled_date: updates.start_date,
      start_time: updates.start_time,
    })
    .eq("id", taskInstanceId)
    .single();

  if (instanceError) throw instanceError;

  // 2. Update future instances (excluding edited one) without changing dates
  const { data: updatedInstances, error: instancesError } = await supabase
    .from("task_instances")
    .update({
      override_title: updates.title,
      duration_minutes: updates.duration_minutes,
      start_time: updates.start_time,
    })
    .gte("scheduled_date", cutoffDate)
    .eq("task_id", parentTask.id)
    .neq("id", taskInstanceId)
    .select("*");

  if (instancesError) throw instancesError;

  return {
    task: parentTask, // Parent task remains unchanged
    instances: [updatedInstance, ...updatedInstances],
  };
}

async function updateAllInstances(
  supabase: SupabaseClient,
  taskInstanceId: string,
  updates: any,
  parentTask: any,
  userId: string
) {
  if (parentTask.user_id !== userId) throw new Error("Unauthorized");

  const { data: updatedInstance, error: instanceError } = await supabase
    .from("task_instances")
    .update({
      duration_minutes: updates.duration_minutes,
      override_title: updates.title,
      scheduled_date: updates.start_date,
      start_time: updates.start_time,
    })
    .eq("id", taskInstanceId)
    .single();

  if (instanceError) throw instanceError;

  const { data: updatedInstances, error: instancesError } = await supabase
    .from("task_instances")
    .update({
      override_title: updates.title,
      duration_minutes: updates.duration_minutes,
      start_time: updates.start_time,
    })
    .eq("task_id", parentTask.id)
    .neq("id", taskInstanceId)
    .select("*");

  if (instancesError) throw instancesError;

  return { task: updatedInstance, instances: updatedInstances };
}
// **********************************************************
// HELPERS
// **********************************************************

/**
 * Toggles the completion status for a specific task occurrence
 * by creating or updating an exception record.
 * Handles both single-occurrence tasks and instances of recurring tasks.
 *
 * @param {object} payload - Data identifying the occurrence.
 * @param {string} payload.taskId - The ID of the parent task definition.
 * @param {string} payload.originalOccurrenceTimeUTC - ISO string UTC timestamp of the occurrence.
 * @param {boolean} payload.newCompletionState - The desired state (true for complete, false for incomplete).
 * @param {string} [payload.exceptionId] - Optional: The existing ID of the exception if known (for potential update optimization, though upsert handles it).
 * @returns {Promise<object>} The created or updated exception record.
 * @throws {Error} If validation or database operations fail.
 */
export const toggleTaskOccurrenceCompletionAction = async (payload) => {
  const { taskId, originalOccurrenceTimeUTC, newCompletionState, exceptionId } =
    payload;
  console.log(
    `SERVER ACTION: Toggling completion for task ${taskId} at ${originalOccurrenceTimeUTC} to ${newCompletionState}`
  );

  if (!taskId || !originalOccurrenceTimeUTC) {
    throw new Error("Task ID and original occurrence time are required.");
  }
  if (typeof newCompletionState !== "boolean") {
    throw new Error("New completion state (true/false) is required.");
  }

  // Note: We don't necessarily need to fetch the current state first with UPSERT.
  // We just tell the database what the state *should* be.

  const supabase = await createClient(); // Use server client
  // Get user ID for the exception record
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("User not authenticated.");
  }

  // Prepare payload for the modify/upsert action
  const exceptionPayload = {
    taskId: taskId,
    originalOccurrenceTimeUTC: originalOccurrenceTimeUTC,
    userId: user.id, // Use authenticated user ID
    isComplete: newCompletionState, // Set the desired state
    completionTimeISO: newCompletionState ? dayjs.utc().toISOString() : null, // Set completion time or nullify it
    isCancelled: false, // Ensure it's not marked cancelled when toggling completion
    exceptionId: exceptionId, // Pass existing ID if available (modify action might use it)
    // Set other override fields to undefined/null so UPSERT doesn't overwrite them
    // unless they were also part of this specific action (unlikely for a simple toggle).
    overrideTitle: undefined,
    newStartTimeISO: undefined,
    newDurationMinutes: undefined,
  };

  try {
    // Call the generic modify action which handles the upsert logic
    const result = await modifyTaskOccurrenceAction(exceptionPayload);
    console.log(
      `SERVER ACTION: Completion toggled successfully for task ${taskId} at ${originalOccurrenceTimeUTC}. New state: ${newCompletionState}`
    );

    // Revalidate paths after modification
    revalidatePath("/");
    revalidatePath("/protected");

    return result; // Return the result from the modify action (the upserted exception)
  } catch (error) {
    console.error("SERVER ACTION Error: Toggling completion failed.", error);
    throw error; // Re-throw
  }
};

// --- Ensure modifyTaskOccurrenceAction Exists and Handles Upsert ---
// (Should be similar to the version provided previously)
export const modifyTaskOccurrenceAction = async (payload) => {
  console.log("SERVER ACTION (modifyTaskOccurrenceAction): Received:", payload);
  const {
    taskId,
    originalOccurrenceTimeUTC,
    userId,
    exceptionId,
    ...overrides
  } = payload;

  // Basic validation
  if (
    !taskId ||
    !originalOccurrenceTimeUTC ||
    !userId ||
    userId.includes("placeholder")
  ) {
    throw new Error(
      "Task ID, original time, and valid User ID required for modification."
    );
  }
  const originalTime = dayjs.utc(originalOccurrenceTimeUTC);
  if (!originalTime.isValid()) {
    throw new Error("Invalid original occurrence time format.");
  }

  const supabase = await createClient();
  // Optional: Verify user owns the parent task if needed (RLS should handle)

  // Prepare data for upsert, handling potential null/undefined overrides
  const exceptionData = {
    task_id: taskId,
    user_id: userId,
    original_occurrence_time: originalTime.toISOString(), // Ensure ISO string for DB
    // Only include fields if they have a value to set/update
    ...(overrides.overrideTitle !== undefined && {
      override_title: overrides.overrideTitle,
    }),
    ...(overrides.newStartTimeISO !== undefined && {
      new_start_time: overrides.newStartTimeISO
        ? dayjs.utc(overrides.newStartTimeISO).toISOString()
        : null,
    }),
    ...(overrides.newDurationMinutes !== undefined && {
      new_duration_minutes: overrides.newDurationMinutes,
    }),
    ...(overrides.isCancelled !== undefined && {
      is_cancelled: overrides.isCancelled,
    }),
    ...(overrides.isComplete !== undefined && {
      is_complete: overrides.isComplete,
    }),
    ...(overrides.completionTimeISO !== undefined && {
      completion_time: overrides.completionTimeISO
        ? dayjs.utc(overrides.completionTimeISO).toISOString()
        : null,
    }),
    // updated_at is handled by trigger
  };

  console.log(
    "SERVER ACTION (modifyTaskOccurrenceAction): Upserting Data:",
    exceptionData
  );

  // --- UPSERT ---
  const { data: upsertedException, error: upsertError } = await supabase
    .from("task_instance_exceptions")
    .upsert(exceptionData, {
      onConflict: "task_id, original_occurrence_time", // Use unique constraint
      // ignoreDuplicates: false, // Default: update on conflict
    })
    .select() // Select the full record after upsert
    .single();

  if (upsertError) {
    console.error(
      "SERVER ACTION Error: Supabase upsert exception failed",
      upsertError
    );
    throw new Error(
      `Database error modifying occurrence: ${upsertError.message}`
    );
  }

  console.log(
    "SERVER ACTION (modifyTaskOccurrenceAction): Occurrence modified successfully",
    upsertedException
  );

  // Revalidation might be done in the calling action (toggle), or here too
  // revalidatePath('/');
  // revalidatePath('/protected');

  return upsertedException;
};

// **********************************************************
// AUTH ACTIONS
// **********************************************************

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  if (!email || !password) {
    return encodedRedirect(
      "error",
      "/sign-up",
      "Email and password are required"
    );
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    console.error(error.code + " " + error.message);
    return encodedRedirect("error", "/sign-up", error.message);
  } else {
    return encodedRedirect(
      "success",
      "/sign-up",
      "Thanks for signing up! Please check your email for a verification link."
    );
  }
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return encodedRedirect("error", "/sign-in", error.message);
  }

  return redirect("/");
  // return redirect("/protected");
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/protected/reset-password`,
  });

  if (error) {
    console.error(error.message);
    return encodedRedirect(
      "error",
      "/forgot-password",
      "Could not reset password"
    );
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for a link to reset your password."
  );
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password and confirm password are required"
    );
  }

  if (password !== confirmPassword) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Passwords do not match"
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password update failed"
    );
  }

  encodedRedirect("success", "/protected/reset-password", "Password updated");
};

export const signOutAction = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/sign-in");
};
