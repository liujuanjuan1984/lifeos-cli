import React from "react";
import { formatTime } from "@/utils/datetime";

interface TimeRangeTextProps {
  start?: string | null;
  end?: string | null;
  className?: string;
  placeholder?: string;
  separator?: string;
  render?: (startText: string, endText: string) => React.ReactNode;
}

const TimeRangeTextComponent: React.FC<TimeRangeTextProps> = ({
  start,
  end,
  className,
  placeholder = "--:--",
  separator = "-",
  render,
}) => {
  const startText = start ? formatTime(start) : placeholder;
  const endText = end ? formatTime(end) : placeholder;
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
    prev.className === next.className &&
    prev.placeholder === next.placeholder &&
    prev.separator === next.separator &&
    prev.render === next.render
  );
});

export default TimeRangeText;
