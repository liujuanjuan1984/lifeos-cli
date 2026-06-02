import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ModalBase from "@/layouts/ModalBase";
import type { AgentMessage, ToolRunStatus } from "@/types/agentMessage";
import { formatDateTime } from "@/utils/datetime";

interface ToolRunDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: AgentMessage;
}

const JsonBlock = ({
  title,
  value,
}: {
  title: string;
  value: string | null;
}) => {
  if (!value) return null;
  return (
    <section>
      <div className="text-sm font-semibold text-base-content mb-2">
        {title}
      </div>
      <pre className="text-xs whitespace-pre-wrap break-words bg-base-200 rounded-lg p-3 max-h-96 overflow-auto">
        {value}
      </pre>
    </section>
  );
};

const formatStructured = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return trimmed;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const ToolRunDetailsModal = ({
  isOpen,
  onClose,
  message,
}: ToolRunDetailsModalProps) => {
  const { t } = useTranslation();
  const toolName = message.toolName || t("agent.toolRun.unknownTool");
  const status = (message.toolStatus ?? "started") as ToolRunStatus;
  const statusLabel = t(`agent.toolRun.status.${status}`, {
    defaultValue: status,
  });

  const startedAtDetail = message.toolStartedAt
    ? formatDateTime(message.toolStartedAt)
    : null;
  const finishedAtDetail = message.toolFinishedAt
    ? formatDateTime(message.toolFinishedAt)
    : null;
  const durationDetail = (() => {
    const durationMs = message.toolDurationMs;
    if (typeof durationMs !== "number" || Number.isNaN(durationMs)) {
      return null;
    }
    if (durationMs <= 0) return null;
    return t("agent.toolRun.duration", {
      value:
        durationMs >= 1000
          ? `${(durationMs / 1000).toFixed(durationMs >= 10000 ? 0 : 1)}s`
          : `${durationMs}ms`,
    });
  })();

  const argumentsJson = useMemo(
    () => formatStructured(message.toolArguments),
    [message.toolArguments],
  );
  const outputJson = useMemo(() => {
    const content =
      message.toolMessage && message.toolMessage.trim().length > 0
        ? message.toolMessage
        : message.content;
    return formatStructured(content);
  }, [message.toolMessage, message.content]);
  const progressJson = useMemo(
    () => formatStructured(message.toolProgress),
    [message.toolProgress],
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={t("agent.toolRun.detailsTitle", { tool: toolName })}
      size="lg"
      showCloseButton
    >
      <div className="px-2 pb-4 space-y-4">
        <section className="bg-base-200 rounded-lg p-3 text-sm space-y-1">
          <div className="font-semibold text-base-content">{statusLabel}</div>
          {startedAtDetail && (
            <div className="text-base-content/70">
              {t("agent.toolRun.startedAt", { time: startedAtDetail })}
            </div>
          )}
          {finishedAtDetail && (
            <div className="text-base-content/70">
              {t("agent.toolRun.finishedAt", { time: finishedAtDetail })}
            </div>
          )}
          {durationDetail && (
            <div className="text-base-content/70">{durationDetail}</div>
          )}
        </section>

        <JsonBlock
          title={t("agent.toolRun.argumentsTitle")}
          value={argumentsJson}
        />
        <JsonBlock title={t("agent.toolRun.resultTitle")} value={outputJson} />
        <JsonBlock
          title={t("agent.toolRun.progressTitle")}
          value={progressJson}
        />
      </div>
    </ModalBase>
  );
};

export default ToolRunDetailsModal;
