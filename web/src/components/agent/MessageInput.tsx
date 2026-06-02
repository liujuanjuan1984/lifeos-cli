import {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useTranslation } from "react-i18next";
import ActionButton from "@/components/ActionButton";
import { TextArea } from "@/components/forms";

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export interface MessageInputRef {
  setMessage: (message: string) => void;
}

const MessageInput = forwardRef<MessageInputRef, MessageInputProps>(
  ({ onSendMessage, disabled = false, placeholder }, ref) => {
    const [message, setMessage] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { t } = useTranslation();

    // Expose setMessage method to parent component
    useImperativeHandle(ref, () => ({
      setMessage: (newMessage: string) => {
        setMessage(newMessage);
      },
    }));

    // Auto-resize textarea
    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }, [message]);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (message.trim() && !disabled) {
        onSendMessage(message.trim());
        setMessage("");
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    };

    return (
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 p-4 bg-base-100 border-t border-base-300"
      >
        <div className="flex-1 relative">
          <TextArea
            ref={textareaRef}
            id="agent-message-input"
            name="agent-message-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? t("agent.inputPlaceholder")}
            disabled={disabled}
            className="h-24 lg:h-32 text-base"
            resize="none"
            rows={1}
            style={{ minHeight: "48px", maxHeight: "120px" }}
          />
        </div>

        <ActionButton
          type="submit"
          label={t("agent.sendMessageAriaLabel")}
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="w-5 h-5 stroke-current"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          }
          color="primary"
          variant="solid"
          size="md"
          shape="circle"
          iconOnly
          disabled={!message.trim() || disabled}
          ariaLabel={t("agent.sendMessageAriaLabel")}
        />
      </form>
    );
  },
);

MessageInput.displayName = "MessageInput";

export default MessageInput;
