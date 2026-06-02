import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { logger } from "@/utils/core";
import { visionsApi } from "@/services/api/visions";
import { tasksApi } from "@/services/api/tasks";
import { visionsKeys, tasksKeys } from "@/services/api/queryKeys";
import { MAX_TASKS_PAGE_SIZE } from "@/utils/constants";
import type { Task, Vision } from "@/services/api";
import type { UUID } from "@/types/primitive";

interface UseVisionOrchardDataParams {
  statusFilter: string;
  dimensionFilter?: UUID | null;
}

interface UseVisionOrchardDataResult {
  visions: Vision[];
  visionTasks: Record<UUID, Task[]>;
  loading: boolean;
}

export function useVisionOrchardData({
  statusFilter,
  dimensionFilter,
}: UseVisionOrchardDataParams): UseVisionOrchardDataResult {
  const queryClient = useQueryClient();
  const [visionTasks, setVisionTasks] = useState<Record<UUID, Task[]>>({});
  const [loading, setLoading] = useState(true);
  const page = 1;
  const size = 100;

  const visionsQuery = useQuery({
    queryKey: visionsKeys.list({ status: statusFilter, page, size }),
    queryFn: () => visionsApi.getAll(statusFilter, page, size),
    staleTime: 5 * 60 * 1000,
  });

  const filteredVisions = useMemo(() => {
    const visionItems = visionsQuery.data?.items ?? [];
    if (dimensionFilter === undefined) {
      return visionItems;
    }
    if (dimensionFilter === null) {
      return visionItems.filter((vision) => !vision.dimension_id);
    }
    return visionItems.filter(
      (vision) => vision.dimension_id === dimensionFilter,
    );
  }, [dimensionFilter, visionsQuery.data?.items]);

  useEffect(() => {
    let cancelled = false;

    const resetState = () => {
      if (cancelled) return;
      setVisionTasks({});
      setLoading(false);
    };

    if (!visionsQuery.data) {
      resetState();
      return () => {
        cancelled = true;
      };
    }

    if (filteredVisions.length === 0) {
      resetState();
      return () => {
        cancelled = true;
      };
    }

    const loadTasks = async () => {
      setLoading(true);

      try {
        const visionIds = filteredVisions.map((vision) => vision.id);
        const allTasks =
          (await queryClient.fetchQuery<Task[]>({
            queryKey: tasksKeys.list({
              vision_in: visionIds,
              fields: "basic",
              size: MAX_TASKS_PAGE_SIZE,
            }),
            queryFn: () =>
              tasksApi.queryAllPaged({
                visionIds,
                fields: "basic",
                pageSize: MAX_TASKS_PAGE_SIZE,
              }),
            staleTime: 5 * 60 * 1000,
          })) ?? [];

        const nextTasks: Record<UUID, Task[]> = {};
        visionIds.forEach((id) => {
          nextTasks[id] = [];
        });

        allTasks.forEach((task) => {
          if (task.vision_id && nextTasks[task.vision_id]) {
            nextTasks[task.vision_id].push(task);
          }
        });

        if (!cancelled) {
          setVisionTasks(nextTasks);
        }
      } catch (error) {
        logger.error("Failed to fetch orchard data:", error);
        if (!cancelled) {
          setVisionTasks({});
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadTasks();

    return () => {
      cancelled = true;
    };
  }, [filteredVisions, queryClient, visionsQuery.data]);

  return {
    visions: filteredVisions,
    visionTasks,
    loading: loading || visionsQuery.isFetching,
  };
}
