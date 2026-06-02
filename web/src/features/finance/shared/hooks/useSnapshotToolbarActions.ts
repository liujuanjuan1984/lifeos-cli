import { useCallback } from "react";

interface UseSnapshotToolbarActionsParams<ID extends string> {
  isSubmitting: boolean;
  isFormVisible: boolean;
  onCloseForm: () => void;
  onSelect: (id: ID) => void;
  onPrevious: () => void;
  onNext: () => void;
  shouldBlockSelect?: (id: ID) => boolean;
}

export function useSnapshotToolbarActions<ID extends string>({
  isSubmitting,
  isFormVisible,
  onCloseForm,
  onSelect,
  onPrevious,
  onNext,
  shouldBlockSelect,
}: UseSnapshotToolbarActionsParams<ID>) {
  const runSnapshotAction = useCallback(
    (action: () => void) => {
      if (isSubmitting) {
        return;
      }
      if (isFormVisible) {
        onCloseForm();
      }
      action();
    },
    [isSubmitting, isFormVisible, onCloseForm],
  );

  const handleSelect = useCallback(
    (value: ID) => {
      if (shouldBlockSelect?.(value)) {
        return;
      }
      runSnapshotAction(() => onSelect(value));
    },
    [onSelect, runSnapshotAction, shouldBlockSelect],
  );

  const handlePrevious = useCallback(
    () => runSnapshotAction(onPrevious),
    [onPrevious, runSnapshotAction],
  );

  const handleNext = useCallback(
    () => runSnapshotAction(onNext),
    [onNext, runSnapshotAction],
  );

  return {
    runSnapshotAction,
    handleSelect,
    handlePrevious,
    handleNext,
  };
}
