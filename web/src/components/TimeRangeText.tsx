import React from "react";
import { formatTime } from "@/utils/datetime";

interface TimeRangeTextProps {
  start?: string | null;
  end?: string | null;
  timezone?: string;
  className?: string;
  placeholder?: string;
  separator?: string;
  render?: (startText: string, endText: string) => React.ReactNode;
}

const TimeRangeTextComponent: React.FC<TimeRangeTextProps> = ({
  start,
  end,
  timezone,
  className,
  placeholder = "--:--",
  separator = "-",
  render,
}) => {
  const startText = start ? formatTime(start, timezone) : placeholder;
  const endText = end ? formatTime(end, timezone) : placeholder;
  return (
    <div
      className={["text-base font-mono text-base-content", className || ""]
        .filter(Boolean)
        .join(" ")}
    >
      {render ? (
        render(startText, endText)
      ) : (
        <>
          {startText}
          {separator}
          {endText}
        </>
      )}
    </div>
  );
};

const TimeRangeText = React.memo(TimeRangeTextComponent, (prev, next) => {
  return (
    prev.start === next.start &&
    prev.end === next.end &&
    prev.timezone === next.timezone &&
    prev.className === next.className &&
    prev.placeholder === next.placeholder &&
    prev.separator === next.separator &&
    prev.render === next.render
  );
});

export default TimeRangeText;
