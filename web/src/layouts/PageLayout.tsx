import React from "react";

interface PageLayoutProps {
  children: React.ReactNode;
}

// Modern responsive container wrapper for the whole page
export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="w-full h-full p-4 px-4 xs:px-2 sm:px-4 lg:px-8 xl:px-12">
      {children}
    </div>
  );
}
