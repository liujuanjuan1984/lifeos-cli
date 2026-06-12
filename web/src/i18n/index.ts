import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import zhCommon from "@/locales/zh/common.json";
import enCommon from "@/locales/en/common.json";

// Language resources
const resources = {
  zh: {
    common: zhCommon,
  },
  en: {
    common: enCommon,
  },
};

// Supported languages
export const supportedLanguages = [
  { code: "zh", name: "中文", nativeName: "中文" },
  { code: "en", name: "English", nativeName: "English" },
];

// Default language
export const defaultLanguage = "zh";

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: defaultLanguage,
    defaultNS: "common",
    ns: ["common"],

    // Language detection options
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },

    // Interpolation options
    interpolation: {
      escapeValue: false, // React already does escaping
    },

    // React options
    react: {
      useSuspense: false,
    },
  });

// Utility functions for i18n
/**
 * Get translation for service layer
 * This utility allows services to access translations without React hooks
 */
export const t = (key: string, options?: Record<string, unknown>): string => {
  return i18n.t(key, options);
};
