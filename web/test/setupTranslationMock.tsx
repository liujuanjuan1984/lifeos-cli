import type { ReactNode } from "react";
import { vi } from "vitest";

type TranslatorOptions = string | Record<string, unknown> | undefined;

const translationState = vi.hoisted(() => ({
  t: vi.fn<(key: string, options?: TranslatorOptions) => string>(),
  changeLanguage: vi.fn(),
  language: "en",
}));

const createDefaultTranslator = () =>
  (key: string, options?: TranslatorOptions) => {
    if (typeof options === "string") {
      return options;
    }
    const defaultValue = options?.defaultValue;
    return typeof defaultValue === "string" ? defaultValue : key;
  };

translationState.t.mockImplementation(createDefaultTranslator());

vi.mock("react-i18next", () => ({
  __esModule: true,
  useTranslation: () => ({
    t: translationState.t,
    i18n: {
      changeLanguage: translationState.changeLanguage,
      language: translationState.language,
    },
  }),
  Trans: ({ children }: { children?: ReactNode | (() => ReactNode) }) => (
    <>{typeof children === "function" ? children() : children}</>
  ),
  initReactI18next: {
    type: "3rdParty",
    init: vi.fn(),
  },
}));

export interface TranslationMockOptions {
  translator?: (key: string, options?: TranslatorOptions) => string;
  language?: string;
}

export interface TranslationMockResult {
  t: ReturnType<typeof vi.fn>;
  changeLanguage: ReturnType<typeof vi.fn>;
}

export const setupTranslationMock = (
  options: TranslationMockOptions = {},
): TranslationMockResult => {
  const translator = options.translator ?? createDefaultTranslator();
  const tMock = vi.fn(
    (key: string, localOptions?: TranslatorOptions) =>
      translator(key, localOptions),
  );
  const changeLanguageMock = vi.fn();

  translationState.t = tMock as typeof translationState.t;
  translationState.changeLanguage =
    changeLanguageMock as typeof translationState.changeLanguage;
  translationState.language = options.language ?? "en";

  return {
    t: tMock,
    changeLanguage: changeLanguageMock,
  };
};
