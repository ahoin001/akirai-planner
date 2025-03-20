import { create } from "zustand";
import { toast } from "react-hot-toast";

import { createClient as createSupabaseBrowserClient } from "@/utils/supabase/client";

// Helpers
const TIME_FORMAT = "HH:mm";
const DATE_FORMAT = "YYYY-MM-DD";
const MAX_OCCURRENCES = 25; // Safety cap

export const useTaskStore = create((set, get) => ({
  tasks: [],
  taskInstances: [],
  isLoading: false,
  error: null,

  // Call this function to hydrate and subscribe when app loads
  hydrateAndSubscribe: async (startDate) => {
    // Fetch initial tasks and task instances
    await get().getTasksFromWeekWithInstances(startDate);

    // Setup realtime subscriptions and return the unsubscribe function
    const unsubscribe = await get().setupRealtimeSubscriptions();
    return unsubscribe; // This should return the unsubscribe function
  },

  getTasksFromWeekWithInstances: async (startDate) => {
    const endDate = startDate.add(6, "days"); // Add 6 days to the start date to get the week

    try {
      set({ isLoading: true });

      const supabase = await createSupabaseBrowserClient();

      // Fetch the user from supabase auth
      const { data: user, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("User not authenticated");

      console.log("User fetching:", user.user.id);

      // Get the authenticated user
      // const user = await ensureAuthenticated();

      // const {
      //   data: { user },
      //   error: authError,
      // } = await supabase.auth.getUser();
      // if (authError || !user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("task_instances")
        .select(
          `
          *,
          tasks!task_instances_task_id_fkey (
            id,
            title,
            start_date,
            start_time,
            duration_minutes,
            recurrence,
            is_recurring,
            created_at
          )
        `
        )
        .gte("scheduled_date", startDate.format(DATE_FORMAT))
        .lte("scheduled_date", endDate.format(DATE_FORMAT))
        // .eq("is_cancelled", false)
        .eq("user_id", user.user.id)
        .order("scheduled_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      set({ taskInstances: data, isLoading: false });

      console.log("Task instances:", data);
      console.log("Task set on instances:", get().taskInstances);

      //   return data;
    } catch (error) {
      console.error("Error fetching tasks:", error);
      throw error;
    }
  },

  // Load initial tasks
  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      set({ tasks: data, isLoading: false });
    } catch (error) {
      console.error("Error fetching tasks:", error);
      set({ error: error.message, isLoading: false });
      toast.error("Failed to load tasks");
    }
  },

  // Load task instances
  fetchTaskInstances: async (startDate, endDate) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("task_instances")
        .select("*")
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate)
        .order("scheduled_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      set({ taskInstances: data, isLoading: false });
    } catch (error) {
      console.error("Error fetching task instances:", error);
      set({ error: error.message, isLoading: false });
      toast.error("Failed to load task instances");
    }
  },

  // Create a new task
  v0createTask: async (taskData) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert(taskData)
        .select()
        .single();

      if (error) throw error;

      // No need to manually update state as we'll get the update via realtime
      set({ isLoading: false });
      toast.success("Task created successfully");
      return data;
    } catch (error) {
      console.error("Error creating task:", error);
      set({ error: error.message, isLoading: false });
      toast.error("Failed to create task");
      return null;
    }
  },

  /**
   *
   * @param {*} taskData
   * @returns
   */
  createTask: async (taskData) => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Not authenticated");

      // Create parent task
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert([
          {
            user_id: user.id,
            ...taskData,
            is_recurring: taskData.recurrence !== null,
            time_zone: "America/New_York", // TODO get timezone dynamically dayjs.tz.guess()
          },
        ])
        .select("*")
        .single();

      if (taskError) throw taskError;

      // TODO ADD TO ACTIONS TO AUTO MAKE INSTANCES
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
  },

  // Update an existing task
  updateTask: async (id, taskData) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("tasks")
        .update(taskData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // No need to manually update state as we'll get the update via realtime
      set({ isLoading: false });
      toast.success("Task updated successfully");
      return data;
    } catch (error) {
      console.error("Error updating task:", error);
      set({ error: error.message, isLoading: false });
      toast.error("Failed to update task");
      return null;
    }
  },

  // Delete a task
  deleteTask: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", id);

      if (error) throw error;

      // No need to manually update state as we'll get the update via realtime
      set({ isLoading: false });
      toast.success("Task deleted successfully");
    } catch (error) {
      console.error("Error deleting task:", error);
      set({ error: error.message, isLoading: false });
      toast.error("Failed to delete task");
    }
  },

  // Update a task instance (e.g., mark as completed)
  updateTaskInstance: async (id, instanceData) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("task_instances")
        .update({
          ...instanceData,
          updated_at: new Date().toISOString(),
          ...(instanceData.is_completed
            ? { completion_time: new Date().toISOString() }
            : {}),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // No need to manually update state as we'll get the update via realtime
      set({ isLoading: false });
      toast.success("Task instance updated");
      return data;
    } catch (error) {
      console.error("Error updating task instance:", error);
      set({ error: error.message, isLoading: false });
      toast.error("Failed to update task instance");
      return null;
    }
  },

  // Setup realtime subscriptions
  setupRealtimeSubscriptions: async () => {
    const supabase = await createSupabaseBrowserClient();

    // Tasks channel
    const tasksChannel = supabase
      .channel("tasks-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          switch (eventType) {
            case "INSERT":
              console.log("new:", newRecord);
              console.log("current:", get().taskInstances);
              set((state) => ({
                tasks: [newRecord, ...state.tasks],
              }));
              break;
            case "UPDATE":
              set((state) => ({
                tasks: state.tasks.map((task) =>
                  task.id === newRecord.id ? newRecord : task
                ),
              }));
              break;
            case "DELETE":
              set((state) => ({
                tasks: state.tasks.filter((task) => task.id !== oldRecord.id),
              }));
              break;
            default:
              break;
          }
        }
      )
      .subscribe();

    // Task instances channel
    const taskInstancesChannel = supabase
      .channel("task-instances-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_instances",
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          switch (eventType) {
            case "INSERT":
              set((state) => ({
                taskInstances: [...state.taskInstances, newRecord],
              }));

              break;
            case "UPDATE":
              set((state) => ({
                taskInstances: state.taskInstances.map((instance) =>
                  instance.id === newRecord.id ? newRecord : instance
                ),
              }));
              break;
            case "DELETE":
              set((state) => ({
                taskInstances: state.taskInstances.filter(
                  (instance) => instance.id !== oldRecord.id
                ),
              }));
              break;
            default:
              break;
          }
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(taskInstancesChannel);
    };
  },
}));
