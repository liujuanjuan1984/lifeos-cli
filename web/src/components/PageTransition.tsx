import type { ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";

interface PageTransitionProps {
  children: ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();

  return (
    <div
      key={location.pathname}
      className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
      style={{
        animationFillMode: "both",
      }}
    >
      {children}
    </div>
  );
}
