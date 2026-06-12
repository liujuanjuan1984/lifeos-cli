import React, { cloneElement, isValidElement, useCallback } from "react";
import HoverTooltipOverlay from "./HoverTooltipOverlay";
import { useHoverTooltip, type TooltipOffset } from "@/hooks/useHoverTooltip";

type ChildElement = React.ReactElement<
  React.HTMLAttributes<HTMLElement> & { disabled?: boolean }
>;

interface InlineTooltipTriggerProps {
  content: React.ReactNode;
  children: ChildElement;
  offset?: TooltipOffset;
  focusOffset?: TooltipOffset;
  disabled?: boolean;
  className?: string;
}

function composeEventHandlers<E extends React.SyntheticEvent>(
  originalHandler: ((event: E) => void) | undefined,
  nextHandler: (event: E) => void,
) {
  return (event: E) => {
    if (typeof originalHandler === "function") {
      originalHandler(event);
      if (event.defaultPrevented) {
        return;
      }
    }
    nextHandler(event);
  };
}

const InlineTooltipTrigger: React.FC<InlineTooltipTriggerProps> = ({
  content,
  children,
  offset = { x: 12, y: -12 },
  focusOffset = { x: -8, y: -12 },
  disabled,
  className,
}) => {
  if (!isValidElement(children)) {
    throw new Error(
      "InlineTooltipTrigger expects a single React element child.",
    );
  }

  const {
    tooltipState,
    showTooltip,
    schedulePositionUpdate,
    hideTooltip,
    showTooltipForElement,
  } = useHoverTooltip<React.ReactNode>({
    defaultOffset: offset,
    focusOffset,
  });

  const resolvedDisabled =
    typeof disabled === "boolean"
      ? disabled
      : Boolean((children.props as { disabled?: boolean }).disabled);

  const handleMouseEnter = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (resolvedDisabled || !content) return;
      showTooltip({
        payload: content,
        position: { x: event.clientX, y: event.clientY },
      });
    },
    [content, resolvedDisabled, showTooltip],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (resolvedDisabled || !content) return;
      if (!tooltipState) {
        showTooltip({
          payload: content,
          position: { x: event.clientX, y: event.clientY },
        });
        return;
      }
      schedulePositionUpdate({ x: event.clientX, y: event.clientY });
    },
    [
      content,
      resolvedDisabled,
      schedulePositionUpdate,
      showTooltip,
      tooltipState,
    ],
  );

  const handleMouseLeave = useCallback(() => {
    hideTooltip();
  }, [hideTooltip]);

  const handleFocus = useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      if (resolvedDisabled || !content) return;
      showTooltipForElement(content, event.currentTarget, offset);
    },
    [content, offset, resolvedDisabled, showTooltipForElement],
  );

  const handleBlur = useCallback(() => {
    hideTooltip();
  }, [hideTooltip]);

  const childProps = {
    ...children.props,
    className: [children.props.className, className].filter(Boolean).join(" "),
    onMouseEnter: composeEventHandlers(
      children.props.onMouseEnter,
      handleMouseEnter,
    ),
    onMouseMove: composeEventHandlers(
      children.props.onMouseMove,
      handleMouseMove,
    ),
    onMouseLeave: composeEventHandlers(
      children.props.onMouseLeave,
      handleMouseLeave,
    ),
    onFocus: composeEventHandlers(children.props.onFocus, handleFocus),
    onBlur: composeEventHandlers(children.props.onBlur, handleBlur),
  };

  return (
    <>
      {cloneElement(children, childProps)}
      <HoverTooltipOverlay
        visible={Boolean(tooltipState)}
        position={tooltipState?.position ?? null}
        offset={tooltipState?.offset}
        className="text-xs leading-relaxed"
      >
        {tooltipState?.payload ?? null}
      </HoverTooltipOverlay>
    </>
  );
};

export default InlineTooltipTrigger;
