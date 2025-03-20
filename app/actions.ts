"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import dayjs from "dayjs";

const MAX_OCCURRENCES = 25; // Safety cap

/**
 *
 * @param {*} taskData
 * @returns
 */
export async function createTaskAction(taskData) {
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
}

export async function generateTaskInstances(task) {
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
}

// export const v1createTaskAction = async (taskData) => {
//   console.log("sevrer task data: ", taskData);
//   try {
//     const supabase = await createClient();

//     // Get authenticated user
//     const {
//       data: { user },
//       error: authError,
//     } = await supabase.auth.getUser();
//     if (authError || !user) {
//       throw new Error(
//         "Not authenticated: " + (authError?.message || "No user found")
//       );
//     }

//     console.log("sevrer user: ", user);
//     console.log("sevrer task data: ", taskData);
//     // Create parent task
//     const { data: task, error: taskError } = await supabase
//       .from("tasks")
//       .insert([
//         {
//           user_id: user.id,
//           ...taskData,
//           is_recurring: taskData.recurrence !== null,
//           // time_zone: "America/New_York", // TODO get timezone dynamically dayjs.tz.guess()
//         },
//       ])
//       .select("*")
//       .single();
//     console.log("sevrer task insert: ", task);

//     if (taskError) throw taskError;

//     // const { data: task, error: taskError } = await supabase
//     //   .from("tasks")
//     //   .insert([
//     //     {
//     //       user_id: user.id,
//     //       ...taskData,
//     //       is_recurring: taskData.recurrence !== null,
//     //       time_zone: "America/New_York",
//     //     },
//     //   ])
//     //   .select()
//     //   .single();

//     // if (taskError) throw taskError;

//     // ✅ Revalidate cache so UI updates
//     // revalidatePath("/");

//     return task;
//   } catch (error) {
//     console.error("Create task error:", error);
//     throw error;
//   }
// };

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
