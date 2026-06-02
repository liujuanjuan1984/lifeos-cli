import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Note } from "@/services/api/notes";
import { notesApi } from "@/services/api/notes";
import type { UUID } from "@/types/primitive";
import {
  invalidateNoteDetail,
  invalidateNotesAdvancedSearch,
  invalidateNotesLists,
  invalidateNotesStats,
} from "@/services/api/cacheInvalidation/notes";
import { logger } from "@/utils/core";

type AgentFeedStatus = "loading" | "success" | "error";

export interface AgentFeedEntry {
  id: string;
  status: AgentFeedStatus;
  title: string;
  description?: string;
  noteId?: UUID;
  jobId?: UUID;
  timestamp: number;
}

interface JobTracker {
  intervalId: number;
  startedAt: number;
}

const JOB_POLL_INTERVAL_MS = 1000;
const JOB_TIMEOUT_MS = 120000;
const AGENT_FEED_LIMIT = 3;

export function useSmartNoteAgentController() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isSmartNoteModalOpen, setIsSmartNoteModalOpen] = useState(false);
  const [agentFeed, setAgentFeed] = useState<AgentFeedEntry[]>([]);
  const jobPollersRef = useRef<Map<string, JobTracker>>(new Map());

  const notePreview = useCallback(
    (content?: string | null) => {
      if (!content) return t("agent.smartNote.notePreviewFallback");
      const trimmed = content.trim();
      if (!trimmed) return t("agent.smartNote.notePreviewFallback");
      return trimmed.length > 42 ? `${trimmed.slice(0, 42)}...` : trimmed;
    },
    [t],
  );

  const upsertAgentFeedEntry = useCallback(
    (entry: Omit<AgentFeedEntry, "timestamp">) => {
      setAgentFeed((prev) => {
        const timestamp = Date.now();
        const next = [...prev];
        const index = next.findIndex((item) => item.id === entry.id);
        if (index >= 0) {
          next[index] = { ...next[index], ...entry, timestamp };
          return next;
        }
        next.push({ ...entry, timestamp });
        if (next.length > AGENT_FEED_LIMIT) {
          return next.slice(next.length - AGENT_FEED_LIMIT);
        }
        return next;
      });
    },
    [],
  );

  const stopJobPolling = useCallback((jobId: string) => {
    const tracker = jobPollersRef.current.get(jobId);
    if (tracker) {
      clearInterval(tracker.intervalId);
      jobPollersRef.current.delete(jobId);
    }
  }, []);

  const refreshNotesAfterJob = useCallback(
    async (noteId: UUID) => {
      try {
        await Promise.all([
          invalidateNoteDetail(queryClient, noteId),
          invalidateNotesLists(queryClient),
          invalidateNotesAdvancedSearch(queryClient),
          invalidateNotesStats(queryClient),
        ]);
      } catch (error) {
        logger.error("Failed to refresh notes after ingest job", error);
      }
    },
    [queryClient],
  );

  const startJobPolling = useCallback(
    (jobId: UUID, noteId: UUID, preview: string) => {
      stopJobPolling(jobId);
      const tracker: JobTracker = {
        intervalId: 0,
        startedAt: Date.now(),
      };

      const poll = async () => {
        try {
          const summary = await notesApi.getIngestJob(jobId);
          const normalizedStatus = summary.status
            ? summary.status.toLowerCase()
            : "pending";
          const isSuccess = normalizedStatus === "succeeded";
          const isFailure = normalizedStatus === "failed";
          const isProcessing =
            normalizedStatus === "pending" ||
            normalizedStatus === "extracting" ||
            normalizedStatus === "executing";

          if (isSuccess) {
            upsertAgentFeedEntry({
              id: jobId,
              status: "success",
              title: t("agent.smartNote.jobSuccessTitle"),
              description: t("agent.smartNote.jobSuccessDescription", {
                preview,
              }),
              noteId,
              jobId,
            });
            await refreshNotesAfterJob(noteId);
            stopJobPolling(jobId);
            return;
          }

          if (isFailure) {
            const detail = summary.error?.trim();
            upsertAgentFeedEntry({
              id: jobId,
              status: "error",
              title: t("agent.smartNote.jobFailureTitle"),
              description: detail
                ? t("agent.smartNote.jobFailureDescriptionWithReason", {
                    preview,
                    reason: detail,
                  })
                : t("agent.smartNote.jobFailureDescription", { preview }),
              noteId,
              jobId,
            });
            stopJobPolling(jobId);
            return;
          }

          if (isProcessing) {
            upsertAgentFeedEntry({
              id: jobId,
              status: "loading",
              title: t("agent.smartNote.jobProcessingTitle"),
              description: t("agent.smartNote.jobProcessingDescription", {
                preview,
              }),
              noteId,
              jobId,
            });
            return;
          }

          logger.warn("Unknown ingest job status", normalizedStatus);
        } catch (error) {
          logger.error("Failed to poll ingest job", error);
        } finally {
          if (Date.now() - tracker.startedAt >= JOB_TIMEOUT_MS) {
            upsertAgentFeedEntry({
              id: jobId,
              status: "error",
              title: t("agent.smartNote.jobTimeoutTitle"),
              description: t("agent.smartNote.jobTimeoutDescription", {
                preview,
              }),
              noteId,
              jobId,
            });
            stopJobPolling(jobId);
          }
        }
      };

      tracker.intervalId = window.setInterval(() => {
        void poll();
      }, JOB_POLL_INTERVAL_MS);
      jobPollersRef.current.set(jobId, tracker);
      void poll();
    },
    [refreshNotesAfterJob, stopJobPolling, t, upsertAgentFeedEntry],
  );

  const handleIntelligentNoteCreated = useCallback(
    (note?: Note) => {
      if (!note) return;
      const preview = notePreview(note.content);
      if (note.ingest_job?.id) {
        upsertAgentFeedEntry({
          id: note.ingest_job.id,
          status: "loading",
          title: t("agent.smartNote.jobQueuedTitle"),
          description: t("agent.smartNote.jobQueuedDescription", { preview }),
          noteId: note.id,
          jobId: note.ingest_job.id,
        });
        startJobPolling(note.ingest_job.id, note.id, preview);
        return;
      }

      upsertAgentFeedEntry({
        id: note.id,
        status: "success",
        title: t("agent.smartNote.instantSuccessTitle"),
        description: t("agent.smartNote.instantSuccessDescription", {
          preview,
        }),
        noteId: note.id,
      });
    },
    [notePreview, startJobPolling, t, upsertAgentFeedEntry],
  );

  const handleAgentBubbleClose = useCallback(() => {
    setAgentFeed([]);
  }, []);

  const handleAgentClick = useCallback(() => {
    setIsSmartNoteModalOpen(true);
  }, []);

  const handleSmartNoteModalClose = useCallback(() => {
    setIsSmartNoteModalOpen(false);
  }, []);

  useEffect(() => {
    const pollers = jobPollersRef.current;
    return () => {
      pollers.forEach((tracker) => clearInterval(tracker.intervalId));
      pollers.clear();
    };
  }, []);

  return {
    isSmartNoteModalOpen,
    agentFeed,
    hasAgentMessages: agentFeed.length > 0,
    handleIntelligentNoteCreated,
    handleAgentBubbleClose,
    handleAgentClick,
    handleSmartNoteModalClose,
  };
}
