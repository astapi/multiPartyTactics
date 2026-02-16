import en from "./locales/en.json";
import ja from "./locales/ja.json";
import { Locale } from "./locale";
import { useLocaleStore } from "@/stores/localeStore";

const translations = { ja, en } as const;

type TranslationKey = keyof (typeof translations)["ja"];

const interpolate = (template: string, params?: Record<string, string | number>): string => {
  if (!params) return template;
  return Object.entries(params).reduce((acc, [key, value]) => {
    return acc.replaceAll(`{${key}}`, String(value));
  }, template);
};

export const useI18n = () => {
  const locale = useLocaleStore((state) => state.locale);

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const value = translations[locale][key] ?? translations.en[key];
    return interpolate(value, params);
  };

  return { locale, t };
};

export type { TranslationKey, Locale };
