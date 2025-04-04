// src/stores/useTaskStore.jsx (or .js)

import { create } from "zustand";
import { toast } from "react-hot-toast";
// ****** CHANGE: Use component client for browser interactions ******
import { createClient as createSupabaseBrowserClient } from "@/utils/supabase/client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
// ****** CHANGE: Import RRule (make sure it's installed: npm install rrule) ******
import { RRule, RRuleSet, rrulestr } from "rrule";
// ****** CHANGE: Import the calculation utility (create this file) ******
import { calculateInstancesForRange } from "@/lib/taskCalculator"; // Example path

// Extend Dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);

// Create the Zustand store
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

  // ****** REPLACED/REMOVED ******
  // - taskInstances state
  // - selectedTask (renamed to selectedInstance)
  // - pendingUpdates, updateScope (revisit for UPDATE logic)

  // **********************************************************
  // GETTERS (Conceptual - Calculation happens outside store)
  // **********************************************************

  // *** Not used anywhere??
  /**
   * Retrieves calculated task instances for a specific day.
   * NOTE: This calls the external calculator function.
   * @param {Date | string} date - The target date.
   * @returns {Array<object>} Array of calculated instance objects for the day.
   */
  getInstancesForDay: (date) => {
    const { tasks, exceptions } = get();
    if (!date) return [];
    const dayStart = dayjs(date).startOf("day").toISOString();
    const dayEnd = dayjs(date).endOf("day").toISOString();
    // Call the external calculation function
    try {
      return calculateInstancesForRange(tasks, exceptions, dayStart, dayEnd);
    } catch (error) {
      console.error("Error calculating instances for day:", error);
      // Optionally set an error state in the store here
      // get().setError("Failed to calculate tasks for the day.");
      return [];
    }
  },

  // *** Not used anywhere??
  /**
   * Retrieves calculated task instances for the currently viewed week.
   * NOTE: This calls the external calculator function.
   * @returns {Array<object>} Array of calculated instance objects for the week.
   */
  getInstancesForCurrentWeek: () => {
    const { tasks, exceptions, currentViewStartDate } = get();
    if (!currentViewStartDate) return [];
    const weekStart = dayjs(currentViewStartDate).startOf("day").toISOString();
    const weekEnd = dayjs(currentViewStartDate)
      .add(7, "days")
      .startOf("day")
      .toISOString(); // Get start of next week for exclusive end
    // Call the external calculation function
    try {
      return calculateInstancesForRange(tasks, exceptions, weekStart, weekEnd);
    } catch (error) {
      console.error("Error calculating instances for week:", error);
      // get().setError("Failed to calculate tasks for the week.");
      return [];
    }
  },

  // ****** REPLACED/REMOVED ******
  // - getTasksForFormattedDay

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

  // ****** REPLACED/REMOVED ******
  // - clearPendingUpdates, setPendingUpdates, setUpdateScope (related to old update logic)
  // - setTaskForm (replaced by open/close)
  // - setSelectedTask, setSelectedTaskId (replaced by selectedInstance logic)

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
    console.log("Store: Setting up Realtime subscriptions...");
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
    // Alternative: supabase.removeAllChannels(); // Use if appropriate for your app structure

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
          console.log("Fllooop");
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
          console.log(" IN DELETE");
          console.log({ updatedTasks, payload });
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
      // updatedTasks.sort((a, b) => dayjs(b.created_at).diff(dayjs(a.created_at)));
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
  // openTaskForm: (initialDate) => {
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
   * Opens the Task Form to edit an existing task definition (the rule).
   * NOTE: Requires parsing RRULE back into form fields (complex).
   * @param {string} taskId - The ID of the task definition to edit.
   */
  /**
   * Opens the Task Form to edit an existing task definition (the rule),
   * using a specific instance for context (especially its original time).
   * Parses the existing RRULE to pre-fill recurrence fields.
   * @param {object} instanceContext - The calculated instance object that triggered the edit rule action.
   */
  // openTaskFormForEditRule: (taskId) => {
  openTaskFormForEditRule: (instanceContext) => {
    console.warn(
      `Store: Opening Task Form to Edit Rule for instanceContext: ${instanceContext} (RRULE parsing not implemented)`
    );

    if (
      !instanceContext ||
      !instanceContext.task_id ||
      !instanceContext.original_occurrence_time_utc
    ) {
      console.log("Cannot edit rule: Context instance details missing.");
      // toast.error("Cannot edit rule: Context instance details missing.");
      return;
    }

    const taskId = instanceContext.task_id;
    console.log(
      `Store: Opening Task Form to Edit Rule for Task ID: ${taskId}, using instance at ${instanceContext.original_occurrence_time_utc} for context.`
    );

    const taskDefinition = get().tasks.find((t) => t.id === taskId);
    if (!taskDefinition) {
      toast.error("Cannot find task definition to edit.");
      return;
    }

    // *****************************
    // const taskDefinition = get().tasks.find((t) => t.id === taskId);
    // if (!taskDefinition) {
    //   toast.error("Cannot find task definition to edit.");
    //   return;
    // }

    // --- Default recurrence values ---
    let frequency = "once";
    let interval = 1;
    let end_type = "never";
    let occurrences = undefined; // Use undefined for optional number fields
    let end_date = undefined; // Use undefined for optional date fields

    if (taskDefinition.rrule) {
      try {
        // Use rrulestr to parse the rule string.
        // Pass dtstart for context if the RRULE string itself doesn't contain it
        // (though rrule.js often handles DTSTART within the string correctly).
        const rule = rrulestr(taskDefinition.rrule, {
          dtstart: dayjs.utc(taskDefinition.dtstart).toDate(),
        });
        const options = rule.options; // Get the parsed options

        console.log("Parsed RRULE options:", options);

        // Map RRule frequency back to form value
        const freqMapReverse = {
          [RRule.DAILY]: "daily",
          [RRule.WEEKLY]: "weekly",
          [RRule.MONTHLY]: "monthly",
          [RRule.YEARLY]: "yearly", // Add if you support yearly
        };
        frequency = freqMapReverse[options.freq] || "once"; // Default to 'once' if unknown

        interval = options.interval || 1;

        // Determine end_type based on parsed options
        if (options.count) {
          end_type = "after";
          occurrences = options.count;
        } else if (options.until) {
          end_type = "on";
          // Convert UTC 'until' date back to the task's original timezone for the date picker
          end_date = dayjs
            .utc(options.until)
            .tz(taskDefinition.timezone)
            .toDate();
        } else {
          end_type = "never";
        }
      } catch (e) {
        console.error(
          "Store Error: Failed to parse existing RRULE string:",
          taskDefinition.rrule,
          e
        );
        toast.error(
          "Could not parse existing recurrence rule. Please set again."
        );
        // Keep defaults if parsing fails
        frequency = "once";
        interval = 1;
        end_type = "never";
        occurrences = undefined;
        end_date = undefined;
      }
    } else {
      // If no rrule exists, it's a 'once' task
      frequency = "once";
    }

    // --- Prepare Form Values ---
    const formValues = {
      // id is not a form field, but useful context maybe
      // id: taskDefinition.id,
      title: taskDefinition.title,
      // Convert dtstart (TIMESTAMPTZ) back to local date and HH:mm time for form
      start_date: dayjs
        .utc(taskDefinition.dtstart)
        .tz(taskDefinition.timezone)
        .toDate(),
      start_time: dayjs
        .utc(taskDefinition.dtstart)
        .tz(taskDefinition.timezone)
        .format("HH:mm"),
      duration_minutes: taskDefinition.duration_minutes,
      // --- Parsed recurrence values ---
      frequency: frequency,
      interval: interval,
      end_type: end_type,
      occurrences: occurrences,
      end_date: end_date,
      // --- Hidden fields ---
      _isExceptionEdit: false, // Explicitly false when editing the rule
      _taskId: taskDefinition.id, // The ID of the task being edited
      // ****** CHANGE: Store the ORIGINAL time of the instance used for context ******
      _originalOccurrenceTimeUTC: instanceContext.original_occurrence_time_utc,
      _exceptionId: undefined, // Not editing an exception directly
      // _originalOccurrenceTimeUTC: taskDefinition.dtstart, // Use original dtstart as context maybe? Or null? Depends on update logic. Let's omit for rule edit.
      // _exceptionId: undefined, // Not editing an exception
      // Store original data for potential comparison or complex update logic if needed
      // _originalRrule: taskDefinition.rrule,
      // _originalTimezone: taskDefinition.timezone,
      // _originalDtstart: taskDefinition.dtstart,
    };

    if (frequency === "once") {
      console.log("Editing a non-recurring task.");
      // toast.info("Editing a non-recurring task.");
    } else if (taskDefinition.rrule && frequency === "once") {
      // This case happens if RRULE parsing failed
      toast.warn("Failed to read recurrence rule. Please reset if needed.");
    }

    // Set the store state
    set({
      isTaskFormOpen: true,
      isEditingTask: true, // General editing flag
      taskFormValues: formValues, // Set the calculated initial values
      selectedInstance: null, // Not selecting a specific instance
    });
  },

  /**
   * Opens the Task Form to modify a *single occurrence* (creates/updates an exception).
   * @param {object} instance - The calculated instance object that was interacted with.
   */
  openTaskFormForException: (instance) => {
    console.log(
      "Store: Opening Task Form to Create/Edit Exception for:",
      instance
    );
    if (
      !instance ||
      !instance.task_id ||
      !instance.original_occurrence_time_utc
    ) {
      toast.error("Invalid instance data provided for editing.");
      return;
    }

    const formValues = {
      // We don't need the parent task ID *in the form data itself* typically,
      // but we store it below (_taskId) to know which exception to create/update.
      title: instance.title, // Use current title (might be overridden)
      start_date: dayjs
        .utc(instance.scheduled_time_utc)
        .tz(instance.timezone)
        .toDate(),
      start_time: dayjs
        .utc(instance.scheduled_time_utc)
        .tz(instance.timezone)
        .format("HH:mm"), // Use actual scheduled time
      duration_minutes: instance.duration_minutes, // Use current duration
      // Recurrence fields are locked to 'once' when editing an instance
      frequency: "once",
      interval: 1,
      end_type: "never",
      // Hidden fields to track the context for the submit handler
      _isExceptionEdit: true, // Flag to tell onSubmit it's modifying an occurrence
      _taskId: instance.task_id,
      _originalOccurrenceTimeUTC: instance.original_occurrence_time_utc,
      // Include existing exception ID if we are editing one that already exists
      _exceptionId: instance.id.startsWith(instance.task_id + "-")
        ? null
        : instance.id,
    };
    set({
      isTaskFormOpen: true,
      isEditingTask: true,
      taskFormValues: formValues,
      selectedInstance: instance,
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

  // ****** NEEDS IMPLEMENTATION ******
  // - Actions to create/update exceptions
  // - Action to update task definitions (rules)
  // - Actions to delete tasks/exceptions based on new structure
}));
