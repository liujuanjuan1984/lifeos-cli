import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { AgentMessage } from "@/types/agentMessage";
import MessageBubble from "./MessageBubble";
import { Icon } from "@/components/icons";

interface MessageListProps {
  messages: AgentMessage[];
  isLoading?: boolean;
}

export default function MessageList({
  messages,
  isLoading = false,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const hasTypingMessage = messages.some((message) => message.isTyping);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: isLoading ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, isLoading]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && !isLoading ? (
        <div className="flex items-center justify-center h-full text-base-content/60">
          <div className="text-center">
            <Icon
              name="sparkles"
              size={48}
              className="mb-4 text-primary"
              aria-hidden
            />
            <h3 className="text-lg font-semibold mb-2">
              {t("agent.welcomeTitle")}
            </h3>
            <p className="text-sm">{t("agent.welcomeSubtitle")}</p>
          </div>
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {/* Loading indicator */}
          {isLoading && !hasTypingMessage && (
            <div className="flex justify-start">
              <div className="w-5 h-5 rounded-full bg-secondary text-secondary-content order-1 mr-2 flex items-center justify-center text-2xs font-bold">
                AI
              </div>
              <div className="max-w-[80%] order-2">
                <div className="px-4 py-3 rounded-2xl bg-base-200 text-base-content rounded-bl-md shadow-sm">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-base-content/40 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-base-content/40 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-base-content/40 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                    <span className="text-sm text-base-content/60">
                      {t("agent.thinking")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
}
