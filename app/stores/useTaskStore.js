// src/stores/useTaskStore.jsx (or .js)

import { create } from "zustand";
import { createClient as createSupabaseBrowserClient } from "@/utils/supabase/client";
import { toast } from "react-hot-toast";

import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { RRule, rrulestr } from "rrule";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);

export const useTaskStore = create((set, get) => ({
  // **********************************************************
  // INITIAL STATE
  // **********************************************************
  /** @type {Array<object>} Holds raw task definitions from 'tasks' table */
  tasks: [],
  /** @type {Array<object>} Holds raw exception records from 'task_instance_exceptions' table */
  exceptions: [],
  /** @type {object | null} Holds the specific *calculated* instance object the user interacted with */
  selectedInstance: null,
  /** @type {boolean} Controls visibility of the Task Form sheet */
  isTaskFormOpen: false,
  /** @type {boolean} Controls visibility of the Task Action Menu sheet */
  isTaskMenuOpen: false,
  /** @type {boolean} Indicates if Task Form is editing (rule or exception TBD) */
  isEditingTask: false,
  /** @type {object} Stores initial values for the Task Form */
  taskFormValues: {},
  /** @type {string} The ISO string start date of the currently viewed week/period */
  currentViewStartDate: dayjs().startOf("week").toISOString(),
  /** @type {boolean} Indicates if data is loading */
  isLoading: false,
  /** @type {string | null} Stores last error message */
  error: null,

  // **********************************************************
  // SETTERS (Simple state updates)
  // **********************************************************
  closeTaskForm: () =>
    set({ isTaskFormOpen: false, isEditingTask: false, taskFormValues: {} }), // Reset edit state
  closeTaskMenu: () => set({ isTaskMenuOpen: false, selectedInstance: null }), // Clear selection
  setActiveModal: (modal) => set({ activeModal: modal }), // Keeping for potential modal usage
  setSelectedInstance: (instance) => set({ selectedInstance: instance }), // Usually handled by open/close menu
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error: error }),
  setTaskForm: (bool) => set({ isTaskFormOpen: bool }),
  setCurrentViewStartDate: (date) => {
    const newStartDate = dayjs(date).startOf("week").toISOString();
    console.log(`Store: Setting current view start date to: ${newStartDate}`);
    set({ currentViewStartDate: newStartDate });
  },

  // **********************************************************
  // DATA FETCHING & SUBSCRIPTIONS (Revised for new schema)
  // **********************************************************

  /**
   * Loads initial task definitions and exceptions from Supabase.
   * Should be called once when the relevant part of the app mounts.
   * @returns {Promise<Function>} A function to unsubscribe from realtime listeners.
   */
  loadInitialData: async () => {
    console.log("Store: Loading initial data...");
    set({ isLoading: true, error: null });
    const supabase = createSupabaseBrowserClient(); // Use component client
    let unsubscribe = () => console.log("Store: No-op unsubscribe."); // Default unsubscribe

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user)
        throw new Error("User not authenticated for initial load");

      const [tasksResult, exceptionsResult] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("task_instance_exceptions")
          .select("*")
          .eq("user_id", user.id),
      ]);

      if (tasksResult.error) throw tasksResult.error;
      if (exceptionsResult.error) throw exceptionsResult.error;

      console.log(
        `Store: Loaded ${tasksResult.data?.length ?? 0} tasks and ${exceptionsResult.data?.length ?? 0} exceptions.`
      );
      set({
        tasks: tasksResult.data || [],
        exceptions: exceptionsResult.data || [],
        isLoading: false,
      });

      // Setup subscriptions *after* initial load succeeds
      unsubscribe = await get().setupRealtimeSubscriptions();
    } catch (error) {
      console.error("Store Error: Failed to load initial data:", error);
      const errorMsg =
        error instanceof Error ? error.message : "Failed to load data";
      set({ error: errorMsg, isLoading: false });
      toast.error("Failed to load initial task data.");
    }
    return unsubscribe; // Return the actual or no-op unsubscribe function
  },

  /**
   * Sets up Supabase realtime subscriptions for tasks and exceptions.
   * @returns {Promise<Function>} A function to unsubscribe from the channels.
   */
  setupRealtimeSubscriptions: async () => {
    // Use the client creation function you defined
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log(
        "Store: No authenticated user found, skipping realtime subscriptions."
      );
      return () => {
        console.log("Store: No-op unsubscribe (no user).");
      }; // Return no-op unsubscribe
    }

    console.log(`Store: Subscribing for user ${user.id}`);

    // Get references to the handler functions FROM THE CURRENT STORE INSTANCE
    // Using get() inside ensures we always use the latest version of these handlers
    // if the store definition were ever hot-reloaded (less common for stores).
    const handleTaskChange = (payload) => get()._handleTaskChange(payload);
    const handleExceptionChange = (payload) =>
      get()._handleExceptionChange(payload);

    // IMPORTANT: Clean up any *previous* channels for this specific client instance
    // This prevents duplicate subscriptions if setupRealtimeSubscriptions is called again somehow
    // without the page refreshing (e.g., during development HMR).
    // Note: Channels are specific to the client instance.
    const existingChannels = supabase.getChannels();
    console.log(
      `Store: Found ${existingChannels.length} existing channels. Removing...`
    );
    existingChannels.forEach((channel) => {
      if (
        channel.channelName.startsWith("public:tasks") ||
        channel.channelName.startsWith("public:task_instance_exceptions")
      ) {
        console.log(`Store: Removing existing channel: ${channel.channelName}`);
        supabase.removeChannel(channel);
      }
    });

    // Define channel names uniquely (e.g., include user ID if needed, but filter usually handles this)
    const taskChannelName = `public:tasks:${user.id}`; // Example unique name per user
    const exceptionChannelName = `public:task_instance_exceptions:${user.id}`; // Example unique name

    // --- Subscribe to TASKS table ---
    const tasksChannel = supabase
      .channel(taskChannelName) // Use potentially unique channel name
      .on(
        "postgres_changes",
        {
          event: "*", // Listen for INSERT, UPDATE, DELETE
          schema: "public",
          table: "tasks",
        },
        handleTaskChange // Call the handler function
      )
      .subscribe((status, err) => {
        // Add detailed status/error logging
        console.log(
          `Store: Tasks Channel (${taskChannelName}) status: ${status}`
        );
        if (err) {
          console.error(
            `Store: Tasks Channel (${taskChannelName}) subscription error:`,
            err
          );
          toast.error("Realtime connection error (Tasks). Check console.");
          // Consider retry logic here if needed
        }
      });

    // --- Subscribe to TASK INSTANCE EXCEPTIONS table ---
    const exceptionsChannel = supabase
      .channel(exceptionChannelName) // Use potentially unique channel name
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_instance_exceptions",
        },
        handleExceptionChange // Call the handler function
      )
      .subscribe((status, err) => {
        // Add detailed status/error logging
        console.log(
          `Store: Exceptions Channel (${exceptionChannelName}) status: ${status}`
        );
        if (err) {
          console.error(
            `Store: Exceptions Channel (${exceptionChannelName}) subscription error:`,
            err
          );
          toast.error("Realtime connection error (Exceptions). Check console.");
          // Consider retry logic here if needed
        }
      });

    // Return a cleanup function that removes THESE specific channels
    return () => {
      console.log("Store: Unsubscribing from realtime channels...");
      // Use supabase.removeChannel for specific channels
      supabase
        .removeChannel(tasksChannel)
        .then((status) =>
          console.log(`Store: Removed tasks channel, status: ${status}`)
        )
        .catch((err) => console.error("Error removing tasks channel:", err));
      supabase
        .removeChannel(exceptionsChannel)
        .then((status) =>
          console.log(`Store: Removed exceptions channel, status: ${status}`)
        )
        .catch((err) =>
          console.error("Error removing exceptions channel:", err)
        );
    };
  },

  /**
   * Internal handler for realtime changes on the 'tasks' table.
   * @param {object} payload - The realtime payload from Supabase.
   */
  _handleTaskChange: (payload) => {
    console.log("Store: Realtime Task Change Received:", payload);
    console.log("Store: Realtime Task Change PLEASE");
    set((state) => {
      let updatedTasks = [...state.tasks];
      switch (payload.eventType) {
        case "INSERT":
          // Avoid adding duplicates if optimistic update already happened
          if (!updatedTasks.some((t) => t.id === payload.new?.id)) {
            updatedTasks.push(payload.new);
          }
          break;
        case "UPDATE":
          updatedTasks = updatedTasks.map((t) =>
            t.id === payload.new?.id ? payload.new : t
          );
          break;
        case "DELETE":
          updatedTasks = updatedTasks.filter((t) => t.id !== payload.old?.id);
          // If the deleted task definition matches the selected instance's parent, clear selection
          if (state.selectedInstance?.task_id === payload.old?.id) {
            console.log(
              "Parent task of selected instance deleted, clearing selection."
            );
            return { tasks: updatedTasks, selectedInstance: null };
          }
          break;
        default:
          return state;
      }
      return { tasks: updatedTasks };
    });
  },

  /**
   * Internal handler for realtime changes on the 'task_instance_exceptions' table.
   * @param {object} payload - The realtime payload from Supabase.
   */
  _handleExceptionChange: (payload) => {
    console.log("Store: Realtime Exception Change Received:", payload);
    set((state) => {
      let updatedExceptions = [...state.exceptions];
      let newSelectedInstance = state.selectedInstance;

      // Use consistent ISO strings for comparison
      const getISO = (time) => (time ? dayjs.utc(time).toISOString() : null);
      const newExceptionOriginalTimeISO = getISO(
        payload.new?.original_occurrence_time
      );
      const oldExceptionOriginalTimeISO = getISO(
        payload.old?.original_occurrence_time
      );
      const selectedInstanceOriginalTimeISO = getISO(
        state.selectedInstance?.original_occurrence_time_utc
      );

      switch (payload.eventType) {
        case "INSERT":
          if (!updatedExceptions.some((e) => e.id === payload.new?.id)) {
            updatedExceptions.push(payload.new);
          }
          if (
            state.selectedInstance?.task_id === payload.new?.task_id &&
            selectedInstanceOriginalTimeISO === newExceptionOriginalTimeISO
          ) {
            console.log(
              "Selected instance affected by INSERTED exception",
              payload.new
            );
            newSelectedInstance = null; // Force UI recalculation/refresh
          }
          break;
        case "UPDATE":
          updatedExceptions = updatedExceptions.map((e) =>
            e.id === payload.new?.id ? payload.new : e
          );
          if (
            state.selectedInstance?.task_id === payload.new?.task_id &&
            selectedInstanceOriginalTimeISO === newExceptionOriginalTimeISO
          ) {
            console.log(
              "Selected instance affected by UPDATED exception",
              payload.new
            );
            newSelectedInstance = null; // Force UI recalculation/refresh
          }
          break;
        case "DELETE":
          console.log(" IN DELETE Instance");
          updatedExceptions = updatedExceptions.filter(
            (e) => e.id !== payload.old?.id
          );
          if (
            state.selectedInstance?.task_id === payload.old?.task_id &&
            selectedInstanceOriginalTimeISO === oldExceptionOriginalTimeISO
          ) {
            console.log(
              "Selected instance affected by DELETED exception",
              payload.old
            );
            newSelectedInstance = null; // Force UI recalculation/refresh
          }
          break;
        default:
          return state;
      }
      // updatedExceptions.sort((a, b) => dayjs(a.original_occurrence_time).diff(dayjs(b.original_occurrence_time)));
      return {
        exceptions: updatedExceptions,
        selectedInstance: newSelectedInstance,
      };
    });
  },

  // **********************************************************
  // UI CONTROL ACTIONS
  // **********************************************************

  /**
   * Opens the Task Form to create a new task definition.
   * @param {Date | string} [initialDate] - Optional date to pre-fill.
   */
  openTaskForm: (initialDate) => {
    console.log("Store: Opening Task Form for New Task");
    console.log("Store: task form initial date", initialDate);
    const defaultStartDate = initialDate
      ? dayjs(initialDate).toDate()
      : new Date();

    set({
      isTaskFormOpen: true,
      isEditingTask: false, // Creating a new task definition
      taskFormValues: {
        // Set defaults for a *new* task
        title: "",
        start_date: defaultStartDate,
        start_time: "09:00", // Use HH:mm
        duration_minutes: 30,
        frequency: "once",
        interval: 1,
        end_type: "never",
        occurrences: 10,
        end_date: dayjs().add(1, "month").toDate(),
      },
      selectedInstance: null, // Not editing a specific instance
    });
  },

  /**
   * Opens the Task Form pre-filled for editing, for editing rule or definition, using an instance for context.
   * The user will choose the edit scope (single/future/all) AFTER submitting changes.
   * Requires RRULE parsing to populate recurrence fields from the parent task.
   * @param {object} instanceContext - The calculated instance object that was interacted with.
   */
  openTaskFormForEdit: (instanceContext) => {
    if (
      !instanceContext ||
      !instanceContext.task_id ||
      !instanceContext.original_occurrence_time_utc
    ) {
      toast.error("Cannot edit task: Essential instance details missing.");
      return;
    }
    const taskId = instanceContext.task_id;
    console.log(
      `Store: Opening Task Form in Edit Mode for Task ID: ${taskId}, using instance at ${instanceContext.original_occurrence_time_utc} for context.`
    );

    // Find the parent task definition
    const taskDefinition = get().tasks.find((t) => t.id === taskId);
    if (!taskDefinition) {
      toast.error("Cannot find original task definition to edit.");
      return;
    }

    // --- Default & RRULE Parsing Logic ---
    let frequency = "once",
      interval = 1,
      end_type = "never",
      occurrences,
      end_date;
    // Parse parent's RRULE if it exists
    if (taskDefinition.rrule) {
      try {
        const rule = rrulestr(taskDefinition.rrule, {
          dtstart: dayjs.utc(taskDefinition.dtstart).toDate(),
        });
        const options = rule.options;
        const freqMapReverse = {
          [RRule.DAILY]: "daily",
          [RRule.WEEKLY]: "weekly",
          [RRule.MONTHLY]: "monthly",
        };
        frequency = freqMapReverse[options.freq] || "once";
        interval = options.interval || 1;
        if (options.count) {
          end_type = "after";
          occurrences = options.count;
        } else if (options.until) {
          end_type = "on";
          end_date = dayjs
            .utc(options.until)
            .tz(taskDefinition.timezone)
            .toDate();
        } else {
          end_type = "never";
        }
      } catch (e) {
        console.error("RRULE Parse Error:", e);
        toast.error("Could not parse recurrence rule.");
      }
    }

    // --- Prepare Form Values ---
    // Populate with CURRENT values of the selected INSTANCE for core fields,
    // but use parsed/default recurrence values from the PARENT RULE.
    const formValues = {
      title: instanceContext.title, // Instance title
      start_date: dayjs
        .utc(instanceContext.scheduled_time_utc)
        .tz(instanceContext.timezone)
        .toDate(), // Instance date
      start_time: dayjs
        .utc(instanceContext.scheduled_time_utc)
        .tz(instanceContext.timezone)
        .format("HH:mm"), // Instance time
      duration_minutes: instanceContext.duration_minutes, // Instance duration
      // --- Recurrence from parsed parent rule ---
      frequency: frequency,
      interval: interval,
      end_type: end_type,
      occurrences: occurrences,
      end_date: end_date,
      // --- Hidden fields for context ---
      _isExceptionEdit: false, // Initially assume we MIGHT edit the rule
      _taskId: taskDefinition.id,
      _originalOccurrenceTimeUTC: instanceContext.original_occurrence_time_utc, // Time of the instance clicked
      _exceptionId: instanceContext.id.startsWith(taskId + "-")
        ? undefined
        : instanceContext.id, // Existing exception ID if applicable
    };

    set({
      isTaskFormOpen: true,
      isEditingTask: true, // Set the general editing flag
      taskFormValues: formValues,
      selectedInstance: null, // Clear instance selection from menu context
    });
  },

  /**
   * Opens the Task Action Menu for a specific calculated instance.
   * Stores the selected calculated instance context.
   * @param {object} instance - The calculated instance object (should conform to CalculatedInstance structure).
   */
  openTaskMenu: (instance) => {
    // Check if 'instance' is a valid object and has the essential 'task_id' property.
    // The 'id' of a calculated instance might be the exception ID or a generated one (task_id + time),
    // but 'task_id' links it back to the definition.
    if (!instance || typeof instance !== "object" || !instance.task_id) {
      console.error(
        "Store Error: Invalid instance passed to openTaskMenu (missing task_id):",
        instance
      );
      // toast.error("Cannot open menu for this task.");
      set({ selectedInstance: null, isTaskMenuOpen: false });
      return;
    }

    set({
      selectedInstance: instance,
      isTaskMenuOpen: true,
    });
  },

  // **********************************************************
  // HELPERS
  // **********************************************************
  /**
   * Returns time slot of task in format 9:00 AM – 9:30 AM for example
   * @param {*} inst
   * @returns
   */
  formatTimeRange: (inst) => {
    if (
      !inst?.scheduled_time_utc ||
      !inst?.duration_minutes ||
      !inst?.timezone
    ) {
      return "Time N/A"; // Handle missing data
    }
    // Convert UTC scheduled time to the task's original timezone for display
    const startTimeLocal = dayjs.utc(inst.scheduled_time_utc).tz(inst.timezone);
    const endTimeLocal = startTimeLocal.add(inst.duration_minutes, "minute");

    // Check if conversion was successful
    if (!startTimeLocal.isValid() || !endTimeLocal.isValid()) {
      return "Invalid Time";
    }

    return `${startTimeLocal.format("h:mm A")} – ${endTimeLocal.format("h:mm A")}`;
  },
}));
