import { useTranslation } from "react-i18next";
import type { RefObject } from "react";
import SessionContextPicker, {
  type SessionContextPickerRef,
} from "./SessionContextPicker";
import type {
  SessionContextBox,
  SessionContextSelectionResponse,
} from "@/types/cardbox";
import MessageInput, { type MessageInputRef } from "./MessageInput";

type RateLimitNotice = {
  message: string;
  title?: string;
};

interface ChatInputPanelProps {
  resolvedSessionId: string | null;
  sessionContextBoxes: SessionContextBox[];
  isSessionContextUpdating: boolean;
  addSessionBoxes: (
    boxIds: string[],
  ) => Promise<SessionContextSelectionResponse | undefined>;
  sessionContextPickerRef: RefObject<SessionContextPickerRef | null>;
  messageInputRef: RefObject<MessageInputRef | null>;
  onSendMessage: (content: string) => Promise<void>;
  sendDisabled: boolean;
  selectedAgent: string;
  translateAgentName: (name: string) => string;
  rateLimitNotice: RateLimitNotice | null;
}

const ChatInputPanel: React.FC<ChatInputPanelProps> = ({
  resolvedSessionId,
  sessionContextBoxes,
  isSessionContextUpdating,
  addSessionBoxes,
  sessionContextPickerRef,
  messageInputRef,
  onSendMessage,
  sendDisabled,
  selectedAgent,
  translateAgentName,
  rateLimitNotice,
}) => {
  const { t } = useTranslation();

  return (
    <div>
      <SessionContextPicker
        ref={sessionContextPickerRef}
        sessionId={resolvedSessionId}
        existingBoxes={sessionContextBoxes}
        onAddBoxes={addSessionBoxes}
        isUpdating={isSessionContextUpdating}
        showInlineTrigger={false}
      />
      <div className="border-t border-base-300 bg-base-200 rounded-b-lg flex-shrink-0">
        <MessageInput
          ref={messageInputRef}
          onSendMessage={onSendMessage}
          disabled={sendDisabled}
          placeholder={t("agent.inputPlaceholderWithAgent", {
            agent: translateAgentName(selectedAgent),
          })}
        />
      </div>
      {rateLimitNotice?.message && (
        <div className="px-4 pb-4 text-sm text-warning flex items-start gap-2">
          <span title={rateLimitNotice.title}>{rateLimitNotice.message}</span>
        </div>
      )}
    </div>
  );
};

export default ChatInputPanel;
