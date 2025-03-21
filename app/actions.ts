"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import dayjs from "dayjs";

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

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error(
        "Not authenticated: " + (authError?.message || "No user found")
      );
    }

    console.log("sevrer user: ", user);
    console.log("sevrer task data: ", taskData);

    // Create parent task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert([
        {
          user_id: user.id,
          ...taskData,
          is_recurring: taskData.recurrence !== null,
        },
      ])
      .select("*")
      .single();

    if (taskError) throw taskError;

    // Create initial instance
    const { data: instance, error: instanceError } = await supabase
      .from("task_instances")
      .insert([
        {
          task_id: task.id,
          user_id: user.id,
          scheduled_date: task.start_date,
          start_time: task.start_time,
          duration_minutes: task.duration_minutes,
          original_start_time: task.start_time,
          original_duration: task.duration_minutes,
        },
      ])
      .single();

    if (instanceError) throw instanceError;

    // Generate future instances if recurring
    let futureInstances = [];
    if (task.is_recurring) {
      futureInstances = await generateTaskInstances(task);
    }

    return {
      task,
      instances: [instance, ...futureInstances],
    };
  } catch (error) {
    console.error("Create task error:", error);
    throw error;
  }
};

export const deleteTaskAction = async (taskInstanceId) => {
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

    // 1. Fetch the task instance to get the associated task_id
    const { data: taskInstance, error: fetchInstanceError } = await supabase
      .from("task_instances")
      .select("task_id")
      .eq("id", taskInstanceId)
      .single();

    if (fetchInstanceError) throw fetchInstanceError;

    const taskId = taskInstance.task_id;
    if (!taskId) throw new Error("Parent task ID not found in task instance");

    // 2. Delete all task instances associated with the task
    const { count: deletedInstancesCount, error: deleteInstancesError } =
      await supabase.from("task_instances").delete().eq("task_id", taskId);

    if (deleteInstancesError) throw deleteInstancesError;

    // 3. Delete the parent task
    const { data: deletedTask, error: deleteTaskError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .select("*")
      .single();

    if (deleteTaskError) throw deleteTaskError;

    return { deletedTask, deletedInstancesCount: deletedInstancesCount || 0 };
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
