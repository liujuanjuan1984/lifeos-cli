import { describe, expect, it } from "vitest";

import type { PlannedEvent } from "@/services/api/plannedEvents";
import {
  buildPlannedEventFormData,
  buildPlannedEventUpdatePayload,
} from "@/components/plannedEventModalUtils";

const baseEvent: PlannedEvent = {
  id: "event-1",
  title: "Recurring Review",
  start_time: "2025-08-11T08:00:00Z",
  end_time: "2025-08-11T08:30:00Z",
  priority: 0,
  dimension_id: "dim-1",
  task_id: "task-1",
  is_all_day: false,
  is_recurring: true,
  recurrence_pattern: null,
  rrule_string: "FREQ=DAILY",
  status: "planned",
  tags: ["focus"],
  extra_data: { source: "calendar" },
  created_at: "2025-08-10T00:00:00Z",
  updated_at: "2025-08-10T00:00:00Z",
  is_instance: true,
  master_event_id: "event-1",
  instance_id: "instance-1",
  persons: [
    {
      id: "person-1",
      display_name: "Alice",
      primary_nickname: "Alice",
      tags: [],
    },
  ],
};

describe("plannedEventModalUtils", () => {
  it("omits unchanged related fields from update payloads", () => {
    const initial = buildPlannedEventFormData({ event: baseEvent });
    const current = { ...initial, title: "Recurring Review Updated" };

    expect(buildPlannedEventUpdatePayload(initial, current)).toEqual({
      title: "Recurring Review Updated",
    });
  });

  it("preserves explicit clears in update payloads", () => {
    const initial = buildPlannedEventFormData({ event: baseEvent });
    const current = {
      ...initial,
      dimension_id: null,
      task_id: null,
      person_ids: [],
    };

    expect(buildPlannedEventUpdatePayload(initial, current)).toEqual({
      dimension_id: null,
      task_id: null,
      person_ids: [],
    });
  });
});
