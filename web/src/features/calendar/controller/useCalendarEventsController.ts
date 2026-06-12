import { useCallback, useMemo, useState } from "react";
import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import type {
  DateSelectArg,
  EventClickArg,
  EventInput,
} from "@fullcalendar/core";
import { plannedEventsApi } from "@/services/api/plannedEvents";
import { actualEventsApi } from "@/services/api/actualEvents";
import { actualEventsKeys, plannedEventsKeys } from "@/services/api/queryKeys";
import { invalidatePlannedEventLists } from "@/services/api/cacheInvalidation/plannedEvents";
import type {
  ActualEvent,
  PlannedEvent,
  Task as ApiTask,
  Vision,
} from "@/services/api";
import type { UUID } from "@/types/primitive";

interface SelectedDateInfo {
  start: Date;
  end: Date;
  allDay: boolean;
}

interface UseCalendarEventsControllerParams {
  startISO: string | null;
  endISO: string | null;
  showPlannedEvents: boolean;
  showActualEvents: boolean;
  selectedDimensionId: UUID | null | undefined;
  taskIndicatorLabel: string;
  preloadedTasks: ApiTask[];
  visions: Vision[];
  timezone: string;
}

interface UseCalendarEventsControllerResult {
  events: EventInput[];
  loading: boolean;
  error: string | null;
  showEventModal: boolean;
  eventModalProps: {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    event: PlannedEvent | null;
    initialDateInfo: SelectedDateInfo | null;
    preloadedTasks: ApiTask[];
    visions: Vision[];
    timezone: string;
  };
  handleDateSelect: (selectInfo: DateSelectArg) => void;
  handleEventClick: (clickInfo: EventClickArg) => void;
}

const getQueryErrorMessage = (
  query: UseQueryResult<unknown, unknown>,
): string | null => {
  if (!query.error) return null;
  if (query.error instanceof Error) {
    return query.error.message;
  }
  return String(query.error);
};

export function useCalendarEventsController({
  startISO,
  endISO,
  showPlannedEvents,
  showActualEvents,
  selectedDimensionId,
  taskIndicatorLabel,
  preloadedTasks,
  visions,
  timezone,
}: UseCalendarEventsControllerParams): UseCalendarEventsControllerResult {
  const queryClient = useQueryClient();
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<PlannedEvent | null>(null);
  const [selectedDateInfo, setSelectedDateInfo] =
    useState<SelectedDateInfo | null>(null);

  const plannedQuery = useQuery<PlannedEvent[]>({
    queryKey: plannedEventsKeys.list({
      start: startISO ?? undefined,
      end: endISO ?? undefined,
    }),
    queryFn: async () => {
      const response = await plannedEventsApi.fetchRange(startISO!, endISO!);
      return response.items ?? [];
    },
    enabled: Boolean(startISO && endISO && showPlannedEvents),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: [],
  });

  const actualQuery = useQuery<ActualEvent[]>({
    queryKey: actualEventsKeys.list({
      start: startISO ?? undefined,
      end: endISO ?? undefined,
      timezone,
    }),
    queryFn: async () => {
      const response = await actualEventsApi.fetchRange(startISO!, endISO!);
      return response.items;
    },
    enabled: Boolean(startISO && endISO && showActualEvents),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: [],
    select: (rows: ActualEvent[]) =>
      selectedDimensionId === undefined
        ? rows
        : rows.filter((row) =>
            selectedDimensionId === null
              ? row.dimension_id === null
              : row.dimension_id === selectedDimensionId,
          ),
  });

  const planned = useMemo(() => plannedQuery.data ?? [], [plannedQuery.data]);
  const actual = useMemo(() => actualQuery.data ?? [], [actualQuery.data]);

  const events = useMemo(() => {
    const plannedMapped: EventInput[] = (showPlannedEvents ? planned : []).map(
      (event, index) => {
        const hasTask = event.task_id != null;
        return {
          id: event.is_instance
            ? `planned-${event.master_event_id || event.id}-instance-${event.start_time}-${index}`
            : `planned-${event.id}`,
          title: hasTask
            ? `${taskIndicatorLabel}: ${event.title}`
            : event.title,
          start: event.start_time,
          end: event.end_time || undefined,
          allDay: event.is_all_day,
          classNames: hasTask
            ? ["planned-event", "task-linked"]
            : ["planned-event"],
          extendedProps: {
            type: "planned",
            originalEvent: event,
            priority: event.priority,
            isRecurring: event.is_recurring,
            tags: event.tags,
            hasTask,
            taskId: event.task_id,
          },
        } as EventInput;
      },
    );

    const actualMapped: EventInput[] = (showActualEvents ? actual : []).map(
      (event, index) => ({
        id: `actual-${event.id}-${event.start_time}-${index}`,
        title: event.title,
        start: event.start_time,
        end: event.end_time || undefined,
        allDay: false,
        classNames: ["actual-event"],
        extendedProps: {
          type: "actual",
          originalEvent: event,
          location: event.location,
          trackingMethod: event.tracking_method,
          energyLevel: event.energy_level,
          notes: event.notes,
          tags: event.tags,
          dimensionId: event.dimension_id,
        },
      }),
    );

    return [...plannedMapped, ...actualMapped];
  }, [
    actual,
    planned,
    showActualEvents,
    showPlannedEvents,
    taskIndicatorLabel,
  ]);

  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    setSelectedDateInfo({
      start: selectInfo.start,
      end: selectInfo.end,
      allDay: selectInfo.allDay,
    });
    setSelectedEvent(null);
    setShowEventModal(true);
  }, []);

  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    const eventType = clickInfo.event.extendedProps.type;
    const originalEvent = clickInfo.event.extendedProps.originalEvent;

    if (eventType === "planned") {
      setSelectedEvent(originalEvent as PlannedEvent);
      setSelectedDateInfo(null);
      setShowEventModal(true);
    }
  }, []);

  const handleModalClose = useCallback(() => {
    setShowEventModal(false);
    setSelectedEvent(null);
    setSelectedDateInfo(null);
  }, []);

  const handleEventSaved = useCallback(() => {
    void invalidatePlannedEventLists(queryClient);
    handleModalClose();
  }, [handleModalClose, queryClient]);

  const error = useMemo(() => {
    return (
      getQueryErrorMessage(plannedQuery as UseQueryResult<unknown, unknown>) ||
      getQueryErrorMessage(actualQuery as UseQueryResult<unknown, unknown>) ||
      null
    );
  }, [actualQuery, plannedQuery]);

  const eventModalProps = useMemo(
    () => ({
      isOpen: showEventModal,
      onClose: handleModalClose,
      onSave: handleEventSaved,
      event: selectedEvent,
      initialDateInfo: selectedDateInfo,
      preloadedTasks,
      visions,
      timezone,
    }),
    [
      handleEventSaved,
      handleModalClose,
      preloadedTasks,
      selectedDateInfo,
      selectedEvent,
      showEventModal,
      timezone,
      visions,
    ],
  );

  return {
    events,
    loading: plannedQuery.isFetching || actualQuery.isFetching,
    error,
    showEventModal,
    eventModalProps,
    handleDateSelect,
    handleEventClick,
  };
}
