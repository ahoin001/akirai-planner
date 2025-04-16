/**
 * Represents a single, calculated task occurrence ready for display in the UI.
 * This object is generated dynamically by `calculateInstancesForRange` and combines
 * data from the TaskDefinition and any applicable TaskException.
 */
export interface CalculatedInstance {
  // Unique identifier for this specific rendered instance.
  // Can be the exception ID if one exists, or a generated ID (e.g., "taskId-ISOString").
  id: string;
  task_id: string; // ID of the parent TaskDefinition
  original_occurrence_time_utc: string; // ISO string (UTC) - The original calculated time
  scheduled_time_utc: string; // ISO string (UTC) - The actual scheduled time (potentially overridden)
  duration_minutes: number; // Actual duration (potentially overridden)
  title: string; // Actual title (potentially overridden)
  is_complete: boolean; // Completion status from exception or false
  completion_time?: string | null; // Completion time from exception or null
  is_cancelled: boolean; // ONLY true if an exception exists and has is_cancelled = true
  icon_name: string; // Icon name for the task (e.g., "Activity")
  timezone: string; // Parent task's original timezone for context
  // Include other relevant data needed for display, potentially merged from parent/exception
  // color?: string;
  // type?: string;
  // Add a reference to the parent task if needed frequently? (Could increase object size)
  // parentTask?: TaskDefinition;
  // Add a reference to the exception if one exists?
  // exception?: TaskException | null;
}

/**
 * Represents task payload for creating a task definition with createtaskaction
 */
export type TaskData = {
  title: string;
  start_date: string; // formatted as YYYY-MM-DD
  start_time: string; // formatted as HH:mm
  duration_minutes: number;
  timezone: string;
  recurrence: {
    frequency: "once" | "daily" | "weekly" | "monthly" | string;
    interval?: number;
    end_type?: "never" | "after" | "on" | string;
    occurrences?: number;
    end_date?: string;
  };
};

/**
 * Represents the structure of a task definition record
 * stored in the 'tasks' database table.
 */
export interface TaskDefinition {
  id: string; // UUID
  user_id: string; // UUID of the owner
  title: string;
  dtstart: string; // ISO 8601 string (TIMESTAMPTZ from DB)
  duration_minutes: number;
  rrule?: string | null; // RRULE string or null/undefined
  icon_name: string; // Icon name for the task (e.g., "Activity")
  timezone: string; // IANA timezone name (e.g., 'America/New_York')
  status: "active" | "paused" | "completed" | "archived"; // Task series status
  created_at: string; // ISO 8601 string
  updated_at: string; // ISO 8601 string
  // Add other optional fields from your tasks table if needed
  // color?: string;
  // type?: string;
}

/**
 * Represents the structure of a task exception record
 * stored in the 'task_instance_exceptions' database table.
 */
export interface TaskException {
  id: string; // UUID (primary key of the exception itself)
  task_id: string; // UUID of the parent task definition
  user_id: string; // UUID of the owner
  original_occurrence_time: string; // ISO 8601 string (TIMESTAMPTZ) - The key identifier
  new_start_time?: string | null; // ISO 8601 string (TIMESTAMPTZ) - Overridden start time
  new_duration_minutes?: number | null;
  override_title?: string | null;
  icon_name?: string; // Icon name for the task (e.g., "Activity")
  is_cancelled: boolean;
  is_complete: boolean;
  completion_time?: string | null; // ISO 8601 string (TIMESTAMPTZ)
  created_at: string; // ISO 8601 string
  updated_at: string; // ISO 8601 string
  // Add other optional override fields if needed
  // override_color?: string;
  // notes?: string;
}
