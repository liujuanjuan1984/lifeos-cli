import { type PropsWithChildren, type ReactElement, type ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

import { ToastContext } from "@/contexts/ToastContext";
import {
  setupTranslationMock as baseSetupTranslationMock,
  type TranslationMockOptions,
  type TranslationMockResult,
} from "./setupTranslationMock";

const routerState = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  navigateComponentSpy: vi.fn(),
  searchRef: { current: {} as Record<string, unknown> },
  locationRef: { pathname: "/", search: "" },
}));

vi.mock("@tanstack/react-router", () => ({
  __esModule: true,
  useNavigate: () => routerState.navigateMock,
  useSearch: () => routerState.searchRef.current,
  useLocation: () => routerState.locationRef,
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={typeof to === "string" ? to : String(to)}>{children}</a>
  ),
  Navigate: (props: unknown) => {
    routerState.navigateComponentSpy(props);
    return <div data-testid="navigate" />;
  },
}));

type ToastContextType = React.ContextType<typeof ToastContext>;

interface RenderWithProvidersOptions extends RenderOptions {
  toast?: Partial<ToastContextType>;
  queryClient?: QueryClient;
}

interface RenderWithProvidersResult {
  toastContext: ToastContextType;
  queryClient: QueryClient;
}

const createToastContextValue = (
  overrides: Partial<ToastContextType> = {},
): ToastContextType => ({
  showToast: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn(),
  showInfo: vi.fn(),
  ...overrides,
});

export const renderWithProviders = (
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
) => {
  const { toast: toastOverrides, queryClient, wrapper: UserWrapper, ...rest } =
    options;
  const toastContext = createToastContextValue(toastOverrides);
  const queryClientInstance =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

  const ProviderWrapper = ({ children }: PropsWithChildren) => {
    let content = (
      <ToastContext.Provider value={toastContext}>{children}</ToastContext.Provider>
    );

    content = (
      <QueryClientProvider client={queryClientInstance}>{content}</QueryClientProvider>
    );

    if (UserWrapper) {
      return <UserWrapper>{content}</UserWrapper>;
    }

    return content;
  };

  const renderResult = render(ui, {
    wrapper: ProviderWrapper,
    ...rest,
  });

  return {
    ...renderResult,
    toastContext,
    queryClient: queryClientInstance,
  } satisfies RenderWithProvidersResult & typeof renderResult;
};

export const setupTranslationMock = (
  options?: TranslationMockOptions,
): TranslationMockResult => baseSetupTranslationMock(options);
