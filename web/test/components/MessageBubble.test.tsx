import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";

import MessageBubble from "@/components/agent/MessageBubble";
import type { AgentMessage } from "@/types/agentMessage";
import { renderWithProviders, setupTranslationMock } from '@test/utils';

describe("MessageBubble", () => {
  it("renders system notification with severity and payload", () => {
    setupTranslationMock({
      translator: (key, options) => {
        const dictionary: Record<string, string> = {
          "agent.notifications.severity.info": "Info",
          "agent.notifications.severity.warning": "Warning",
          "agent.notifications.severity.critical": "Critical",
          "agent.notifications.titleFallback": "System notification",
        };
        if (typeof options === "object" && options?.defaultValue) {
          return String(options.defaultValue);
        }
        return dictionary[key as string] ?? (key as string);
      },
    });

    const message: AgentMessage = {
      id: "msg-1",
      content: "Work recalculation requires attention",
      sender: "system",
      timestamp: new Date().toISOString(),
      messageType: "system_notification",
      kind: "system_notification",
      severity: "warning",
      metadata: {
        title: "Work recalculation",
        payload: {
          jobId: "123",
          status: "pending",
        },
      },
    };

    renderWithProviders(<MessageBubble message={message} />);

    expect(document.querySelector(".badge-warning")).not.toBeNull();
    expect(screen.getByText("Work recalculation")).toBeInTheDocument();
    expect(
      screen.getByText("Work recalculation requires attention"),
    ).toBeInTheDocument();
    expect(screen.getByText("jobId")).toBeInTheDocument();
    expect(screen.getByText("123")).toBeInTheDocument();
    expect(screen.getByText("status")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
  });
});
