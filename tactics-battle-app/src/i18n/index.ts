import en from "./locales/en.json";
import ja from "./locales/ja.json";

type Locale = "ja" | "en";

const translations = { ja, en } as const;

type TranslationKey = keyof (typeof translations)["ja"];

const detectLocale = (): Locale => {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  return locale.startsWith("ja") ? "ja" : "en";
};

const interpolate = (template: string, params?: Record<string, string | number>): string => {
  if (!params) return template;
  return Object.entries(params).reduce((acc, [key, value]) => {
    return acc.replaceAll(`{${key}}`, String(value));
  }, template);
};

export const useI18n = () => {
  const locale = detectLocale();

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const value = translations[locale][key] ?? translations.en[key];
    return interpolate(value, params);
  };

  return { locale, t };
};

export type { TranslationKey, Locale };
