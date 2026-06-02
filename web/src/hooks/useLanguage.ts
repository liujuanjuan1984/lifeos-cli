import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supportedLanguages, defaultLanguage } from "@/i18n";
import { preferencesApi } from "@/services/api/preferences";

export type Language = "zh" | "en" | "auto";

interface LanguageOption {
  value: Language;
  label: string;
}

export function useLanguage() {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState<Language>("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const PREFERENCE_KEY = "system.language";

  // Language options for UI
  const languageOptions: LanguageOption[] = [
    { value: "auto", label: "跟随系统" },
    { value: "zh", label: "中文" },
    { value: "en", label: "English" },
  ];

  // Get current language from i18n
  const getCurrentLanguage = useCallback((): Language => {
    const detectedLanguage = i18n.language;
    if (detectedLanguage === "zh" || detectedLanguage === "zh-CN") {
      return "zh";
    } else if (detectedLanguage === "en" || detectedLanguage === "en-US") {
      return "en";
    }
    return "auto";
  }, [i18n.language]);

  // Initialize current language
  useEffect(() => {
    setCurrentLanguage(getCurrentLanguage());
  }, [i18n.language, getCurrentLanguage]);

  // Bootstrap from backend preference once on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await preferencesApi.getWithMeta<Language>(PREFERENCE_KEY);
        const backendValue = (res.value ??
          res.meta?.default_value ??
          "auto") as Language;
        // Change i18n to match backend preference
        await changeLanguage(backendValue);
        if (mounted) {
          setCurrentLanguage(backendValue);
        }
      } catch (_e) {
        // Ignore and rely on i18n detector/localStorage
      } finally {
        if (mounted) {
          setLoading(false);
          setBootstrapped(true);
        }
      }
    })();
    return () => {
      mounted = false;
    };
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Change language
  const changeLanguage = async (language: Language): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      if (language === "auto") {
        // Use browser language detection
        const detectedLanguage = i18n.services.languageDetector.detect();
        if (detectedLanguage) {
          await i18n.changeLanguage(detectedLanguage);
        } else {
          await i18n.changeLanguage(defaultLanguage);
        }
      } else {
        await i18n.changeLanguage(language);
      }

      setCurrentLanguage(language);
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to change language",
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Save language preference to backend and localStorage
  const saveLanguage = async (language: Language): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      // Persist to backend first (validated by USER_PREFERENCE_DEFAULTS)
      await preferencesApi.set<Language>(PREFERENCE_KEY, language, "system");
      const success = await changeLanguage(language);
      if (success) {
        localStorage.setItem(
          "i18nextLng",
          language === "auto" ? i18n.language : language,
        );
      }
      setCurrentLanguage(language);
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save language");
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    currentLanguage,
    languageOptions,
    changeLanguage,
    saveLanguage,
    loading,
    error,
    supportedLanguages,
    bootstrapped,
  };
}
