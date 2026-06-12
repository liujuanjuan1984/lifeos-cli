import { createContext, useContext } from "react";

export interface ModalStackContextValue {
  register: (id: string) => void;
  unregister: (id: string) => void;
  isTop: (id: string) => boolean;
  getCount: () => number;
}

export const ModalStackContext = createContext<ModalStackContextValue | null>(
  null,
);

export const useModalStack = (): ModalStackContextValue => {
  const ctx = useContext(ModalStackContext);
  if (!ctx) throw new Error("useModalStack must be used within ModalProvider");
  return ctx;
};
