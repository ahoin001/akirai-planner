"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { SupabaseClient } from "@supabase/supabase-js";

// Extend Day.js with required plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const DATE_FORMAT = "YYYY-MM-DD";
const MAX_OCCURRENCES = 25; // Safety cap

/**
 *
 * @param {*} taskData
 * @returns
 */
export const createTaskAction = async (taskData) => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("User not authenticated");

    // Validate required fields
    const requiredFields = {
      title: "Task title is required",
      start_date: "Start date is required",
      start_time: "Start time is required",
    };

    Object.entries(requiredFields).forEach(([field, message]) => {
      if (!taskData[field]) throw new Error(message);
    });

    // Validate duration
    const {
      data: { value: limits },
    } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "task_limits")
      .single();

    const maxDuration = limits?.max_duration_minutes || 1440;
    if (
      taskData.duration_minutes < 1 ||
      taskData.duration_minutes > maxDuration
    ) {
      throw new Error(`Duration must be between 1 and ${maxDuration} minutes`);
    }

    // Process timezone-aware dates
    const timeZone = taskData.timezone || "UTC";
    const localDateTime = dayjs.tz(
      `${taskData.start_date}T${taskData.start_time}`,
      timeZone
    );

    if (!localDateTime.isValid()) {
      throw new Error("Invalid date/time combination");
    }

    // Convert to UTC
    const utcDateTime = localDateTime.utc();
    const utcDate = utcDateTime.format("YYYY-MM-DD");
    const utcTime = utcDateTime.format("HH:mm");

    // Handle recurrence configuration
    let isRecurring = false;
    let recurrence = null;

    if (taskData.recurrence?.frequency) {
      const validFrequencies = ["daily", "weekly", "monthly", "yearly"];

      if (taskData.recurrence.frequency === "once") {
        // Explicitly handle single occurrence
        isRecurring = false;
        recurrence = null;
      } else if (validFrequencies.includes(taskData.recurrence.frequency)) {
        // Handle valid recurring task
        isRecurring = true;
        recurrence = {
          frequency: taskData.recurrence.frequency,
          interval: Math.max(1, parseInt(taskData.recurrence.interval) || 1),
          occurrences: Math.max(
            1,
            parseInt(taskData.recurrence.occurrences) || 1
          ),
        };
      } else {
        throw new Error(
          `Invalid recurrence frequency: ${taskData.recurrence.frequency}`
        );
      }
    }

    // Database insert
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        title: taskData.title,
        start_date: utcDate,
        start_time: utcTime,
        duration_minutes: taskData.duration_minutes,
        is_recurring: isRecurring,
        recurrence: recurrence,
        timezone: timeZone,
        status: "active",
      })
      .select()
      .single();

    if (error) throw new Error(`Database error: ${error.message}`);

    return data;
  } catch (error) {
    console.error("Task creation failed:", error);
    throw new Error(error.message || "Failed to create task");
  }
};

// **********************************************************
// DELETES
// **********************************************************
/**
 * Deletes the future instances of a recurring task (keeps past instances)
 * @param {string} taskId - ID of the recurring task
 * @param {string} cutoffDate - Delete instances from this date forward (YYYY-MM-DD)
 */
export const deleteFutureRecurringInstances = async (
  taskId: string,
  cutoffDate: string = dayjs().format(DATE_FORMAT)
) => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("User not authenticated");

    // 1. Verify task ownership and recurrence
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("user_id, is_recurring")
      .eq("id", taskId)
      .single();

    if (taskError) throw taskError;
    if (task.user_id !== user.id) throw new Error("Unauthorized");
    if (!task.is_recurring) throw new Error("Task is not recurring");

    // 2. Delete future instances
    const { error: deleteError } = await supabase
      .from("task_instances")
      .delete()
      .gte("scheduled_date", cutoffDate)
      .eq("task_id", taskId);

    if (deleteError) throw deleteError;

    return { success: true, deletedFrom: cutoffDate };
  } catch (error) {
    console.error("Future instances deletion failed:", error);
    throw error;
  }
};

/**
 * Deletes a PARENT task and ALL its instances (for recurring tasks)
 * @param {string} taskId - ID of the parent task to delete
 */
export const deleteTaskAndAllInstances = async (taskId: string) => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("User not authenticated");

    // 1. Verify task ownership
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("user_id")
      .eq("id", taskId)
      .single();

    if (taskError) throw taskError;
    if (task.user_id !== user.id)
      throw new Error("Unauthorized, task belongs to different user");

    // 2. Delete all instances first
    const { error: instancesError } = await supabase
      .from("task_instances")
      .delete()
      .eq("task_id", taskId);

    if (instancesError) throw instancesError;

    // 3. Delete parent task
    const { error: taskDeleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId);

    if (taskDeleteError) throw taskDeleteError;

    return { success: true, deletedTaskId: taskId };
  } catch (error) {
    console.error("Full task deletion failed:", error);
    throw error;
  }
};

/**
 * Deletes a parent task AND ALL instances by providing any INSTANCE ID from the series
 * @param {string} instanceId - ID of any instance in the series
 */
export const deleteTaskSeriesByInstanceId = async (instanceId: string) => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("User not authenticated");

    // 1. Get parent task ID from instance
    const { data: instance, error: instanceError } = await supabase
      .from("task_instances")
      .select("task_id, tasks!inner(user_id)")
      .eq("id", instanceId)
      .single();

    if (instanceError) throw instanceError;
    if (instance.tasks.user_id !== user.id) throw new Error("Unauthorized");

    // 2. Use existing bulk delete function
    return await deleteTaskAndAllInstances(instance.task_id);
  } catch (error) {
    console.error("Series deletion by instance failed:", error);
    throw error;
  }
};

export const deleteSingleTaskInstance = async (taskInstanceId) => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error(
        "Not authenticated: " +
          (authError?.message || "No user found to delete task")
      );
    }

    const { data: taskInstance, error: deleteTaskInstanceError } =
      await supabase.from("task_instances").delete().eq("id", taskInstanceId);

    if (deleteTaskInstanceError) throw deleteTaskInstanceError;

    return { success: true, deletedTaskId: taskInstanceId };
  } catch (error) {
    console.error("Delete task error:", error);
    throw error;
  }
};

// **********************************************************
// UPDATES
// **********************************************************

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
 * Toggles completion status for an instance
 * @param {string} instanceId - Instance ID
 * @returns {Promise<TaskInstance>}
 */
export const toggleTaskInstanceCompletionAction = async (instanceId) => {
  try {
    console.log("instanceId: ", instanceId);
    const supabase = await createClient();

    const { data: current, error: fetchError } = await supabase
      .from("task_instances")
      .select("is_complete")
      .eq("id", instanceId)
      .single();

    if (fetchError) throw fetchError;

    // Toggle value
    const { data, error } = await supabase
      .from("task_instances")
      .update({ is_complete: !current.is_complete })
      .eq("id", instanceId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Toggle completion error:", error);
    throw error;
  }
};

// export const updateTask = async (
//   taskInstanceId: string,
//   updates: object,
//   scope: "single" | "future" | "all" = "single"
// ) => {
//   try {
//     console.log("In updates: ", updates);
//     const supabase = await createClient();
//     const {
//       data: { user },
//     } = await supabase.auth.getUser();

//     if (!user) throw new Error("Not authenticated");

//     // Get parent task details
//     const { data: instance, error: fetchError } = await supabase
//       .from("task_instances")
//       .select("task_id, tasks!inner(*), scheduled_date")
//       .eq("id", taskInstanceId)
//       .single();

//     if (fetchError) throw fetchError;
//     if (instance.tasks.user_id !== user.id) throw new Error("Unauthorized");

//     const parentTask = instance.tasks;

//     switch (scope) {
//       case "single":
//         return await updateSingleTaskInstance(taskInstanceId, updates);
//       case "future":
//         return await updateFutureRecurringInstances(
//           parentTask.id,
//           updates,
//           instance.scheduled_date
//         );
//       case "all":
//         return await updateTaskAndAllInstances(parentTask.id, updates);
//       default:
//         throw new Error("Invalid update scope");
//     }
//   } catch (error) {
//     console.error("Task update failed:", error);
//     throw error;
//   }
// };

export const generateTaskInstances = async (task) => {
  try {
    // Validate required fields
    if (!task?.start_date || !/^\d{4}-\d{2}-\d{2}$/.test(task.start_date)) {
      throw new Error("Invalid start_date");
    }

    // Configure generation
    const isRecurring = task.is_recurring && task.recurrence;
    const occurrences = isRecurring
      ? Math.min(task.recurrence.occurrences || 1, MAX_OCCURRENCES)
      : 1;

    // Timezone setup
    const tz = task.time_zone || "UTC";
    const timePart = task.start_time?.match(/^\d{2}:\d{2}$/)
      ? task.start_time
      : "00:00";

    // Create initial date in the specified timezone
    let currentDate = dayjs.tz(`${task.start_date}T${timePart}`, tz);

    // Generate instances
    const instances = [];
    let interval = 1;

    // TODO FIX RECURRENCE
    if (isRecurring) {
      if (
        !["daily", "weekly", "monthly", "yearly"].includes(
          task.recurrence.frequency
        )
      ) {
        throw new Error("Invalid recurrence frequency");
      }
      interval = Math.min(task.recurrence.interval || 1, 365);
    }

    for (let i = 0; i < occurrences; i++) {
      instances.push({
        ...task,
        start_date: currentDate.utc().format("YYYY-MM-DD"),
        start_time: currentDate.utc().format("HH:mm"),
        sequence_number: i + 1,
        is_recurring: false, // All instances are single-occurrence
      });

      // Only calculate the next date for recurring tasks
      // if (isRecurring && i < occurrences - 1) {
      //   currentDate = {
      //     daily: () => currentDate.add(interval, "day"),
      //     weekly: () => currentDate.add(interval, "week"),
      //     monthly: () => currentDate.add(interval, "month"),
      //     yearly: () => currentDate.add(interval, "year"),
      //   }[task.recurrence.frequency]();
      // }
    }

    return instances;
  } catch (error) {
    console.error("Generation failed:", error.message);
    return [];
  }
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
