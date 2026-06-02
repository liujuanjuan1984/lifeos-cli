import { useMemo, useCallback } from "react";
import type { FocusEvent, MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { TokenUsageSnapshot } from "@/types/agentMessage";
import type { SessionContextBox } from "@/types/cardbox";
import type { AgentProfileSummary } from "@/types/agent";
import { formatTokens } from "@/utils/core";
import { useHoverTooltip } from "@/hooks/useHoverTooltip";
import HoverTooltipOverlay from "@/components/HoverTooltipOverlay";
import ActionButton, { ActionButtonGroup } from "@/components/ActionButton";
import EnumSelect, { type EnumOption } from "@/components/selects/EnumSelect";
import SessionContextBar from "./SessionContextBar";

interface ChatHeaderProps {
  title: string;
  summary: string;
  usageTotal: TokenUsageSnapshot | null;
  isSystemSession: boolean;
  resolvedSessionId: string | null;
  sessionContextBoxes: SessionContextBox[];
  isSessionContextLoading: boolean;
  isSessionContextUpdating: boolean;
  isAssigningAgent: boolean;
  isStreaming: boolean;
  agentOptions: AgentProfileSummary[];
  selectedAgent: string;
  selectedAgentProfile?: AgentProfileSummary;
  isAgentLocked: boolean;
  translateAgentName: (name: string) => string;
  onAgentSelect: (agentName: string) => Promise<void>;
  onOpenContextPicker: (tab: "existing" | "create") => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  title,
  summary,
  usageTotal,
  isSystemSession,
  resolvedSessionId,
  sessionContextBoxes,
  isSessionContextLoading,
  isSessionContextUpdating,
  isAssigningAgent,
  isStreaming,
  agentOptions,
  selectedAgent,
  selectedAgentProfile,
  isAgentLocked,
  translateAgentName,
  onAgentSelect,
  onOpenContextPicker,
}) => {
  const { t } = useTranslation();
  const {
    tooltipState: headerTooltip,
    showTooltip: showHeaderTooltip,
    schedulePositionUpdate: updateHeaderTooltipPosition,
    hideTooltip: hideHeaderTooltip,
    showTooltipForElement: showHeaderTooltipForElement,
  } = useHoverTooltip<null>({
    defaultOffset: { x: 16, y: -12 },
    focusOffset: (rect) => ({ x: -rect.width / 2, y: -16 }),
  });

  const usageBadge = useMemo(() => {
    if (!usageTotal) return null;
    return {
      totalTokens: usageTotal.total_tokens,
      cost: usageTotal.cost_usd ?? null,
    };
  }, [usageTotal]);

  const sessionHeaderTooltipContent = useMemo(() => {
    const usedTokens = usageBadge?.totalTokens ?? null;
    const tokensText =
      usedTokens != null
        ? t("agent.tokenUsage.tooltip.tokens", {
            used: formatTokens(usedTokens),
          })
        : null;
    const costValue = usageBadge?.cost;
    const costText =
      costValue != null && String(costValue).trim().length > 0
        ? t("agent.tokenUsage.tooltip.cost", { value: costValue })
        : null;

    return {
      title,
      summary,
      tokensText,
      costText,
    };
  }, [t, usageBadge, summary, title]);

  const headerTooltipAriaLabel = useMemo(() => {
    if (!sessionHeaderTooltipContent) return undefined;
    const parts = [
      sessionHeaderTooltipContent.title,
      sessionHeaderTooltipContent.summary,
      sessionHeaderTooltipContent.tokensText,
      sessionHeaderTooltipContent.costText,
    ].filter(Boolean) as string[];
    return parts.join(" ");
  }, [sessionHeaderTooltipContent]);

  const agentSelectOptions = useMemo<EnumOption[]>(
    () =>
      agentOptions.map((profile) => ({
        value: profile.name,
        label: translateAgentName(profile.name),
      })),
    [agentOptions, translateAgentName],
  );

  const handleHeaderMouseEnter = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!sessionHeaderTooltipContent) return;
      showHeaderTooltip({
        payload: null,
        position: { x: event.clientX, y: event.clientY },
      });
    },
    [sessionHeaderTooltipContent, showHeaderTooltip],
  );

  const handleHeaderMouseMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!headerTooltip) {
        if (!sessionHeaderTooltipContent) return;
        showHeaderTooltip({
          payload: null,
          position: { x: event.clientX, y: event.clientY },
        });
        return;
      }
      updateHeaderTooltipPosition({
        x: event.clientX,
        y: event.clientY,
      });
    },
    [
      headerTooltip,
      sessionHeaderTooltipContent,
      showHeaderTooltip,
      updateHeaderTooltipPosition,
    ],
  );

  const handleHeaderFocus = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      if (!sessionHeaderTooltipContent) return;
      showHeaderTooltipForElement(null, event.currentTarget);
    },
    [sessionHeaderTooltipContent, showHeaderTooltipForElement],
  );

  const handleHeaderBlur = useCallback(() => {
    hideHeaderTooltip();
  }, [hideHeaderTooltip]);

  const handleHeaderMouseLeave = useCallback(() => {
    hideHeaderTooltip();
  }, [hideHeaderTooltip]);

  return (
    <div className="p-4 border-b border-base-300 bg-base-200 rounded-t-lg flex-shrink-0 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div
          className="flex items-center gap-2 min-w-0"
          onMouseEnter={handleHeaderMouseEnter}
          onMouseMove={handleHeaderMouseMove}
          onMouseLeave={handleHeaderMouseLeave}
          onFocus={handleHeaderFocus}
          onBlur={handleHeaderBlur}
          tabIndex={0}
          aria-label={headerTooltipAriaLabel}
        >
          <h2 className="text-lg font-semibold text-base-content line-clamp-1 min-w-0">
            {title}
          </h2>
          {usageBadge?.totalTokens != null ? (
            <span className="badge badge-sm badge-outline border-primary/30 text-primary font-medium whitespace-nowrap">
              {t("agent.tokenUsage.badgeLabelFormatted", {
                value: formatTokens(usageBadge.totalTokens ?? 0),
              })}
            </span>
          ) : null}
        </div>

        {!isSystemSession && (
          <ActionButtonGroup gap="sm" align="end">
            <ActionButton
              label={t("agent.context.tabExisting")}
              size="sm"
              variant="outline"
              onClick={() => onOpenContextPicker("existing")}
              disabled={!resolvedSessionId}
            />
            <ActionButton
              label={t("agent.context.inlineTrigger")}
              size="sm"
              color="primary"
              variant="solid"
              onClick={() => onOpenContextPicker("create")}
              disabled={
                !resolvedSessionId ||
                isSessionContextUpdating ||
                isAssigningAgent
              }
            />
          </ActionButtonGroup>
        )}
      </div>

      <HoverTooltipOverlay
        visible={Boolean(headerTooltip && sessionHeaderTooltipContent)}
        position={headerTooltip?.position ?? null}
        offset={headerTooltip?.offset}
        className="text-sm leading-relaxed max-w-sm"
      >
        <div className="space-y-2">
          <div>
            <div className="font-semibold text-base-content">
              {sessionHeaderTooltipContent.title}
            </div>
            <div className="text-sm text-base-content/70">
              {sessionHeaderTooltipContent.summary}
            </div>
          </div>
          {(sessionHeaderTooltipContent.tokensText ||
            sessionHeaderTooltipContent.costText) && (
            <div className="space-y-1 text-sm text-base-content">
              {sessionHeaderTooltipContent.tokensText ? (
                <div>{sessionHeaderTooltipContent.tokensText}</div>
              ) : null}
              {sessionHeaderTooltipContent.costText ? (
                <div>{sessionHeaderTooltipContent.costText}</div>
              ) : null}
            </div>
          )}
        </div>
      </HoverTooltipOverlay>

      {!isSystemSession ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="agent-selector" className="text-xs font-semibold">
              {t("agent.selectLabel")}
            </label>
            <EnumSelect
              id="agent-selector"
              value={selectedAgent}
              onChange={(value) => {
                if (!value) return;
                void onAgentSelect(String(value));
              }}
              options={agentSelectOptions}
              showLabel={false}
              size="sm"
              className="min-w-[12rem]"
              autoWidth
              disabled={
                isStreaming ||
                isAssigningAgent ||
                isAgentLocked ||
                !agentOptions.length ||
                !resolvedSessionId
              }
            />
            {selectedAgentProfile?.description && (
              <span className="text-xs text-base-content/60">
                {selectedAgentProfile.description}
              </span>
            )}
          </div>
          {resolvedSessionId ? (
            <SessionContextBar
              boxes={sessionContextBoxes}
              isLoading={isSessionContextLoading}
            />
          ) : (
            <div className="text-xs text-base-content/60">
              {t("agent.context.createOrSelectSession")}
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-3 text-sm text-base-content/70 bg-base-200/80 rounded-lg">
          {t("agent.notifications.readonlyDescription")}
        </div>
      )}
    </div>
  );
};

export default ChatHeader;
