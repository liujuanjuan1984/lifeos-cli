import { useState } from "react";
import type { AgentMessage, ToolRunStatus } from "@/types/agentMessage";
import { useTranslation } from "react-i18next";
import ActionButton from "@/components/ActionButton";
import MarkdownRenderer from "@/components/common/MarkdownRenderer";
import { Icon } from "@/components/icons";
import ToolRunDetailsModal from "./ToolRunDetailsModal";
import { formatTime } from "@/utils/datetime";

interface MessageBubbleProps {
  message: AgentMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const { t } = useTranslation();
  const isToolMessage = message.kind === "tool";
  const isNotification = message.messageType === "system_notification";
  const isUser = message.sender === "user";
  const isTyping = Boolean(message.isTyping);
  const hasContent = Boolean(message.content?.trim?.());
  const [isToolDetailsOpen, setIsToolDetailsOpen] = useState(false);
  const deliveryState = message.deliveryState ?? null;
  const statusText = (() => {
    if (!isUser) return null;
    if (deliveryState === "pending") {
      return t("agent.messageStatus.pending");
    }
    if (deliveryState === "failed") {
      const reason = message.errorMessage?.trim();
      if (reason) {
        return t("agent.messageStatus.failedWithReason", { reason });
      }
      return t("agent.messageStatus.failed");
    }
    return null;
  })();
  const agentLabel =
    !isUser && message.agentName
      ? t(`agent.agents.${message.agentName}`, {
          defaultValue: message.agentName,
        })
      : null;

  // 如果是正在输入但没有内容的agent消息，不显示气泡，只显示头像和加载动画
  if (isTyping && !hasContent && !isUser) {
    return (
      <div className="flex justify-start">
        {/* AI avatar */}
        <div
          className="w-5 h-5 rounded-full bg-secondary text-secondary-content order-1 mr-2 flex items-center justify-center text-2xs font-bold shadow-sm"
          aria-hidden
        >
          {t("agent.identity.ai")}
        </div>

        {/* Loading indicator */}
        <div className="max-w-[80%] order-2">
          <div className="flex items-center space-x-2">
            <span className="flex space-x-1">
              <span className="w-2 h-2 bg-base-content/40 rounded-full animate-bounce"></span>
              <span
                className="w-2 h-2 bg-base-content/40 rounded-full animate-bounce"
                style={{ animationDelay: "0.1s" }}
              ></span>
              <span
                className="w-2 h-2 bg-base-content/40 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></span>
            </span>
            <span className="text-xs text-base-content/50">
              {t("agent.thinking")}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (isNotification) {
    const severity = message.severity ?? "info";
    const severityClassMap: Record<string, string> = {
      info: "border-info bg-info/10 text-base-content",
      warning: "border-warning bg-warning/10 text-base-content",
      critical: "border-error bg-error/10 text-error-content",
    };
    const severityBadgeMap: Record<string, string> = {
      info: "badge-info",
      warning: "badge-warning",
      critical: "badge-error",
    };
    const containerClasses = [
      "w-full sm:max-w-[80%] border rounded-2xl px-4 py-3 shadow-sm",
      severityClassMap[severity] ?? "border-base-300 bg-base-200",
    ].join(" ");
    const headerTime = formatTime(message.timestamp);
    const metadata = message.metadata ?? null;
    const title =
      (metadata?.title as string | undefined) ||
      t("agent.notifications.titleFallback");
    const payload =
      metadata?.payload && typeof metadata.payload === "object"
        ? (metadata.payload as Record<string, unknown>)
        : null;
    const payloadEntries = payload
      ? Object.entries(payload).filter(([key]) => key !== "title")
      : [];

    return (
      <div className="flex justify-start">
        <div className={containerClasses}>
          <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={[
                  "badge badge-sm",
                  severityBadgeMap[severity] ?? "badge-outline",
                ].join(" ")}
              >
                {t(`agent.notifications.severity.${severity}`)}
              </span>
              <span className="text-sm normal-case font-medium line-clamp-1">
                {title}
              </span>
            </div>
            <span className="text-xs text-base-content/60">{headerTime}</span>
          </div>

          {hasContent && (
            <p className="mt-3 text-sm whitespace-pre-wrap break-words text-base-content">
              {message.content}
            </p>
          )}

          {payloadEntries.length > 0 && (
            <div className="mt-3 border-t border-base-300/70 pt-2 text-xs text-base-content/70 space-y-1">
              {payloadEntries.map(([key, value]) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="font-medium capitalize text-base-content/80 min-w-[4.5rem]">
                    {key}
                  </span>
                  <span className="flex-1 break-words">
                    {typeof value === "string" || typeof value === "number"
                      ? String(value)
                      : JSON.stringify(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isToolMessage) {
    const status = (message.toolStatus ?? "started") as ToolRunStatus;
    const statusClassMap: Record<ToolRunStatus, string> = {
      started: "border-info bg-info/10 text-info",
      finished: "border-success bg-success/10 text-success",
      failed: "border-error bg-error/10 text-error",
    };
    const badgeClassMap: Record<ToolRunStatus, string> = {
      started: "bg-info text-info-content",
      finished: "bg-success text-success-content",
      failed: "bg-error text-error-content",
    };
    const toolName = message.toolName || t("agent.toolRun.unknownTool");
    const statusLabel = t(`agent.toolRun.status.${status}`, {
      defaultValue: status,
    });
    const headerTimestampSource =
      message.toolStartedAt || message.timestamp || new Date().toISOString();
    const headerTimestamp = formatTime(headerTimestampSource);
    const progressDetail =
      message.toolProgress?.detail ?? message.toolProgress?.message ?? null;
    const contentText =
      message.toolMessage && message.toolMessage.trim().length > 0
        ? message.toolMessage
        : message.content;
    const hasDetails = Boolean(
      (message.toolArguments &&
        Object.keys(message.toolArguments).length > 0) ||
        contentText?.trim() ||
        message.toolProgress ||
        progressDetail,
    );

    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] order-2">
          <div
            className={`px-4 py-3 rounded-2xl border shadow-sm ${
              statusClassMap[status] ??
              "border-base-300 bg-base-200 text-base-content"
            }`}
          >
            <div className="flex items-center justify-between gap-4 text-sm flex-wrap">
              <div className="flex items-center gap-2 flex-wrap text-base-content">
                <span className="font-semibold truncate max-w-[180px]">
                  {toolName}
                </span>
                {hasDetails && (
                  <ActionButton
                    label={t("agent.toolRun.viewDetails")}
                    size="xs"
                    variant="outline"
                    onClick={() => setIsToolDetailsOpen(true)}
                  />
                )}
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide">
                {statusLabel}
              </span>
            </div>
          </div>
          <div className="text-xs text-base-content/60 mt-1">
            {headerTimestamp}
          </div>
        </div>

        <div
          className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold shadow-sm order-1 mr-2 ${
            badgeClassMap[status] ?? "bg-secondary text-secondary-content"
          }`}
          aria-hidden
        >
          <Icon name="settings" size={14} aria-hidden />
        </div>

        {hasDetails && (
          <ToolRunDetailsModal
            isOpen={isToolDetailsOpen}
            onClose={() => setIsToolDetailsOpen(false)}
            message={message}
          />
        )}
      </div>
    );
  }

  const renderContent = () => {
    if (isTyping && !hasContent) {
      return (
        <span className="flex items-center space-x-2">
          <span className="flex space-x-1">
            <span className="w-2 h-2 bg-base-content/40 rounded-full animate-bounce"></span>
            <span
              className="w-2 h-2 bg-base-content/40 rounded-full animate-bounce"
              style={{ animationDelay: "0.1s" }}
            ></span>
            <span
              className="w-2 h-2 bg-base-content/40 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></span>
          </span>
          <span className="text-xs text-base-content/50">
            {t("agent.thinking")}
          </span>
        </span>
      );
    }

    const normalizedContent = isTyping
      ? (message.content?.trimStart() ?? "")
      : (message.content ?? "");

    return (
      <MarkdownRenderer
        content={normalizedContent}
        isStreaming={isTyping}
        className="prose-sm prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-p:whitespace-pre-wrap"
      />
    );
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] ${isUser ? "order-1" : "order-2"}`}>
        {/* Message content */}
        <div
          className={`px-4 py-3 rounded-2xl shadow-sm ${
            isUser
              ? "bg-primary text-primary-content rounded-br-md"
              : "bg-base-200 text-base-content rounded-bl-md"
          }`}
          style={{
            boxShadow: isUser
              ? "var(--shadow-moderate-near)"
              : "var(--shadow-subtle-near)",
          }}
        >
          {!isUser && agentLabel && (
            <div className="text-xs font-medium text-base-content/60 mb-1">
              {agentLabel}
            </div>
          )}
          {renderContent()}
        </div>

        {/* Timestamp */}
        <div
          className={`text-xs text-base-content/60 mt-1 ${isUser ? "text-right" : "text-left"}`}
        >
          {formatTime(message.timestamp)}
        </div>

        {statusText && (
          <div
            className={`text-[0.7rem] mt-1 ${
              isUser ? "text-right text-primary-content/70" : "text-left"
            }`}
          >
            {statusText}
          </div>
        )}
      </div>

      {/* Small identity icon outside the bubble */}
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold shadow-sm ${
          isUser
            ? "bg-primary text-primary-content order-2 ml-2"
            : "bg-secondary text-secondary-content order-1 mr-2"
        }`}
        aria-hidden
      >
        {isUser ? t("agent.identity.user") : t("agent.identity.ai")}
      </div>
    </div>
  );
}
