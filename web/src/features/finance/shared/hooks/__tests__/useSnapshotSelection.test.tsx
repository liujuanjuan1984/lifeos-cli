import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSnapshotSelection } from "@/features/finance/shared/hooks/useSnapshotSelection";

type Snapshot = {
  id: string;
  value: number;
};

describe("useSnapshotSelection", () => {
  it("sorts snapshots and selects the first by default", () => {
    const snapshots: Snapshot[] = [
      { id: "first", value: 1 },
      { id: "second", value: 2 },
    ];

    const { result } = renderHook(() =>
      useSnapshotSelection<Snapshot, string>({
        snapshots,
        getId: (snapshot) => snapshot.id,
        sortSnapshots: (a, b) => b.value - a.value,
        getOptionLabel: (snapshot) => `#${snapshot.id}`,
      }),
    );

    expect(result.current.orderedSnapshots[0]?.id).toBe("second");
    expect(result.current.selectedId).toBe("second");
    expect(result.current.options[0]?.label).toBe("#second");
  });

  it("navigates to previous and next snapshots", () => {
    const snapshots: Snapshot[] = [
      { id: "one", value: 1 },
      { id: "two", value: 2 },
      { id: "three", value: 3 },
    ];

    const { result } = renderHook(() =>
      useSnapshotSelection<Snapshot, string>({
        snapshots,
        getId: (snapshot) => snapshot.id,
        sortSnapshots: (a, b) => b.value - a.value,
      }),
    );

    expect(result.current.selectedId).toBe("three");
    expect(result.current.hasPrevious).toBe(true);
    expect(result.current.hasNext).toBe(false);

    act(() => {
      result.current.goToPrevious();
    });

    expect(result.current.selectedId).toBe("two");
    expect(result.current.hasNext).toBe(true);

    act(() => {
      result.current.goToNext();
    });

    expect(result.current.selectedId).toBe("three");
  });

  it("falls back to the first snapshot when the current selection disappears", () => {
    const initialSnapshots: Snapshot[] = [
      { id: "alpha", value: 1 },
      { id: "beta", value: 2 },
    ];

    const { result, rerender } = renderHook(
      ({ snapshots }) =>
        useSnapshotSelection<Snapshot, string>({
          snapshots,
          getId: (snapshot) => snapshot.id,
          sortSnapshots: (a, b) => b.value - a.value,
        }),
      { initialProps: { snapshots: initialSnapshots } },
    );

    act(() => {
      result.current.setSelectedId("alpha");
    });

    rerender({ snapshots: [{ id: "beta", value: 2 }] });

    expect(result.current.selectedId).toBe("beta");
  });
});
