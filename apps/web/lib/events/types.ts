export const EVENT_TYPES = ["regular", "ad_hoc", "special_day"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_STATUSES = ["draft", "published", "completed"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const RECURRENCE_RULES = [
  "weekly",
  "fortnightly",
  "monthly_first_sunday",
  "annual",
] as const;
export type RecurrenceRule = (typeof RECURRENCE_RULES)[number];

export const RECURRENCE_RULE_LABELS: Record<RecurrenceRule, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly_first_sunday: "Monthly (1st Sunday)",
  annual: "Annual",
};

export type Event = {
  id: string;
  title: string;
  event_type: EventType;
  event_date: string;
  status: EventStatus;
  is_recurring: boolean;
  recurrence_rule: RecurrenceRule | null;
  parent_event_id: string | null;
  is_stub: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  regular: "Regular",
  ad_hoc: "Ad-hoc",
  special_day: "Special Day",
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Draft",
  published: "Published",
  completed: "Completed",
};

export const VALID_STATUS_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  draft: ["published", "completed"],
  published: ["completed"],
  completed: [],
};
