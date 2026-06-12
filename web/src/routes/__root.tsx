import { createRootRoute, Outlet } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/Toast";
import { ModalProvider } from "@/contexts/ModalProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ApiErrorToaster from "@/components/ApiErrorToaster";
import AppShell from "@/layouts/AppShell";
import PageTransition from "@/components/PageTransition";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { initTheme } from "@/theme";

// Create a client with optimized settings for smooth page transitions
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false, // Disable to prevent unnecessary refetches during navigation
      refetchOnReconnect: true, // Keep refetch on reconnect for data freshness
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (
          error instanceof Error &&
          "status" in error &&
          typeof error.status === "number"
        ) {
          if (error.status >= 400 && error.status < 500) {
            return false;
          }
        }
        return failureCount < 3;
      },
      // Use placeholder data to prevent loading states during navigation
      placeholderData: (previousData: unknown) => previousData,
    },
    mutations: {
      retry: false, // Don't retry mutations by default
    },
  },
});

// Initialize theme as early as possible
initTheme();

export const Route = createRootRoute({
  context: () => ({
    queryClient,
  }),
  component: () => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ModalProvider>
          <ToastProvider>
            <ErrorBoundary>
              <ApiErrorToaster />
              <AppShell>
                <PageTransition>
                  <Outlet />
                </PageTransition>
              </AppShell>
            </ErrorBoundary>
          </ToastProvider>
        </ModalProvider>
      </ThemeProvider>
    </QueryClientProvider>
  ),
});
