import React from "react";
import { useTranslation } from "react-i18next";

interface LoadingSpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * LoadingSpinner - Reusable component for displaying loading states
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message,
  size = "md",
  className = "",
}) => {
  const { t } = useTranslation();
  const displayMessage = message || t("common.loading");
  const sizeClasses = {
    sm: "loading-xs",
    md: "loading-md",
    lg: "loading-lg",
  } as const;

  const textSizes = {
    sm: "text-base",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <div className={`flex justify-center items-center py-12 ${className}`}>
      <div className="text-center">
        <span
          className={`loading loading-spinner text-primary mx-auto mb-2 ${sizeClasses[size]}`}
        ></span>
        <p className={`text-base text-base-content ${textSizes[size]}`}>
          {displayMessage}
        </p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
