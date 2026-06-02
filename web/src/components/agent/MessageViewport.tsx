import type { AgentMessage } from "@/types/agentMessage";
import MessageList from "./MessageList";

interface MessageViewportProps {
  messages: AgentMessage[];
  isStreaming: boolean;
  abortReason: string | null;
}

const MessageViewport: React.FC<MessageViewportProps> = ({
  messages,
  isStreaming,
  abortReason,
}) => {
  return (
    <>
      <div className="flex-1 overflow-y-auto min-h-0">
        <MessageList messages={messages} isLoading={isStreaming} />
      </div>
      {abortReason && (
        <div className="px-4 py-2 bg-warning/10 border-t border-warning/20">
          <div className="flex items-center gap-2 text-warning text-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="w-4 h-4 stroke-current"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <span>{abortReason}</span>
          </div>
        </div>
      )}
    </>
  );
};

export default MessageViewport;
