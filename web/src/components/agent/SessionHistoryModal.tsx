import { useTranslation } from "react-i18next";
import ModalBase from "@/layouts/ModalBase";
import ActionButton, { DeleteButton } from "@/components/ActionButton";
import type { AgentSession } from "@/types/session";
import { formatDateTime } from "@/utils/datetime";

interface SessionHistoryModalProps {
  isOpen: boolean;
  isLoading: boolean;
  sessions: AgentSession[];
  activeSessionId: string | null;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onMarkAllNotifications: (sessionId: string) => void;
  onDeleteSession: (session: AgentSession, event: React.MouseEvent) => void;
  isMarkingNotifications: boolean;
  isDeletingSession: boolean;
}

const SessionHistoryModal: React.FC<SessionHistoryModalProps> = ({
  isOpen,
  isLoading,
  sessions,
  activeSessionId,
  onClose,
  onSelectSession,
  onMarkAllNotifications,
  onDeleteSession,
  isMarkingNotifications,
  isDeletingSession,
}) => {
  const { t } = useTranslation();

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={t("agent.sessions.historyModalTitle")}
      size="xl"
      overlayClosable={true}
      showCloseButton={true}
    >
      <div className="px-4 pb-4 space-y-3 max-h-[70vh] overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-base-content/70">{t("common.loading")}</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-base-content/70">
            {t("agent.sessions.empty")}
          </p>
        ) : (
          sessions.map((session, index) => {
            const classes = [
              "w-full text-left border rounded-md px-4 py-3 transition-colors duration-150",
              session.id === activeSessionId
                ? "border-primary bg-primary/10 text-primary"
                : "border-base-300 hover:border-primary/60 hover:bg-base-100",
            ].join(" ");
            const lastUpdatedLabel = formatDateTime(session.lastActivityAt);
            const rawName = (session.name ?? "").trim();
            const displayName =
              rawName.length > 0
                ? rawName
                : t("agent.sessions.sessionLabel", {
                    index: index + 1,
                    date: lastUpdatedLabel,
                  });
            const summaryText = session.summary?.trim();

            return (
              <div key={session.id} className={classes}>
                <div className="flex items-start justify-between gap-2">
                  <button
                    className="flex-1 text-left"
                    onClick={() => onSelectSession(session.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium line-clamp-1">
                          {displayName}
                        </span>
                        {session.unreadCount ? (
                          <span className="badge badge-xs badge-primary">
                            {session.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-xs text-base-content/60">
                        {lastUpdatedLabel}
                      </span>
                    </div>
                    <div className="text-xs text-base-content/60 mt-1">
                      {t("agent.sessions.messageCount", {
                        count: session.messageCount,
                      })}
                    </div>
                    <div className="text-xs text-base-content/70 line-clamp-2 mt-1">
                      {summaryText && summaryText.length > 0
                        ? summaryText
                        : t("agent.summary.placeholder")}
                    </div>
                  </button>
                  {session.sessionType === "system" ? (
                    <ActionButton
                      label={t("agent.sessions.markAllRead")}
                      size="xs"
                      variant="ghost"
                      className="ml-2 flex-shrink-0"
                      disabled={
                        isMarkingNotifications ||
                        (session.unreadCount ?? 0) === 0
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        onMarkAllNotifications(session.id);
                      }}
                    />
                  ) : (
                    <DeleteButton
                      onClick={(event) => onDeleteSession(session, event)}
                      size="xs"
                      className="ml-2 flex-shrink-0"
                      ariaLabel={t("agent.sessions.delete")}
                      disabled={isDeletingSession}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </ModalBase>
  );
};

export default SessionHistoryModal;
