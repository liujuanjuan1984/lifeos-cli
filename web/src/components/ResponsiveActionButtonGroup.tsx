import React, { useState, useRef, useEffect } from "react";
import ActionButton, {
  ActionButtonGroup,
  type ActionSize,
} from "./ActionButton";

export interface ResponsiveActionButtonGroupProps {
  children: React.ReactNode;
  gap?: "sm" | "md" | "lg";
  align?: "start" | "center" | "end";
  className?: string;
  splitOpposite?: boolean;
  withTopBorder?: boolean;
  /**
   * 在移动端显示的主要按钮数量（默认：2）
   * 超出此数量的按钮将被收起到"更多操作"菜单中
   */
  mobileVisibleCount?: number;
  /**
   * 在中等屏幕显示的主要按钮数量（默认：3）
   */
  mediumVisibleCount?: number;
  /**
   * 在桌面端显示的主要按钮数量（默认：所有按钮）
   */
  largeVisibleCount?: number;
  /**
   * 更多操作按钮的文本（默认："更多"）
   */
  moreButtonText?: string;
  /**
   * 更多操作按钮的图标（默认：三个点）
   */
  moreButtonIcon?: React.ReactNode;
  /**
   * 按钮尺寸配置，支持响应式尺寸
   * 可以是固定尺寸，也可以是包含不同屏幕尺寸配置的对象
   */
  buttonSize?:
    | ActionSize
    | {
        mobile?: ActionSize;
        medium?: ActionSize;
        large?: ActionSize;
      };
}

/**
 * 响应式操作按钮组组件
 *
 * 根据屏幕尺寸自动调整按钮显示：
 * - 桌面端（lg+）：显示所有按钮
 * - 中等屏幕（md）：显示指定数量的主要按钮，其余收起到菜单
 * - 移动端（sm-）：显示更少的主要按钮，其余收起到菜单
 */
const ResponsiveActionButtonGroup: React.FC<
  ResponsiveActionButtonGroupProps
> = ({
  children,
  gap = "sm",
  align = "end",
  className = "",
  splitOpposite = false,
  withTopBorder = false,
  mobileVisibleCount = 2,
  mediumVisibleCount = 3,
  largeVisibleCount,
  moreButtonText = "更多",
  moreButtonIcon = <span>⋯</span>,
  buttonSize = "sm",
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [screenSize, setScreenSize] = useState<"sm" | "md" | "lg">("lg");
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 监听屏幕尺寸变化
  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setScreenSize("sm");
      } else if (width < 1024) {
        setScreenSize("md");
      } else {
        setScreenSize("lg");
      }
    };

    updateScreenSize();
    window.addEventListener("resize", updateScreenSize);
    return () => window.removeEventListener("resize", updateScreenSize);
  }, []);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isMenuOpen]);

  // 将子元素转换为数组
  const buttonElements = React.Children.toArray(children);

  if (buttonElements.length === 0) {
    return null;
  }

  // 根据屏幕尺寸确定显示的按钮数量
  const totalVisibleCount =
    screenSize === "sm"
      ? mobileVisibleCount
      : screenSize === "md"
        ? mediumVisibleCount
        : largeVisibleCount !== undefined
          ? largeVisibleCount
          : buttonElements.length;

  // 根据屏幕尺寸确定按钮大小
  const getCurrentButtonSize = (): ActionSize => {
    if (typeof buttonSize === "string") {
      return buttonSize;
    }

    const sizeMap = {
      sm: buttonSize.mobile || "sm",
      md: buttonSize.medium || buttonSize.mobile || "sm",
      lg: buttonSize.large || buttonSize.medium || buttonSize.mobile || "sm",
    } as const;

    return sizeMap[screenSize];
  };

  const currentButtonSize = getCurrentButtonSize();
  const gapClass =
    gap === "lg"
      ? "gap-2 sm:gap-3"
      : gap === "sm"
        ? "gap-1 sm:gap-1.5"
        : "gap-1.5 sm:gap-2";

  const applySizeToButton = (button: React.ReactElement, size: ActionSize) =>
    React.cloneElement(button, { size } as Record<string, unknown>);

  const renderSizedButton = (button: React.ReactNode) => {
    if (React.isValidElement(button)) {
      return applySizeToButton(button, currentButtonSize);
    }
    return button;
  };

  const renderMoreTrigger = (hiddenButtons: React.ReactNode[]) => {
    if (hiddenButtons.length === 0) {
      return null;
    }

    return (
      <ActionButton
        ref={buttonRef}
        label=""
        icon={moreButtonIcon}
        color="neutral"
        size={currentButtonSize}
        onClick={(e) => {
          e.stopPropagation();
          setIsMenuOpen((prev) => !prev);
        }}
        title={moreButtonText}
        ariaLabel={moreButtonText}
        iconOnly
      />
    );
  };

  const renderHiddenMenu = (hiddenButtons: React.ReactNode[]) => {
    if (!isMenuOpen || hiddenButtons.length === 0) {
      return null;
    }

    return (
      <div
        ref={menuRef}
        className="absolute right-0 top-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg z-dropdown min-w-[160px]"
      >
        <div className="py-1">
          {hiddenButtons.map((button, index) => {
            if (
              React.isValidElement<{
                onClick?: (e: React.MouseEvent) => void;
                className?: string;
                size?: ActionSize;
              }>(button)
            ) {
              const originalOnClick = button.props.onClick;
              const existingClassName = button.props.className || "";

              return (
                <div key={button.key ?? index} className="px-2 py-1">
                  {React.cloneElement(button, {
                    onClick: (e: React.MouseEvent) => {
                      if (originalOnClick) {
                        originalOnClick(e);
                      }
                      setIsMenuOpen(false);
                    },
                    className:
                      `${existingClassName} w-full justify-start`.trim(),
                    size: currentButtonSize,
                  })}
                </div>
              );
            }

            return (
              <div key={index} className="px-2 py-1">
                {button}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 所有按钮可见时，直接回退到 ActionButtonGroup
  if (totalVisibleCount >= buttonElements.length) {
    return (
      <ActionButtonGroup
        gap={gap}
        align={align}
        splitOpposite={splitOpposite}
        withTopBorder={withTopBorder}
        className={className}
      >
        {buttonElements.map((button) => renderSizedButton(button))}
      </ActionButtonGroup>
    );
  }

  const containerBaseClass = [
    "relative flex-shrink-0",
    withTopBorder ? "pt-3 sm:pt-4 border-t border-base-300" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // 分离布局：左侧保持首个按钮，右侧执行响应式折叠
  if (splitOpposite && buttonElements.length > 1) {
    const [leftButton, ...restButtons] = buttonElements;
    const rightVisibleCount = Math.max(totalVisibleCount - 1, 0);
    const visibleRightButtons = restButtons.slice(0, rightVisibleCount);
    const hiddenRightButtons = restButtons.slice(rightVisibleCount);

    return (
      <div
        className={[
          containerBaseClass,
          "flex items-center justify-between px-2 sm:px-4",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={`flex ${gapClass}`}>
          {renderSizedButton(leftButton)}
        </div>
        <div className="relative flex-shrink-0">
          <ActionButtonGroup gap={gap} align={align}>
            {visibleRightButtons.map((button) => renderSizedButton(button))}
            {renderMoreTrigger(hiddenRightButtons)}
          </ActionButtonGroup>
          {renderHiddenMenu(hiddenRightButtons)}
        </div>
      </div>
    );
  }

  const visibleButtons = buttonElements.slice(0, totalVisibleCount);
  const hiddenButtons = buttonElements.slice(totalVisibleCount);

  return (
    <div className={containerBaseClass}>
      <ActionButtonGroup gap={gap} align={align}>
        {visibleButtons.map((button) => renderSizedButton(button))}
        {renderMoreTrigger(hiddenButtons)}
      </ActionButtonGroup>
      {renderHiddenMenu(hiddenButtons)}
    </div>
  );
};

export default ResponsiveActionButtonGroup;
