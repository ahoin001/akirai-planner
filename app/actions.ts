"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { RRule, RRuleSet, rrulestr } from "rrule";
import { revalidatePath } from "next/cache"; // For refreshing UI data
import { count } from "console";

dayjs.extend(utc);
dayjs.extend(timezone);

// ***************
// * CREATE ACTIONS
// ***************
export const createTaskAction = async (taskData) => {
  console.log("SERVER ACTION (createTaskAction): Received Data:", taskData);

  try {
    const supabase = await createClient();
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
    const timeZone = taskData.timezone || dayjs.tz.guess() || "UTC";
    const localStartDateTime = dayjs.tz(
      `${taskData.start_date} ${taskData.start_time}`,
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
        count: null,
        until: null,
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
    console.log("SERVER ACTION: Task Data: ", taskData);
    console.log("SERVER ACTION: Inserting task definition into database...");
    const { data: insertedTask, error: insertError } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        title: taskData.title.trim(),
        icon_name: taskData.icon_name || "Activity",
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

    return insertedTask;
  } catch (error) {
    // Log the detailed error on the server
    console.error("SERVER ACTION Error: Task creation failed.", error);
    // Throw a user-friendly error message back to the client
    // Re-throw the original error object for better debugging in some cases
    throw error; // Or: throw new Error(error.message || "Failed to create task.");
  }
};

// *******************
// * DELETE ACTIONS
// *******************
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

    // revalidatePath("/"); // Revalidate relevant paths
    // revalidatePath("/protected");
    return { success: true };
  } catch (error) {
    console.error(
      "SERVER ACTION Error: deleteSingleTaskOrOccurrenceAction failed.",
      error
    );
    throw error; // Re-throw
  }
};

// **********************************************************
// UPDATES
// **********************************************************

// --- Update Task Definition (Rule) ---
/**
 * Updates the main definition (rule) of a task in the 'tasks' table.
 * Handles scope ('future', 'all') to adjust RRULE or cleanup exceptions.
 * NOTE: Scope 'single' should call modifyTaskOccurrenceAction directly.
 *
 * @param {string} taskId - The ID of the task definition to update.
 * @param {object} taskData - Object containing the updated fields from the form.
 *   Requires _originalOccurrenceTimeUTC if scope is 'future'.
 * @param {'future' | 'all'} scope - How widely the changes should apply.
 * @returns {Promise<object>} The updated or newly created task definition record.
 * @throws {Error} If validation or database operations fail.
 */
export const updateTaskDefinitionAction = async (taskId, taskData, scope) => {
  console.log(
    `SERVER ACTION (updateTaskDefinitionAction): Updating task ${taskId} with scope ${scope}`,
    taskData
  );
  // --- Basic Validation ---
  if (!taskId) throw new Error("Task ID is required for update.");
  if (scope !== "future" && scope !== "all")
    throw new Error("Update scope must be 'future' or 'all'.");
  if (!taskData) throw new Error("Task data is required.");
  // ... (Add back other core field validations: title, start_date, start_time, duration, frequency if scope !='single') ...
  if (!taskData.title?.trim()) throw new Error("Title required.");
  if (
    !taskData.start_date ||
    !taskData.start_time?.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  )
    throw new Error("Valid Start Date/Time required.");
  if (!taskData.duration_minutes || taskData.duration_minutes < 1)
    throw new Error("Valid Duration required.");
  if (!taskData.recurrence?.frequency) throw new Error("Frequency required."); // Expect nested recurrence from form
  if (scope === "future" && !taskData._originalOccurrenceTimeUTC) {
    throw new Error(
      "Original occurrence time context required for 'future' scope update."
    );
  }
  // --- End Validation ---

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("User not authenticated.");

  // --- Fetch Original Task ---
  const { data: originalTask, error: fetchError } = await supabase
    .from("tasks")
    .select("id, user_id, dtstart, rrule, timezone, status")
    .eq("id", taskId)
    .single();
  if (fetchError || !originalTask)
    throw new Error("Original task not found or DB error.");
  if (originalTask.user_id !== user.id) throw new Error("Unauthorized.");

  try {
    // --- Calculate new common properties based on taskData ---
    const timeZone = taskData.timezone || originalTask.timezone; // Use provided or original timezone
    const localStartDateTime = dayjs.tz(
      `${taskData.start_date} ${taskData.start_time}`,
      "YYYY-MM-DD HH:mm",
      timeZone
    );
    if (!localStartDateTime.isValid())
      throw new Error("Invalid updated start date/time.");
    const newDtstartISO = localStartDateTime.toISOString(); // For DB TIMESTAMPTZ field
    const newDtstartDate = localStartDateTime.toDate(); // For RRule library
    const newDuration = parseInt(taskData.duration_minutes, 10);
    const newTitle = taskData.title.trim();
    const newStatus = taskData.status || originalTask.status || "active";

    // --- Generate the NEW RRULE String based on form's recurrence data ---
    let newRruleString = null;
    const {
      frequency,
      interval = 1,
      end_type = "never",
      occurrences,
      end_date,
    } = taskData.recurrence || {};
    if (frequency && frequency !== "once") {
      const freqMap = {
        daily: RRule.DAILY,
        weekly: RRule.WEEKLY,
        monthly: RRule.MONTHLY,
      };
      if (!freqMap[frequency])
        throw new Error(`Invalid frequency: ${frequency}`);
      const ruleOptions: any = {
        freq: freqMap[frequency],
        interval: Math.max(1, parseInt(interval, 10) || 1),
        // Base the rule generation on the NEW dtstart date/time
        dtstart: newDtstartDate,
      };
      // Apply end condition FROM THE FORM DATA
      switch (end_type) {
        case "after":
          ruleOptions.count = Math.max(1, parseInt(occurrences, 10) || 1);
          break;
        case "on":
          if (!end_date) throw new Error("End date required for 'on'.");
          const untilDateTime = dayjs
            .tz(end_date, "YYYY-MM-DD", timeZone)
            .endOf("day");
          if (
            !untilDateTime.isValid() ||
            untilDateTime.isBefore(localStartDateTime, "day")
          )
            throw new Error("Invalid end date.");
          ruleOptions.until = untilDateTime.utc().toDate();
          break;
        case "never":
        default:
          break;
      }
      try {
        newRruleString = new RRule(ruleOptions).toString();
      } catch (e) {
        throw new Error(`Failed to generate new rule: ${e.message}`);
      }
    }

    // --- Prepare base payload for updating the 'tasks' table ---
    const taskUpdatePayload = {
      title: newTitle,
      // dtstart: newDtstartISO, // Decide: Update start for 'all' or only for new task in 'future'? Let's update only for 'all'.
      duration_minutes: newDuration,
      icon_name: taskData.icon_name || "Activity",
      rrule: newRruleString, // The new rule based on form input
      timezone: timeZone,
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // --- Execute based on scope ---
    let finalResultTask;

    if (scope === "all") {
      // --- "All Occurrences" Logic ---
      console.log(
        `SERVER ACTION: Updating task ${taskId} for ALL occurrences.`
      );
      // Update the original task record with the full payload, INCLUDING new dtstart
      const { data: updatedTask, error: updateError } = await supabase
        .from("tasks")
        .update({ ...taskUpdatePayload, dtstart: newDtstartISO }) // Update dtstart for 'all'
        .eq("id", taskId)
        .select()
        .single();
      if (updateError)
        throw new Error(`DB update error ('all'): ${updateError.message}`);
      finalResultTask = updatedTask;

      // Delete ALL existing exceptions
      console.log(`Deleting ALL exceptions for task ${taskId}`);
      await supabase
        .from("task_instance_exceptions")
        .delete()
        .eq("task_id", taskId);
    } else if (scope === "future") {
      // --- "This and Future" Logic (Series Splitting) ---
      console.log(
        `SERVER ACTION: Splitting task ${taskId} for FUTURE occurrences.`
      );
      const originalOccurrenceTimeUTC = taskData._originalOccurrenceTimeUTC; // Get from payload
      if (!originalOccurrenceTimeUTC)
        throw new Error("Original time missing for future scope.");

      // 1. End the OLD task rule just before the split point
      const oldUntilDateTime = dayjs
        .utc(originalOccurrenceTimeUTC)
        .subtract(1, "millisecond");
      let oldRruleUpdated = null;
      if (originalTask.rrule) {
        try {
          const oldRule = rrulestr(originalTask.rrule, {
            dtstart: dayjs.utc(originalTask.dtstart).toDate(),
          });
          const oldOptions = {
            ...oldRule.options,
            until: oldUntilDateTime.toDate(),
            count: undefined,
          };
          // Only update if the new end is after the original start
          if (oldUntilDateTime.isAfter(dayjs.utc(originalTask.dtstart))) {
            oldRruleUpdated = new RRule(oldOptions).toString();
          }
        } catch (e) {
          throw new Error(`Failed to modify original task rule: ${e.message}`);
        }
      }
      // Update original task - ONLY change rrule and updated_at
      const { error: updateOldError } = await supabase
        .from("tasks")
        .update({
          rrule: oldRruleUpdated,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId);
      if (updateOldError)
        throw new Error(
          `DB error ending original task: ${updateOldError.message}`
        );
      console.log(
        `Ended original task ${taskId} with rule: ${oldRruleUpdated}`
      );

      // 2. Create a NEW task definition for the future series
      const { data: newTask, error: insertNewError } = await supabase
        .from("tasks")
        .insert({
          // Insert new row with updated details
          user_id: user.id,
          title: newTitle,
          dtstart: newDtstartISO, // Starts at the NEW time specified in form
          duration_minutes: newDuration,
          rrule: newRruleString, // The NEW rule (with form's end condition)
          timezone: timeZone,
          status: "active",
        })
        .select()
        .single();
      if (insertNewError)
        throw new Error(
          `DB error creating new future task: ${insertNewError.message}`
        );
      console.log(
        `Created new task ${newTask.id} for future occurrences starting ${newDtstartISO}.`
      );
      finalResultTask = newTask; // Return the NEW task

      // 3. Delete exceptions from OLD task occurring ON or AFTER the split point
      console.log(
        `Deleting future exceptions for OLD task ${taskId} from ${originalOccurrenceTimeUTC}`
      );
      await supabase
        .from("task_instance_exceptions")
        .delete()
        .eq("task_id", taskId)
        .gte("original_occurrence_time", originalOccurrenceTimeUTC);
    } else {
      // Should have been caught earlier or handled as 'single' via modifyTaskOccurrenceAction
      throw new Error(
        `Invalid scope '${scope}' reached in updateTaskDefinitionAction.`
      );
    }

    console.log(
      `SERVER ACTION: Task definition update (scope: ${scope}) successful.`
    );
    revalidatePath("/");
    revalidatePath("/protected");
    return finalResultTask;
  } catch (error) {
    console.error(
      "SERVER ACTION Error: Updating task definition failed.",
      error
    );
    throw error;
  }
};

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
  const supabase = await createClient(); // Get server client
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error("SERVER ACTION Error: Authentication Failed", authError);
    throw new Error("User not authenticated");
  }

  const userId = user.id;

  const {
    taskId,
    originalOccurrenceTimeUTC,
    // userId,
    exceptionId,
    ...overrides
  } = payload;

  // Basic validation
  if (!taskId) {
    throw new Error("Task ID is required for modification.");
  }
  if (!originalOccurrenceTimeUTC) {
    throw new Error("Original occurrence time is required for modification.");
  }
  if (!userId) {
    throw new Error("User ID is required for modification.");
  }
  if (userId.includes("placeholder")) {
    throw new Error("User ID contains an invalid placeholder value.");
  }

  const originalTime = dayjs.utc(originalOccurrenceTimeUTC);
  if (!originalTime.isValid()) {
    throw new Error("Invalid original occurrence time format.");
  }

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

export const signInWithGoogle = async () => {
  // const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.SITE_URL}/auth/callback`,
      // redirectTo:
      //   process.env.NODE_ENV === "development"
      //     ? "http://localhost:3000/auth/callback"
      //     : "https://akirai-planner.vercel.app",
    },
  });

  console.log("DATA URL: ", data?.url);
  console.log("ENV STATe: ", process.env.NODE_ENV);
  console.log("Redirect URL: ", process.env.NEXT_PUBLIC_SITE_URL);

  if (data.url) {
    redirect(data.url);
  }
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
