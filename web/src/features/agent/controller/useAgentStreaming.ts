import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

export type StreamPhase = "idle" | "streaming" | "stalled" | "error";

interface StallHandlerArgs {
  abort: (reason?: string, nextPhase?: StreamPhase) => void;
  setAbortReason: Dispatch<SetStateAction<string | null>>;
}

interface UseAgentStreamingOptions {
  stallTimeoutMs: number;
  stallCheckIntervalMs?: number;
  onStall?: (args: StallHandlerArgs) => void;
}

interface UseAgentStreamingResult {
  phase: StreamPhase;
  isStreaming: boolean;
  abortReason: string | null;
  setAbortReason: Dispatch<SetStateAction<string | null>>;
  startStreaming: () => AbortController;
  completeStreaming: (nextPhase?: StreamPhase) => void;
  abortStreaming: (reason?: string, nextPhase?: StreamPhase) => void;
  setPhase: Dispatch<SetStateAction<StreamPhase>>;
  registerStreamActivity: () => void;
  controllerRef: MutableRefObject<AbortController | null>;
}

export const useAgentStreaming = (
  options: UseAgentStreamingOptions,
): UseAgentStreamingResult => {
  const { stallTimeoutMs, stallCheckIntervalMs = 1000, onStall } = options;
  const [phase, setPhase] = useState<StreamPhase>("idle");
  const phaseRef = useRef<StreamPhase>("idle");
  const [abortReason, setAbortReason] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const lastStreamEventAtRef = useRef<number | null>(null);

  const registerStreamActivity = useCallback(() => {
    lastStreamEventAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
    if (phase !== "streaming") {
      lastStreamEventAtRef.current = null;
    }
  }, [phase]);

  const startStreaming = useCallback(() => {
    if (controllerRef.current && !controllerRef.current.signal.aborted) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setAbortReason(null);
    setPhase("streaming");
    registerStreamActivity();
    return controller;
  }, [registerStreamActivity]);

  const abortStreaming = useCallback(
    (reason?: string, nextPhase: StreamPhase = "idle") => {
      if (typeof reason !== "undefined") {
        setAbortReason(reason);
      }
      const controller = controllerRef.current;
      if (controller && !controller.signal.aborted) {
        controller.abort();
      }
      controllerRef.current = null;
      setPhase(nextPhase);
    },
    [],
  );

  const completeStreaming = useCallback((nextPhase: StreamPhase = "idle") => {
    controllerRef.current = null;
    setPhase(nextPhase);
  }, []);

  useEffect(() => {
    if (phase !== "streaming") return undefined;
    const timer = window.setInterval(() => {
      const last = lastStreamEventAtRef.current;
      if (!last) return;
      if (
        Date.now() - last > stallTimeoutMs &&
        phaseRef.current === "streaming"
      ) {
        setPhase("stalled");
        onStall?.({ abort: abortStreaming, setAbortReason });
      }
    }, stallCheckIntervalMs);
    return () => window.clearInterval(timer);
  }, [phase, stallTimeoutMs, stallCheckIntervalMs, onStall, abortStreaming]);

  useEffect(
    () => () => {
      if (controllerRef.current && !controllerRef.current.signal.aborted) {
        controllerRef.current.abort();
      }
    },
    [],
  );

  return {
    phase,
    isStreaming: phase === "streaming",
    abortReason,
    setAbortReason,
    startStreaming,
    completeStreaming,
    abortStreaming,
    setPhase,
    registerStreamActivity,
    controllerRef,
  };
};
