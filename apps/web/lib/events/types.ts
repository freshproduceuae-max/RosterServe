export const EVENT_TYPES = ["regular", "ad_hoc", "special_day"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_STATUSES = ["draft", "published", "completed"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export type Event = {
  id: string;
  title: string;
  event_type: EventType;
  event_date: string;
  status: EventStatus;
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
