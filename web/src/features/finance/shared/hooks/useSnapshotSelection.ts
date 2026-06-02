import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

interface SnapshotOption<ID extends string> {
  value: ID;
  label: string;
}

interface UseSnapshotSelectionParams<TSnapshot, ID extends string> {
  snapshots: TSnapshot[];
  /** 返回快照的唯一标识 */
  getId: (snapshot: TSnapshot) => ID;
  /** 排序比较函数，默认保持原顺序 */
  sortSnapshots?: (a: TSnapshot, b: TSnapshot) => number;
  /** 用于构建下拉选项的文案 */
  getOptionLabel?: (snapshot: TSnapshot) => string;
  /** 自定义初始选中值，默认取排序后第一条 */
  initialSelectedId?: ID | null;
}

interface UseSnapshotSelectionResult<TSnapshot, ID extends string> {
  orderedSnapshots: TSnapshot[];
  selectedId: ID | null;
  /** 支持直接传值或 updater 函数，行为与 useState 保持一致 */
  setSelectedId: Dispatch<SetStateAction<ID | null>>;
  currentSnapshot: TSnapshot | null;
  effectiveIndex: number;
  hasPrevious: boolean;
  hasNext: boolean;
  goToPrevious: () => void;
  goToNext: () => void;
  options: SnapshotOption<ID>[];
}

export function useSnapshotSelection<TSnapshot, ID extends string>({
  snapshots,
  getId,
  sortSnapshots,
  getOptionLabel,
  initialSelectedId = null,
}: UseSnapshotSelectionParams<TSnapshot, ID>): UseSnapshotSelectionResult<
  TSnapshot,
  ID
> {
  const getIdRef = useRef(getId);
  const sortRef = useRef<((a: TSnapshot, b: TSnapshot) => number) | undefined>(
    sortSnapshots,
  );
  const labelRef = useRef<
    ((snapshot: TSnapshot) => string | undefined) | undefined
  >(getOptionLabel);

  useEffect(() => {
    getIdRef.current = getId;
  }, [getId]);

  useEffect(() => {
    sortRef.current = sortSnapshots;
  }, [sortSnapshots]);

  useEffect(() => {
    labelRef.current = getOptionLabel;
  }, [getOptionLabel]);

  const orderedSnapshots = useMemo(() => {
    const next = [...snapshots];
    if (sortRef.current) {
      next.sort((a, b) => sortRef.current!(a, b));
    }
    return next;
  }, [snapshots]);

  const deriveFirstId = useCallback((): ID | null => {
    const first = orderedSnapshots[0];
    return first ? getIdRef.current(first) : null;
  }, [orderedSnapshots]);

  const [selectedId, setSelectedIdState] = useState<ID | null>(() => {
    if (initialSelectedId) {
      return initialSelectedId;
    }
    return deriveFirstId();
  });

  useEffect(() => {
    if (!orderedSnapshots.length) {
      setSelectedIdState(null);
      return;
    }
    setSelectedIdState((current) => {
      if (!current) {
        return deriveFirstId();
      }
      const exists = orderedSnapshots.some(
        (snapshot) => getIdRef.current(snapshot) === current,
      );
      return exists ? current : deriveFirstId();
    });
  }, [orderedSnapshots, deriveFirstId]);

  const effectiveIndex = useMemo(() => {
    if (!selectedId) return -1;
    return orderedSnapshots.findIndex(
      (snapshot) => getIdRef.current(snapshot) === selectedId,
    );
  }, [orderedSnapshots, selectedId]);

  const currentSnapshot =
    effectiveIndex >= 0 ? orderedSnapshots[effectiveIndex] : null;

  const hasPrevious =
    effectiveIndex >= 0 && effectiveIndex < orderedSnapshots.length - 1;
  const hasNext = effectiveIndex > 0;

  const setSelectedId = useCallback<Dispatch<SetStateAction<ID | null>>>(
    (value) => {
      setSelectedIdState((prev) => {
        const nextValue =
          typeof value === "function"
            ? (value as (prev: ID | null) => ID | null)(prev)
            : value;
        return nextValue ?? null;
      });
    },
    [],
  );

  const goToPrevious = useCallback(() => {
    if (!hasPrevious) return;
    const target = orderedSnapshots[effectiveIndex + 1];
    if (target) {
      setSelectedIdState(getIdRef.current(target));
    }
  }, [effectiveIndex, hasPrevious, orderedSnapshots]);

  const goToNext = useCallback(() => {
    if (!hasNext) return;
    const target = orderedSnapshots[effectiveIndex - 1];
    if (target) {
      setSelectedIdState(getIdRef.current(target));
    }
  }, [effectiveIndex, hasNext, orderedSnapshots]);

  const options = useMemo(() => {
    return orderedSnapshots.map((snapshot) => {
      const value = getIdRef.current(snapshot);
      const label =
        labelRef.current?.(snapshot) ?? getIdRef.current(snapshot).toString();
      return { value, label };
    });
  }, [orderedSnapshots]);

  return {
    orderedSnapshots,
    selectedId,
    setSelectedId,
    currentSnapshot,
    effectiveIndex,
    hasPrevious,
    hasNext,
    goToPrevious,
    goToNext,
    options,
  };
}
