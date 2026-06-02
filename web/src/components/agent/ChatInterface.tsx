import { useCallback, forwardRef, useImperativeHandle, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { AgentSession, AgentSessionType } from "@/types/session";
import { useSessionContext } from "@/features/agent/controller/useSessionContext";
import { useAgentChatSession } from "@/features/agent/controller/useAgentChatSession";
import ChatHeader from "./ChatHeader";
import MessageViewport from "./MessageViewport";
import ChatInputPanel from "./ChatInputPanel";
import type { MessageInputRef } from "./MessageInput";
import type { SessionContextPickerRef } from "./SessionContextPicker";

export interface ChatInterfaceRef {
  setInputMessage: (message: string) => void;
}

interface ChatInterfaceProps {
  activeSessionId?: string | null;
  activeSession?: AgentSession | null;
  sessionType?: AgentSessionType | null;
  onMarkNotificationsRead?: (payload: {
    sessionId: string | null;
    messageIds: string[];
  }) => void;
}

const ChatInterface = forwardRef<ChatInterfaceRef, ChatInterfaceProps>(
  (
    {
      activeSessionId = null,
      activeSession = null,
      sessionType = null,
      onMarkNotificationsRead,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const messageInputRef = useRef<MessageInputRef>(null);
    const sessionContextPickerRef = useRef<SessionContextPickerRef>(null);

    const {
      resolvedSessionId,
      isSystemSession,
      messages,
      isStreaming,
      abortReason,
      handleSendMessage,
      rateLimitNotice,
      selectedAgent,
      selectedAgentProfile,
      agentOptions,
      translateAgentName,
      handleAgentSelect,
      sendDisabled,
      usageTotal,
      isAssigningAgent,
      isAgentLocked,
    } = useAgentChatSession({
      activeSessionId,
      activeSession,
      sessionType,
      onMarkNotificationsRead,
    });

    const {
      sessionContext,
      isLoading: isSessionContextLoading,
      isUpdating: isSessionContextUpdating,
      addSessionBoxes,
    } = useSessionContext(resolvedSessionId);
    const sessionContextBoxes = sessionContext?.boxes ?? [];

    const sessionTitle =
      (activeSession?.name ?? "").trim() || t("modules.agent.displayName");
    const sessionSummary =
      (activeSession?.summary ?? "").trim() || t("modules.agent.description");

    const openContextPicker = useCallback((tab: "existing" | "create") => {
      sessionContextPickerRef.current?.open(tab);
    }, []);

    useImperativeHandle(ref, () => ({
      setInputMessage: (message: string) => {
        messageInputRef.current?.setMessage(message);
      },
    }));

    return (
      <div className="flex flex-col h-[85vh]">
        <ChatHeader
          title={sessionTitle}
          summary={sessionSummary}
          usageTotal={usageTotal}
          isSystemSession={isSystemSession}
          resolvedSessionId={resolvedSessionId}
          sessionContextBoxes={sessionContextBoxes}
          isSessionContextLoading={isSessionContextLoading}
          isSessionContextUpdating={isSessionContextUpdating}
          isAssigningAgent={isAssigningAgent}
          isStreaming={isStreaming}
          agentOptions={agentOptions}
          selectedAgent={selectedAgent}
          selectedAgentProfile={selectedAgentProfile}
          isAgentLocked={isAgentLocked}
          translateAgentName={translateAgentName}
          onAgentSelect={handleAgentSelect}
          onOpenContextPicker={openContextPicker}
        />

        <MessageViewport
          messages={messages}
          isStreaming={isStreaming}
          abortReason={abortReason}
        />

        {!isSystemSession && (
          <ChatInputPanel
            resolvedSessionId={resolvedSessionId}
            sessionContextBoxes={sessionContextBoxes}
            isSessionContextUpdating={isSessionContextUpdating}
            addSessionBoxes={addSessionBoxes}
            sessionContextPickerRef={sessionContextPickerRef}
            messageInputRef={messageInputRef}
            onSendMessage={handleSendMessage}
            sendDisabled={sendDisabled}
            selectedAgent={selectedAgent}
            translateAgentName={translateAgentName}
            rateLimitNotice={rateLimitNotice}
          />
        )}
      </div>
    );
  },
);

ChatInterface.displayName = "ChatInterface";

export default ChatInterface;
