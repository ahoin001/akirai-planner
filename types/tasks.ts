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
