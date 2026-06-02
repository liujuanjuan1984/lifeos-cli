import { useTranslation } from "react-i18next";
import ActionButton, { DeleteButton } from "@/components/ActionButton";
import SegmentedControl, {
  type SegmentedControlOption,
} from "@/components/forms/SegmentedControl";
import type { AgentSession } from "@/types/session";

export interface AgentSidebarSession {
  id: string;
  displayName: string;
  lastUpdatedLabel: string;
  messageCount: number;
  isActive: boolean;
  unreadCount: number;
  sessionType: string;
  source: AgentSession | null;
}

interface AgentSidebarProps {
  isAgentEditMode: boolean;
  isFloatingAgentVisible: boolean;
  onToggleAgentEditMode: () => void;
  onToggleFloatingAgent: () => void | Promise<void>;
  sessionTab: "chat" | "system";
  onChangeSessionTab: (tab: "chat" | "system") => void;
  hasSystemSessions: boolean;
  systemUnreadCount: number;
  sessionsLoading: boolean;
  recentSessions: AgentSidebarSession[];
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (session: AgentSession, event: React.MouseEvent) => void;
  isDeletingSession: boolean;
  onMarkAllNotifications: (sessionId: string) => void;
  isMarkingNotifications: boolean;
  onOpenHistory: () => void;
  onCreateSession: () => void;
  isCreatingSession: boolean;
  onQuickAction: (message: string) => void;
}

const AgentSidebar: React.FC<AgentSidebarProps> = ({
  isAgentEditMode,
  isFloatingAgentVisible,
  onToggleAgentEditMode,
  onToggleFloatingAgent,
  sessionTab,
  onChangeSessionTab,
  hasSystemSessions,
  systemUnreadCount,
  sessionsLoading,
  recentSessions,
  onSelectSession,
  onDeleteSession,
  isDeletingSession,
  onMarkAllNotifications,
  isMarkingNotifications,
  onOpenHistory,
  onCreateSession,
  isCreatingSession,
  onQuickAction,
}) => {
  const { t } = useTranslation();

  const handleQuickActionClick = (
    key: "todaySchedule" | "yesterdaySummary",
  ) => {
    const message = t(`agent.quickActions.${key}`);
    onQuickAction(message);
  };

  const sessionTabOptions: SegmentedControlOption[] = [
    {
      value: "chat",
      label: t("agent.sessions.tabs.chat"),
    },
    {
      value: "system",
      label:
        systemUnreadCount > 0 ? (
          <span className="inline-flex items-center gap-1">
            <span>{t("agent.sessions.tabs.system")}</span>
            <span className="text-xs text-primary">
              {t("agent.sessions.unreadStatus", {
                count: systemUnreadCount,
              })}
            </span>
          </span>
        ) : (
          t("agent.sessions.tabs.system")
        ),
      ariaLabel: t("agent.sessions.tabs.system"),
      disabled: !hasSystemSessions,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="card bg-base-200 card-compact">
        <div className="card-body p-3 space-y-2">
          <div className="text-sm font-semibold text-base-content">
            {t("agent.controls.title")}
          </div>
          <ActionButton
            label={
              isAgentEditMode
                ? t("agent.controls.moveAgentEditMode")
                : t("agent.controls.moveAgent")
            }
            color="neutral"
            variant="outline"
            size="sm"
            disabled={!isFloatingAgentVisible}
            onClick={onToggleAgentEditMode}
          />
          <ActionButton
            label={
              isFloatingAgentVisible
                ? t("agent.controls.hideFloatingAgent")
                : t("agent.controls.showFloatingAgent")
            }
            color="neutral"
            variant="outline"
            size="sm"
            onClick={onToggleFloatingAgent}
          />
        </div>
      </div>

      <div className="card bg-base-200 card-compact">
        <div className="card-body p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-base-content">
                {t("agent.sessions.recentTitle")}
              </div>
              <div className="hidden sm:block">
                <SegmentedControl
                  value={sessionTab}
                  size="xs"
                  inactiveVariant="outline"
                  options={sessionTabOptions}
                  onChange={(nextValue) =>
                    onChangeSessionTab(nextValue as "chat" | "system")
                  }
                />
              </div>
            </div>
            <ActionButton
              label={t("agent.sessions.historyButton")}
              size="xs"
              variant="ghost"
              onClick={onOpenHistory}
            />
          </div>

          <div className="sm:hidden">
            <SegmentedControl
              value={sessionTab}
              size="xs"
              inactiveVariant="outline"
              options={sessionTabOptions}
              onChange={(nextValue) =>
                onChangeSessionTab(nextValue as "chat" | "system")
              }
            />
          </div>

          <div className="space-y-2">
            {sessionsLoading ? (
              <p className="text-xs text-base-content/60">
                {t("common.loading")}
              </p>
            ) : recentSessions.length === 0 ? (
              <p className="text-xs text-base-content/60">
                {t("agent.sessions.empty")}
              </p>
            ) : (
              recentSessions.map((session) => {
                const containerClasses = [
                  "w-full text-sm border rounded-md px-3 py-2 transition-colors duration-150 flex items-center gap-2",
                  session.isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-base-300 hover:border-primary/60 hover:bg-base-100",
                ].join(" ");

                return (
                  <div key={session.id} className={containerClasses}>
                    <button
                      className="flex-1 text-left"
                      onClick={() => onSelectSession(session.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium line-clamp-1">
                            {session.displayName}
                          </span>
                          {session.unreadCount ? (
                            <span className="badge badge-xs badge-primary">
                              {session.unreadCount}
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs text-base-content/60">
                          {session.lastUpdatedLabel}
                        </span>
                      </div>
                      <div className="text-xs text-base-content/60 mt-1">
                        {t("agent.sessions.messageCount", {
                          count: session.messageCount,
                        })}
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
                    ) : session.source ? (
                      <DeleteButton
                        onClick={(event) =>
                          onDeleteSession(session.source!, event)
                        }
                        size="xs"
                        className="ml-2 flex-shrink-0"
                        ariaLabel={t("agent.sessions.delete")}
                        disabled={isDeletingSession}
                      />
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          {sessionTab === "chat" && (
            <ActionButton
              label={
                isCreatingSession
                  ? t("common.loading")
                  : t("agent.sessions.newSession")
              }
              size="sm"
              variant="outline"
              className="w-full"
              onClick={onCreateSession}
              disabled={isCreatingSession}
            />
          )}
        </div>
      </div>

      <div className="card bg-base-200 card-compact">
        <div className="card-body p-3 space-y-2">
          <div className="text-sm font-semibold text-base-content">
            {t("agent.quickActions.title")}
          </div>
          <div className="space-y-2">
            <ActionButton
              label={t("agent.quickActions.todaySchedule")}
              variant="ghost"
              size="sm"
              className="justify-start p-0 h-auto text-sm text-base-content/80 hover:text-primary"
              onClick={() => handleQuickActionClick("todaySchedule")}
            />
            <ActionButton
              label={t("agent.quickActions.yesterdaySummary")}
              variant="ghost"
              size="sm"
              className="justify-start p-0 h-auto text-sm text-base-content/80 hover:text-primary"
              onClick={() => handleQuickActionClick("yesterdaySummary")}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentSidebar;
