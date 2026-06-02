import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";

import { useToast } from "@/contexts/ToastContext";

type ToastContent = {
  title?: string;
  description?: string;
};

type SuccessToastGenerator<TData, TVariables> = (params: {
  data: TData;
  variables: TVariables;
}) => ToastContent | void | null;

type ErrorToastGenerator<TError, TVariables> = (params: {
  error: TError;
  variables: TVariables;
}) => ToastContent | void | null;

interface ToastMutationOptions<TData, TError, TVariables, TContext>
  extends UseMutationOptions<TData, TError, TVariables, TContext> {
  getSuccessToast?: SuccessToastGenerator<TData, TVariables>;
  getErrorToast?: ErrorToastGenerator<TError, TVariables>;
  /** When true, success toast will be suppressed. Defaults to false. */
  suppressSuccessToast?: boolean;
  /** When true, error toast will be suppressed. Defaults to false. */
  suppressErrorToast?: boolean;
}

export function useToastMutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown,
>(
  options: ToastMutationOptions<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> {
  const toast = useToast();
  const {
    getSuccessToast,
    getErrorToast,
    suppressSuccessToast = false,
    suppressErrorToast = false,
    onSuccess: originalOnSuccess,
    onError: originalOnError,
    ...mutationOptions
  } = options;

  return useMutation<TData, TError, TVariables, TContext>({
    ...mutationOptions,
    onSuccess: (data, variables, context, mutation) => {
      if (!suppressSuccessToast && getSuccessToast) {
        const content = getSuccessToast({ data, variables });
        if (content) {
          toast.showSuccess(content.title ?? "", content.description);
        }
      }
      if (originalOnSuccess) {
        originalOnSuccess(data, variables, context, mutation);
      }
    },
    onError: (error, variables, context, mutation) => {
      if (!suppressErrorToast) {
        const content = getErrorToast?.({ error, variables }) ?? {
          title: undefined,
          description:
            error instanceof Error ? error.message : String(error ?? ""),
        };
        if (content) {
          toast.showError(content.title ?? "", content.description);
        }
      }
      if (originalOnError) {
        originalOnError(error, variables, context, mutation);
      }
    },
  });
}
