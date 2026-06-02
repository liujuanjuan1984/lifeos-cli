import React from "react";
import { Icon } from "./icons";

interface ErrorDisplayProps {
  error: string | null;
  className?: string;
  action?: React.ReactNode;
}

/**
 * ErrorDisplay - Reusable component for displaying error messages
 */
const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  className = "",
  action,
}) => {
  if (!error) return null;

  return (
    <div className={`alert alert-error ${className}`}>
      <div className="flex items-center justify-between gap-3 w-full">
        <span className="inline-flex items-center gap-2">
          <Icon name="warning" size={18} aria-hidden />
          {error}
        </span>
        {action ? <div className="flex items-center">{action}</div> : null}
      </div>
    </div>
  );
};

export default ErrorDisplay;
