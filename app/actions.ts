"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

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

export const updateTask = async (
  taskInstanceId,
  updates,
  updateFuture = false
) => {
  console.log("Task Instance ID: ", taskInstanceId);
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

    // 1. Fetch the task instance and its associated tasks
    const { data: taskInstance, error: fetchInstanceError } = await supabase
      .from("task_instances")
      .select("*, tasks!fk_task_instances_tasks(*)") // Explicitly specify the relationship
      .eq("id", taskInstanceId)
      .single();

    console.log("BIG UPDATE: ", updates);

    if (fetchInstanceError) throw fetchInstanceError;

    // Extract the parent task (first item in the tasks array)
    const parentTask = taskInstance.tasks;
    if (!parentTask) throw new Error("Parent task not found in task instance");

    // 2. Update the task instance
    console.log("before update of instance: ");
    const { data: updatedInstance, error: instanceError } = await supabase
      .from("task_instances")
      .update({
        scheduled_date: updates.start_date || taskInstance.scheduled_date,
        start_time: updates.start_time || taskInstance.start_time,
        duration_minutes:
          updates.duration_minutes || taskInstance.duration_minutes,
        is_completed: updates.is_completed ?? taskInstance.is_completed,
      })
      .eq("id", taskInstanceId)
      .select("*")
      .single();
    console.log("after update of instance: ");

    if (instanceError) throw instanceError;

    // 3. Update the parent task if needed
    const { data: updatedTask, error: taskError } = await supabase
      .from("tasks")
      .update({
        start_date: updates.start_date,
        title: updates.title,
      })
      .eq("id", parentTask.id)
      .select("*")
      .single();

    if (taskError) throw taskError;

    // 4. Update future instances if the task is recurring and updateFuture is true
    let updatedInstances = [];

    if (parentTask.is_recurring && updateFuture) {
      const { data, error } = await supabase
        .from("task_instances")
        .update({
          start_time: updates.start_time,
          duration_minutes: updates.duration_minutes,
          is_completed: updates.is_completed,
        })
        .gte("scheduled_date", dayjs().format(DATE_FORMAT))
        .eq("task_id", parentTask.id)
        .eq("is_rescheduled", false)
        .select("*");

      if (error) throw error;
      updatedInstances = data;
    }

    return {
      task: updatedTask,
      instance: updatedInstance,
      instances: updatedInstances,
    };
  } catch (error) {
    console.error("Update task error:", error);
    throw error;
  }
};

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

// ***********
// Auth Actions
// ***********

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
