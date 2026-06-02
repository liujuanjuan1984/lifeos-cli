import React, { forwardRef } from "react";

type ScrollOrientation = "vertical" | "horizontal" | "both";

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 滚动方向（默认仅纵向） */
  orientation?: ScrollOrientation;
}

const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ orientation = "vertical", className = "", children, ...rest }, ref) => {
    const orientationClasses =
      orientation === "horizontal"
        ? "overflow-x-auto overflow-y-hidden"
        : orientation === "both"
          ? "overflow-auto"
          : "overflow-y-auto overflow-x-hidden";

    const baseClasses = [
      "scrollbar-gutter-stable-both",
      "overscroll-contain",
      "min-h-0",
      "max-h-full",
      orientationClasses,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div ref={ref} className={baseClasses} {...rest}>
        {children}
      </div>
    );
  },
);

ScrollArea.displayName = "ScrollArea";

export default ScrollArea;
