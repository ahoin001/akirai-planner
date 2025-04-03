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
  // INITIAL STATE (Revised for new schema)
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
  // setSelectedInstance: (instance) => set({ selectedInstance: instance }), // Usually handled by open/close menu
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error: error }),
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
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log("Store: No user, skipping realtime subscriptions.");
      return () => {}; // Return no-op unsubscribe
    }

    // Clean up previous channels associated with this client instance first
    supabase.removeAllChannels();

    const handleTaskChange = get()._handleTaskChange;
    const handleExceptionChange = get()._handleExceptionChange;

    // Subscribe to TASKS table
    const tasksChannel = supabase
      .channel("public:tasks") // Use documented format
      .on(
        // REMOVED <TaskDefinition> generic
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${user.id}`,
        },
        handleTaskChange
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED")
          console.log("Store: Subscribed to tasks channel");
        else if (err) {
          console.error("Store: Tasks subscription error:", err);
          toast.error("Realtime connection issue (Tasks).");
          // Potentially try to resubscribe after a delay?
        }
      });

    // Subscribe to TASK INSTANCE EXCEPTIONS table
    const exceptionsChannel = supabase
      .channel("public:task_instance_exceptions") // Use documented format
      .on(
        // REMOVED <TaskException> generic
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_instance_exceptions",
          filter: `user_id=eq.${user.id}`,
        },
        handleExceptionChange
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED")
          console.log("Store: Subscribed to exceptions channel");
        else if (err) {
          console.error("Store: Exceptions subscription error:", err);
          toast.error("Realtime connection issue (Exceptions).");
        }
      });

    // Return unsubscribe function
    return () => {
      console.log("Store: Unsubscribing from realtime channels");
      // Use removeChannel safely
      if (tasksChannel)
        supabase
          .removeChannel(tasksChannel)
          .catch((err) => console.error("Error removing tasks channel", err));
      if (exceptionsChannel)
        supabase
          .removeChannel(exceptionsChannel)
          .catch((err) =>
            console.error("Error removing exceptions channel", err)
          );
    };
  },

  /**
   * Internal handler for realtime changes on the 'tasks' table.
   * @param {object} payload - The realtime payload from Supabase.
   */
  _handleTaskChange: (payload) => {
    console.log("Store: Realtime Task Change Received:", payload);
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
  // UI CONTROL ACTIONS (Revised)
  // **********************************************************

  /**
   * Opens the Task Form to create a new task definition.
   * @param {Date | string} [initialDate] - Optional date to pre-fill.
   */
  openTaskForm: (initialDate) => {
    console.log("Store: Opening Task Form for New Task");
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
  openTaskFormForEditRule: (taskId) => {
    console.warn(
      `Store: Opening Task Form to Edit Rule for Task ID: ${taskId} (RRULE parsing not implemented)`
    );
    const taskDefinition = get().tasks.find((t) => t.id === taskId);
    if (!taskDefinition) {
      toast.error("Cannot find task definition to edit.");
      return;
    }
    // !!! Placeholder - Requires RRULE parsing logic !!!
    const formValues = {
      id: taskDefinition.id, // Pass ID for update action
      title: taskDefinition.title,
      start_date: dayjs(taskDefinition.dtstart)
        .tz(taskDefinition.timezone)
        .toDate(),
      start_time: dayjs(taskDefinition.dtstart)
        .tz(taskDefinition.timezone)
        .format("HH:mm"),
      duration_minutes: taskDefinition.duration_minutes,
      // --- Add RRULE parsing logic here to set these ---
      frequency: "once", // Requires parsing taskDefinition.rrule
      interval: 1, // Requires parsing taskDefinition.rrule
      end_type: "never", // Requires parsing taskDefinition.rrule
      occurrences: undefined, // Requires parsing taskDefinition.rrule
      end_date: undefined, // Requires parsing taskDefinition.rrule
      // Store original data if needed for update logic
      _originalRrule: taskDefinition.rrule,
      _originalTimezone: taskDefinition.timezone,
      _originalDtstart: taskDefinition.dtstart,
    };
    toast.info(
      "Editing recurrence rules is complex and may require manual adjustment."
    ); // User warning

    set({
      isTaskFormOpen: true,
      isEditingTask: true, // Indicates editing the definition
      taskFormValues: formValues,
      selectedInstance: null, // Not tied to a specific instance when editing the rule
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
    // Pre-fill form based on the *calculated* instance data
    const formValues = {
      // We don't need the parent task ID *in the form data itself* typically,
      // but we store it below (_taskId) to know which exception to create/update.
      title: instance.title, // Use current title (might be overridden)
      start_date: dayjs
        .utc(instance.scheduled_time_utc)
        .tz(instance.timezone)
        .toDate(), // Use actual scheduled date
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
      isEditingTask: true, // Form is technically "editing" this occurrence
      taskFormValues: formValues, // Pre-fill with instance data
      selectedInstance: instance, // Keep context of which instance is being edited
    });
  },

  // Inside the create() call for useTaskStore

  /**
   * Opens the Task Action Menu for a specific calculated instance.
   * Stores the selected instance context.
   * @param {object} instance - The calculated instance object (should conform to CalculatedInstance structure).
   */
  openTaskMenu: (instance) => {
    console.log("Store: Opening Task Menu for instance:", instance);

    // ****** CORRECTED VALIDATION ******
    // Check if 'instance' is a valid object and has the essential 'task_id' property.
    // The 'id' of a calculated instance might be the exception ID or a generated one (task_id + time),
    // but 'task_id' links it back to the definition.
    if (!instance || typeof instance !== "object" || !instance.task_id) {
      console.error(
        "Store Error: Invalid instance passed to openTaskMenu (missing task_id):",
        instance
      );
      toast.error("Cannot open menu for this task."); // User feedback
      set({ selectedInstance: null, isTaskMenuOpen: false }); // Clear selection, close menu
      return;
    }

    // Set the selected instance and open the menu state
    set({
      selectedInstance: instance, // Store the *entire calculated instance* object
      isTaskMenuOpen: true, // Set flag to open the menu UI
    });
  },

  // *** May delete
  /**
   * Opens the Task Action Menu for a specific calculated instance.
   * @param {object} instance - The calculated instance object.
   */
  // openTaskMenu: (instance) => {
  //   console.log("Store: Opening Task Menu for instance:", instance);
  //   if (!instance || !instance.task_id) {
  //     console.error("Store: Invalid instance passed to openTaskMenu");
  //     return;
  //   }
  //   set({ selectedInstance: instance, isTaskMenuOpen: true });
  // },

  // ****** REPLACED/REMOVED ******
  // - changeWeek (Needs rework based on how view range is managed and data recalculated)
  // - openTaskFormInEditMode (Replaced by more specific edit actions)
  // - setTaskFormValues (Typically handled by form library)

  // ****** NEEDS IMPLEMENTATION ******
  // - Actions to create/update exceptions
  // - Action to update task definitions (rules)
  // - Actions to delete tasks/exceptions based on new structure
}));
