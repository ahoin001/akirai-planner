import { create } from "zustand";
import { toast } from "react-hot-toast";

import { createClient as createSupabaseBrowserClient } from "@/utils/supabase/client";
import dayjs from "dayjs";
import { title } from "process";

// Helpers
// const TIME_FORMAT = "HH:mm";
// const DATE_FORMAT = "YYYY-MM-DD";
// const MAX_OCCURRENCES = 25; // Safety cap

// TODO I NEED TO FIX TASK CREATE TO ONLY INSERT INSTANCE INTO REALTIME CHANGE

export const useTaskStore = create((set, get) => ({
  // **********************************************************
  // STATE
  // **********************************************************
  // UI state
  activeModal: null,
  currentWeekStart: dayjs().startOf("week"),
  error: null,
  isEditingTask: false,
  isLoading: false,
  isTaskFormOpen: false,
  isTaskMenuOpen: false,

  // task state
  pendingUpdates: null,
  selectedTask: null,
  tasks: [],
  taskFormValues: {},
  taskInstances: [],
  updateScope: null, // For if form should update instance all or future occurrences

  // Implemeting the tasks store from calendar store
  // selectedDay: new Date(),
  selectedDay: dayjs().day(),
  isTransitioning: false,

  // **********************************************************
  // GETTERS
  // **********************************************************

  /**
   * Compares dates in MM-DD-YYYY format to return tasks for the specific day
   * @param {Date | string} date - The date to compare against
   * @returns {Array} Filtered tasks for the given day
   */
  getTasksForFormattedDay: (date) => {
    const { taskInstances } = get();

    // Format the passed-in date to MM-DD-YYYY
    const formattedDate = dayjs(date).format("MM-DD-YYYY");

    // Filter tasks based on scheduled_date, comparing formatted dates
    return taskInstances.filter((task) => {
      const formattedTaskDate = dayjs(task.scheduled_date).format("MM-DD-YYYY");
      return formattedTaskDate === formattedDate;
    });
  },

  // **********************************************************
  // SETTERS
  // **********************************************************
  clearPendingUpdates: () => set({ pendingUpdates: null, updateScope: null }),

  closeTaskForm: () => set({ isTaskFormOpen: false }),

  closeTaskMenu: () => set({ isTaskMenuOpen: false }),

  setActiveModal: (modal) => set({ activeModal: modal }),

  setPendingUpdates: (updates) => set({ pendingUpdates: updates }),

  setTaskForm: (isOpen) => set({ isTaskFormOpen: isOpen }),

  setUpdateScope: (value) => set({ updateScope: value }),

  // **********************************************************
  // UI
  // **********************************************************

  // TODO Refine this as needed for efficient task fetching when changing weeks
  /**
   * Changes the current week
   * @param {string} direction - Direction to change ('prev' or 'next')
   */
  changeWeek: (direction) => {
    const { currentWeekStart, isTransitioning, selectedDay } = get();

    if (isTransitioning) return;

    // Get the day of week of the currently selected day (0 = Sunday, 6 = Saturday)
    const selectedDayOfWeek = get().selectedDay;
    console.log("selectedDay: ", selectedDay);

    // Calculate the new week start
    const newWeekStart = addWeeks(
      currentWeekStart,
      direction === "prev" ? -1 : 1
    );

    // Calculate the same day of week in the new week
    const newSelectedDay = dayjs(newWeekStart).add(selectedDayOfWeek, "day");

    // const newTasks = generateTasks(newWeekStart);

    console.log("newWeekStart", newWeekStart);
    console.log("newTasks", newTasks);

    set({
      nextWeekStart: newWeekStart,
      // nextTasks: newTasks,
      slideDirection: direction === "prev" ? "right" : "left",
      isTransitioning: true,
    });

    // Complete the transition after animation
    setTimeout(() => {
      set({
        currentWeekStart: newWeekStart,
        currentTasks: newTasks,
        nextWeekStart: null,
        // nextTasks: [],
        slideDirection: null,
        isTransitioning: false,
        selectedDay: newSelectedDay, // Set the same day of week in the new week
      });
    }, 300);
  },

  /**
   * Opens the task form for editing an existing task
   * @param {number} taskId - The ID of the task to edit
   */
  openTaskFormInEditMode: (taskId) => {
    const { closeTaskMenu, taskInstances } = get();
    const taskInstance = taskInstances.find((task) => task.id === taskId);
    console.log("task being edited", taskInstance);
    console.log(
      "the formatted start time",
      dayjs(`2000-01-01 ${taskInstance.start_time}`).format("H:mm A")
    );

    if (taskInstance) {
      closeTaskMenu();

      set({
        isTaskFormOpen: true,
        isEditingTask: true,
        taskFormValues: {
          id: taskInstance.id,
          title: taskInstance.override_title ?? taskInstance.tasks.title,
          start_date: taskInstance.scheduled_date,
          start_time: dayjs(`2000-01-01 ${taskInstance.start_time}`).format(
            "h:mm A"
          ),
          duration_minutes: taskInstance.duration_minutes,
          //   ...taskInstance,
        },
      });
    } else {
      // If task not found, still open the form but with empty values
      set({
        isTaskFormOpen: true,
        isEditingTask: false,
        taskFormValues: {},
      });
    }
  },

  /**
   * Opens the task form for creating a new task
   */
  openTaskForm: () =>
    set({
      isTaskFormOpen: true,
      isEditingTask: false,
      taskFormValues: {},
    }),

  openTaskMenu: () => set({ isTaskMenuOpen: true }),

  setTaskFormValues: (taskData) => set({ taskFormValues: taskData }),

  setSelectedTask: (task) => set({ selectedTask: task }),

  setSelectedTaskId: (id) => set({ selectedTaskId: id }),

  // **********************************************************
  // HELPERS
  // **********************************************************
  closeModal: () => set({ activeModal: null }),

  handleTaskSelect: (task) => {
    const { setSelectedTask, setSelectedTaskId } = get();
    setSelectedTask(task);
    setSelectedTaskId(task.id);
    set({ isTaskMenuOpen: true });
  },

  isModalActive: (modalName) => get().activeModal === modalName,

  // Check if a task is part of a recurring series
  isPartOfSeries: (taskInstance) => {
    if (!taskInstance.tasks?.is_recurring) return false;

    const taskId = task.tasks.id;
    return (
      recurringTasksMap.has(taskId) && recurringTasksMap.get(taskId).length > 1
    );
  },

  // Call this function to hydrate and subscribe when app loads
  hydrateAndSubscribe: async () => {
    const { currentWeekStart: startDate } = get();

    // Fetch initial tasks and task instances
    await get().getTasksFromWeekWithInstances(startDate);

    // Setup realtime subscriptions and return the unsubscribe function
    const unsubscribe = await get().setupRealtimeSubscriptions();
    return unsubscribe; // This should return the unsubscribe function
  },

  getTasksFromWeekWithInstances: async (startDate) => {
    // const endDate = startDate.add(6, "days"); // Add 6 days to the start date to get the week

    const bufferStart = startDate.subtract(1, "week");
    const bufferEnd = startDate.add(2, "weeks");

    try {
      set({ isLoading: true });

      const supabase = await createSupabaseBrowserClient();

      const { data: user, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("User not authenticated");

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
        // TODO add back when we implement efficient fetching
        // .gte("scheduled_date", bufferStart.toISOString())
        // .lte("scheduled_date", bufferEnd.toISOString())
        // .eq("is_cancelled", false)
        .eq("user_id", user.user.id)
        .order("scheduled_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      set({ taskInstances: data, isLoading: false });
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
        async (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          switch (eventType) {
            case "INSERT":
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

          const { currentWeekStart: startDate } = get();
          await get().getTasksFromWeekWithInstances(startDate);
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
        async (payload) => {
          // Handle DELETE immediately
          if (payload.eventType === "DELETE") {
            get().handleInstanceChange(payload);
            return;
          }

          // For INSERT/UPDATE, fetch full data with task relationship first
          try {
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
              .eq("id", payload.new.id)
              .single();

            if (!error) {
              get().handleInstanceChange({
                ...payload,
                new: data, // Replace with enriched data
              });
            }
          } catch (error) {
            console.error("Error fetching instance details:", error);
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
  handleInstanceChange: (payload) => {
    set((state) => {
      // Get the currently selected task's ID for comparison
      const currentSelectedTaskId = state.selectedTask?.id;
      let newSelectedTask = state.selectedTask; // Start with current selected task

      switch (payload.eventType) {
        case "INSERT": {
          // Check if the instance already exists to prevent duplicates
          const exists = state.taskInstances.some(
            (instance) => instance.id === payload.new.id
          );
          if (!exists) {
            // Add the new instance
            const updatedInstances = [...state.taskInstances, payload.new];
            // Sort instances after adding (optional, but good for consistency)
            updatedInstances.sort((a, b) => {
              const dateComparison = dayjs(a.scheduled_date).diff(
                dayjs(b.scheduled_date)
              );
              if (dateComparison !== 0) return dateComparison;
              // If dates are same, sort by start_time (assuming HH:mm format)
              return a.start_time.localeCompare(b.start_time);
            });
            return { taskInstances: updatedInstances };
          }
          // If it already exists, return the current state
          return state;
        }

        case "UPDATE": {
          let instanceUpdatedIsSelected = false;
          const updatedInstances = state.taskInstances.map((instance) => {
            if (instance.id === payload.new.id) {
              // Check if this updated instance is the currently selected one
              if (instance.id === currentSelectedTaskId) {
                instanceUpdatedIsSelected = true;
              }
              // Return the new, updated instance data
              return payload.new;
            }
            return instance;
          });

          // If the instance that was updated WAS the selectedTask,
          // update the selectedTask in the root state to the new reference as well.
          if (instanceUpdatedIsSelected) {
            newSelectedTask = payload.new;
          }

          // Return the updated array and potentially the updated selectedTask
          return {
            taskInstances: updatedInstances,
            selectedTask: newSelectedTask,
          };
        }

        case "DELETE": {
          let instanceDeletedIsSelected = false;
          // Filter out the deleted instance
          const filteredInstances = state.taskInstances.filter((instance) => {
            if (instance.id === payload.old.id) {
              // Check if this deleted instance WAS the selected one
              if (instance.id === currentSelectedTaskId) {
                instanceDeletedIsSelected = true;
              }
              // Don't include this instance in the filtered array
              return false;
            }
            // Keep other instances
            return true;
          });

          // If the instance that was deleted WAS the selectedTask,
          // set selectedTask in the root state to null.
          if (instanceDeletedIsSelected) {
            newSelectedTask = null;
          }

          // Return the filtered array and potentially nullified selectedTask
          return {
            taskInstances: filteredInstances,
            selectedTask: newSelectedTask,
          };
        }

        default:
          // For any other event type, return the state unchanged
          return state;
      }
    });
  },
  // handleInstanceChange: (payload) => {
  //   set((state) => {
  //     switch (payload.eventType) {
  //       case "INSERT":
  //         // Check if the instance already exists
  //         const exists = state.taskInstances.some(
  //           (instance) => instance.id === payload.new.id
  //         );
  //         if (!exists) {
  //           return { taskInstances: [...state.taskInstances, payload.new] };
  //         }
  //         return state;

  //       case "UPDATE": {
  //         const updatedInstances = state.taskInstances.map((instance) =>
  //           instance.id === payload.new.id ? payload.new : instance
  //         );
  //         return { taskInstances: updatedInstances };
  //       }

  //       case "DELETE": {
  //         const filteredInstances = state.taskInstances.filter(
  //           (instance) => instance.id !== payload.old.id
  //         );
  //         return { taskInstances: filteredInstances };
  //       }

  //       default:
  //         return state;
  //     }
  //   });
  // },
}));
