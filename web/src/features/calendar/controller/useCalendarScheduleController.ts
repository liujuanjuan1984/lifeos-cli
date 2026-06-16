import { useCallback, useMemo, useState } from "react";
import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import type {
  DateSelectArg as FullCalendarDateSelectArg,
  EventClickArg as FullCalendarEventClickArg,
  EventInput as FullCalendarScheduleInput,
} from "@fullcalendar/core";
import { plannedEventsApi } from "@/services/api/plannedEvents";
import { timelogsApi } from "@/services/api/timelogs";
import { timelogsKeys, plannedEventsKeys } from "@/services/api/queryKeys";
import { invalidatePlannedEventLists } from "@/services/api/cacheInvalidation/plannedEvents";
import type {
  Timelog,
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

interface UseCalendarScheduleControllerParams {
  startISO: string | null;
  endISO: string | null;
  showPlannedEvents: boolean;
  showTimelogs: boolean;
  selectedAreaId: UUID | null | undefined;
  taskIndicatorLabel: string;
  preloadedTasks: ApiTask[];
  visions: Vision[];
  timezone: string;
}

interface UseCalendarScheduleControllerResult {
  scheduleEntries: FullCalendarScheduleInput[];
  loading: boolean;
  error: string | null;
  showPlannedEventModal: boolean;
  plannedEventModalProps: {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    plannedEvent: PlannedEvent | null;
    initialDateInfo: SelectedDateInfo | null;
    preloadedTasks: ApiTask[];
    visions: Vision[];
    timezone: string;
  };
  handleDateSelect: (selectInfo: FullCalendarDateSelectArg) => void;
  handlePlannedEventClick: (clickInfo: FullCalendarEventClickArg) => void;
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

export function useCalendarScheduleController({
  startISO,
  endISO,
  showPlannedEvents,
  showTimelogs,
  selectedAreaId,
  taskIndicatorLabel,
  preloadedTasks,
  visions,
  timezone,
}: UseCalendarScheduleControllerParams): UseCalendarScheduleControllerResult {
  const queryClient = useQueryClient();
  const [showPlannedEventModal, setShowPlannedEventModal] = useState(false);
  const [selectedPlannedEvent, setSelectedPlannedEvent] =
    useState<PlannedEvent | null>(null);
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

  const timelogQuery = useQuery<Timelog[]>({
    queryKey: timelogsKeys.list({
      start: startISO ?? undefined,
      end: endISO ?? undefined,
      timezone,
    }),
    queryFn: async () => {
      const response = await timelogsApi.fetchRange(startISO!, endISO!);
      return response.items;
    },
    enabled: Boolean(startISO && endISO && showTimelogs),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: [],
    select: (rows: Timelog[]) =>
      selectedAreaId === undefined
        ? rows
        : rows.filter((row) =>
            selectedAreaId === null
              ? row.area_id === null
              : row.area_id === selectedAreaId,
          ),
  });

  const planned = useMemo(() => plannedQuery.data ?? [], [plannedQuery.data]);
  const timelogs = useMemo(() => timelogQuery.data ?? [], [timelogQuery.data]);

  const scheduleEntries = useMemo(() => {
    const plannedEventInputs: FullCalendarScheduleInput[] = (
      showPlannedEvents ? planned : []
    ).map((plannedEvent, index) => {
      const hasTask = plannedEvent.task_id != null;
      return {
        id: plannedEvent.is_instance
          ? `planned-${plannedEvent.master_event_id || plannedEvent.id}-instance-${plannedEvent.start_time}-${index}`
          : `planned-${plannedEvent.id}`,
        title: hasTask
          ? `${taskIndicatorLabel}: ${plannedEvent.title}`
          : plannedEvent.title,
        start: plannedEvent.start_time,
        end: plannedEvent.end_time || undefined,
        allDay: plannedEvent.is_all_day,
        classNames: hasTask
          ? ["planned-event", "task-linked"]
          : ["planned-event"],
        extendedProps: {
          entryType: "planned",
          originalPlannedEvent: plannedEvent,
          priority: plannedEvent.priority,
          isRecurring: plannedEvent.is_recurring,
          tags: plannedEvent.tags,
          hasTask,
          taskId: plannedEvent.task_id,
        },
      } as FullCalendarScheduleInput;
    });

    const timelogInputs: FullCalendarScheduleInput[] = (
      showTimelogs ? timelogs : []
    ).map((timelog, index) => ({
      id: `timelog-${timelog.id}-${timelog.start_time}-${index}`,
      title: timelog.title,
      start: timelog.start_time,
      end: timelog.end_time || undefined,
      allDay: false,
      classNames: ["timelog-event"],
      extendedProps: {
        entryType: "timelog",
        originalTimelog: timelog,
        location: timelog.location,
        trackingMethod: timelog.tracking_method,
        energyLevel: timelog.energy_level,
        notes: timelog.notes,
        tags: timelog.tags,
        areaId: timelog.area_id,
      },
    }));

    return [...plannedEventInputs, ...timelogInputs];
  }, [
    planned,
    showTimelogs,
    showPlannedEvents,
    taskIndicatorLabel,
    timelogs,
  ]);

  const handleDateSelect = useCallback((selectInfo: FullCalendarDateSelectArg) => {
    setSelectedDateInfo({
      start: selectInfo.start,
      end: selectInfo.end,
      allDay: selectInfo.allDay,
    });
    setSelectedPlannedEvent(null);
    setShowPlannedEventModal(true);
  }, []);

  const handlePlannedEventClick = useCallback((clickInfo: FullCalendarEventClickArg) => {
    const fullCalendarEntry = clickInfo.event;
    const entryType = fullCalendarEntry.extendedProps.entryType;
    const originalPlannedEvent =
      fullCalendarEntry.extendedProps.originalPlannedEvent;

    if (entryType === "planned") {
      setSelectedPlannedEvent(originalPlannedEvent as PlannedEvent);
      setSelectedDateInfo(null);
      setShowPlannedEventModal(true);
    }
  }, []);

  const handleModalClose = useCallback(() => {
    setShowPlannedEventModal(false);
    setSelectedPlannedEvent(null);
    setSelectedDateInfo(null);
  }, []);

  const handlePlannedEventSaved = useCallback(() => {
    void invalidatePlannedEventLists(queryClient);
    handleModalClose();
  }, [handleModalClose, queryClient]);

  const error = useMemo(() => {
    return (
      getQueryErrorMessage(plannedQuery as UseQueryResult<unknown, unknown>) ||
      getQueryErrorMessage(timelogQuery as UseQueryResult<unknown, unknown>) ||
      null
    );
  }, [plannedQuery, timelogQuery]);

  const plannedEventModalProps = useMemo(
    () => ({
      isOpen: showPlannedEventModal,
      onClose: handleModalClose,
      onSave: handlePlannedEventSaved,
      plannedEvent: selectedPlannedEvent,
      initialDateInfo: selectedDateInfo,
      preloadedTasks,
      visions,
      timezone,
    }),
    [
      handlePlannedEventSaved,
      handleModalClose,
      preloadedTasks,
      selectedDateInfo,
      selectedPlannedEvent,
      showPlannedEventModal,
      timezone,
      visions,
    ],
  );

  return {
    scheduleEntries,
    loading: plannedQuery.isFetching || timelogQuery.isFetching,
    error,
    showPlannedEventModal,
    plannedEventModalProps,
    handleDateSelect,
    handlePlannedEventClick,
  };
}
